// Vercel serverless function: AI grouping proxy for student self-uploads.
//
// The browser parses the papers locally (free, offline-capable) and POSTs just
// the extracted question TEXT here; we hold the Gemini key server-side and, for
// SIGNED-IN users only, return clean topic groups. Being same-origin, this works
// on the locked-down campus network (no external call from the student's browser).
//
// Required Vercel env vars: GEMINI_API_KEY (server-side, NOT VITE_-prefixed).
// Reuses VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (already set) to verify the
// caller's session token. Optional: GEMINI_MODEL (defaults to gemini-2.0-flash).

import { buildGroupingPrompt, buildRefinePrompt } from "../src/engine/aiPrompt.js";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// Verify the caller is a signed-in user by checking the token against Supabase.
// (Avoids needing the JWT secret here.) Returns the user object, or null.
async function verifyUser(token) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon || !token) return null;
  try {
    const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, authorization: `Bearer ${token}` } });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SB_ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const DAILY_CAP = Number(process.env.GROUP_DAILY_CAP || 60); // AI grouping calls / user / day

// Count today's grouping calls for this user (their own rows via RLS). Fails
// OPEN (returns 0) on any error — a missing api_usage table must never block use.
async function callsToday(userId, token) {
  try {
    if (!SB_URL || !SB_ANON) return 0;
    const since = new Date(); since.setHours(0, 0, 0, 0);
    const url = `${SB_URL}/rest/v1/api_usage?select=id&kind=eq.group&user_id=eq.${userId}&created_at=gte.${since.toISOString()}`;
    const r = await fetch(url, { headers: { apikey: SB_ANON, authorization: `Bearer ${token}`, Prefer: "count=exact" } });
    if (!r.ok) return 0;
    const cr = r.headers.get("content-range"); // "0-9/42"
    const n = cr && cr.includes("/") ? parseInt(cr.split("/")[1], 10) : (await r.json()).length;
    return Number.isFinite(n) ? n : 0;
  } catch { return 0; }
}

// Log one grouping call (best-effort).
async function logGroupCall(userId, email, token) {
  try {
    if (!SB_URL || !SB_ANON) return;
    await fetch(`${SB_URL}/rest/v1/api_usage`, {
      method: "POST",
      headers: { apikey: SB_ANON, authorization: `Bearer ${token}`, "content-type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: userId, email: email || null, kind: "group" }),
    });
  } catch { /* best-effort */ }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: "AI grouping not configured" });

  // Signed-in users only — this protects the key and bounds cost.
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const user = await verifyUser(token);
  if (!user) return res.status(401).json({ error: "sign in required" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const questions = body?.questions;
  const topics = body?.topics || [];
  const current = body?.current || null; // present => "improve/refine" an existing grouping
  if (!Array.isArray(questions) || !questions.length) return res.status(400).json({ error: "no questions" });
  if (questions.length > 400) return res.status(400).json({ error: "too many questions" });
  if (await callsToday(user.id, token) >= DAILY_CAP) return res.status(429).json({ error: "daily AI grouping limit reached — try again tomorrow" });

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: (Array.isArray(current) && current.length) ? buildRefinePrompt(questions, current, topics) : buildGroupingPrompt(questions, topics) }] }],
        // thinkingBudget:0 disables 2.5-flash "thinking" (not needed for this
        // structured task; left on it eats the token budget and truncates JSON).
        // Only 2.5 models accept thinkingConfig, so gate it on the model name.
        generationConfig: { temperature: 0, maxOutputTokens: 32768, responseMimeType: "application/json", ...(/2\.5/.test(GEMINI_MODEL) ? { thinkingConfig: { thinkingBudget: 0 } } : {}) },
      }),
    });
    if (!r.ok) return res.status(502).json({ error: `gemini ${r.status}` });
    const d = await r.json();
    const raw = (d.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
    const jsonStr = (raw.match(/\{[\s\S]*\}/) || [raw])[0];
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed.groups)) return res.status(502).json({ error: "bad model output" });
    await logGroupCall(user.id, user.email, token);
    return res.status(200).json({ groups: parsed.groups });
  } catch {
    return res.status(502).json({ error: "grouping failed" });
  }
}
