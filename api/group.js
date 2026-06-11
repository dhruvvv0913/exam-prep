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

import { buildGroupingPrompt } from "../src/engine/aiPrompt.js";

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
  if (!Array.isArray(questions) || !questions.length) return res.status(400).json({ error: "no questions" });
  if (questions.length > 400) return res.status(400).json({ error: "too many questions" });

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildGroupingPrompt(questions, topics) }] }],
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
    return res.status(200).json({ groups: parsed.groups });
  } catch {
    return res.status(502).json({ error: "grouping failed" });
  }
}
