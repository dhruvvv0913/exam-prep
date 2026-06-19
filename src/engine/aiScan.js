// Browser: AI VISION scan via the same-origin /api/scan proxy. For SIGNED-IN
// users only, used as a last resort when local OCR/text extraction reads a paper
// poorly (blurry scan, mangled text). Sends the rendered page IMAGES; the key
// stays server-side; works on the campus network (same origin). Returns clean
// transcribed question text, or THROWS so the caller falls back to local text.
import { supabase } from "../lib/supabase.js";

// `images` = array of base64 JPEGs (no data: prefix), one per page.
export async function scanViaApi(images) {
  if (!supabase) throw new Error("auth unavailable");
  if (!Array.isArray(images) || !images.length) throw new Error("no images");
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("not signed in");

  const res = await fetch("/api/scan", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ images, mime: "image/jpeg" }),
  });
  if (!res.ok) throw new Error(`scan api ${res.status}`);
  const { text } = await res.json();
  if (typeof text !== "string" || !text.trim()) throw new Error("empty scan");
  return text;
}
