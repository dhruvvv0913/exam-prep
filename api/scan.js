// Vercel serverless function: AI VISION scan for poorly-scanned papers.
//
// The browser renders a paper's pages to images and POSTs them here ONLY when
// local OCR/text extraction failed to read it cleanly (and the user is signed
// in). We hold the Gemini key server-side and call the multimodal model to
// transcribe the questions, then return clean text the client re-parses. Being
// same-origin, this works on the locked-down campus network.
//
// Required Vercel env: GEMINI_API_KEY (server-side, NOT VITE_-prefixed).
// Optional: GEMINI_MODEL (default gemini-2.5-flash), SCAN_DAILY_CAP (default 40).

import { buildScanPrompt } from "../src/engine/aiPrompt.js";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SB_ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const DAILY_CAP = Number(process.env.SCAN_DAILY_CAP || 40); // AI-scan calls / user / day
const MAX_IMAGES = 12;

async function verifyUser(token) {
  if (!SB_URL || !SB_ANON || !token) return null;
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, authorization: `Bearer ${token}` } });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

// Today's scan calls for this user (own rows via RLS). Fails OPEN (0) on error.
async function callsToday(userId, token) {
  try {
    if (!SB_URL || !SB_ANON) return 0;
    const since = new Date(); since.setHours(0, 0, 0, 0);
    const url = `${SB_URL}/rest/v1/api_usage?select=id&kind=eq.scan&user_id=eq.${userId}&created_at=gte.${since.toISOString()}`;
    const r = await fetch(url, { headers: { apikey: SB_ANON, authorization: `Bearer ${token}`, Prefer: "count=exact" } });
    if (!r.ok) return 0;
    const cr = r.headers.get("content-range");
    const n = cr && cr.includes("/") ? parseInt(cr.split("/")[1], 10) : (await r.json()).length;
    return Number.isFinite(n) ? n : 0;
  } catch { return 0; }
}

async function logScanCall(userId, email, token) {
  try {
    if (!SB_URL || !SB_ANON) return;
    await fetch(`${SB_URL}/rest/v1/api_usage`, {
      method: "POST",
      headers: { apikey: SB_ANON, authorization: `Bearer ${token}`, "content-type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: userId, email: email || null, kind: "scan" }),
    });
  } catch { /* best-effort */ }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: "AI scan not configured" });

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const user = await verifyUser(token);
  if (!user) return res.status(401).json({ error: "sign in required" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const images = body?.images;
  const mime = body?.mime || "image/jpeg";
  if (!Array.isArray(images) || !images.length) return res.status(400).json({ error: "no images" });
  if (images.length > MAX_IMAGES) return res.status(400).json({ error: "too many pages" });
  if (await callsToday(user.id, token) >= DAILY_CAP) return res.status(429).json({ error: "daily AI scan limit reached — try again tomorrow" });

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
    const parts = [{ text: buildScanPrompt() }, ...images.map((data) => ({ inlineData: { mimeType: mime, data } }))];
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0, maxOutputTokens: 8192, ...(/2\.5/.test(GEMINI_MODEL) ? { thinkingConfig: { thinkingBudget: 0 } } : {}) },
      }),
    });
    if (!r.ok) return res.status(502).json({ error: `gemini ${r.status}` });
    const d = await r.json();
    const text = (d.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
    if (!text) return res.status(502).json({ error: "empty transcription" });
    await logScanCall(user.id, user.email, token);
    return res.status(200).json({ text });
  } catch {
    return res.status(502).json({ error: "scan failed" });
  }
}
