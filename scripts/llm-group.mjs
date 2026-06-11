// Admin-only, high-accuracy grouping via an LLM (the "deep-grouping" pass).
//
// Parses the exam papers + slide decks LOCALLY (reusing the real engine), then
// asks an LLM to group every question under the right syllabus chapter — with
// human-level judgment the embedding pass can't match: correct chapter for each
// question, variants merged, clean labels, OCR garble tidied, genuinely
// off-syllabus questions flagged. Output is the app's `groups` JSON, ready to
// publish to the library.
//
// Provider-agnostic. Default is Google Gemini's FREE tier (no credit card):
// get a key at https://aistudio.google.com/apikey and put it in .env as
// GEMINI_API_KEY=... (gitignored). Load .env with Node's --env-file:
//
//   node --env-file=.env scripts/llm-group.mjs --manifest=samples/coa_sample
//   node --env-file=.env scripts/llm-group.mjs <slides...> -- <papers...> \
//        [--provider=gemini|groq|ollama|openai|anthropic] [--model=...] [--out=...]
//
// Free options: gemini (free key) · groq (free key, Llama-70B) · ollama (local,
// fully free+offline, needs `ollama serve`). Paid: anthropic (Claude), openai.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync, writeFileSync } from "node:fs";
import { createCanvas } from "@napi-rs/canvas";
import { createWorker } from "tesseract.js";
import { parsePaper } from "../src/engine/parsePaper.js";
import { isUsableText } from "../src/engine/textQuality.js";
import { extractDeckTopics, deckLabel } from "../src/engine/slides.js";
import { buildGroupingPrompt, chapterToDeck } from "../src/engine/aiPrompt.js";

// ---- LLM providers (same prompt + JSON parsing; only the HTTP call differs) ----
async function openaiChat(url, prompt, model, key) {
  const r = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0, max_tokens: 8192, response_format: { type: "json_object" } }),
  });
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  return (await r.json()).choices?.[0]?.message?.content || "";
}
const PROVIDERS = {
  gemini: {
    env: "GEMINI_API_KEY", model: "gemini-2.5-flash",
    async call(prompt, model, key) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const r = await fetch(url, {
        method: "POST", headers: { "content-type": "application/json" },
        // thinkingBudget:0 turns OFF 2.5-flash "thinking" — for a structured
        // grouping task it isn't needed and was eating the output budget,
        // truncating the JSON. responseMimeType keeps the reply pure JSON.
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0, maxOutputTokens: 32768, responseMimeType: "application/json", ...(/2\.5/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}) } }),
      });
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
      const d = await r.json();
      const reason = d.candidates?.[0]?.finishReason;
      if (reason && reason !== "STOP") console.error(`  (gemini finishReason=${reason})`);
      return (d.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
    },
  },
  groq: {
    env: "GROQ_API_KEY", model: "llama-3.3-70b-versatile",
    call: (p, m, k) => openaiChat("https://api.groq.com/openai/v1/chat/completions", p, m, k),
  },
  openai: {
    env: "OPENAI_API_KEY", model: "gpt-4o-mini",
    call: (p, m, k) => openaiChat("https://api.openai.com/v1/chat/completions", p, m, k),
  },
  anthropic: {
    env: "ANTHROPIC_API_KEY", model: "claude-sonnet-4-6",
    async call(prompt, model, key) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 8192, messages: [{ role: "user", content: prompt }] }),
      });
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
      return ((await r.json()).content || []).map((b) => b.text || "").join("");
    },
  },
  ollama: {
    env: null, model: "llama3.1",
    async call(prompt, model) {
      const r = await fetch("http://localhost:11434/api/generate", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ model, prompt, stream: false, format: "json", options: { temperature: 0 } }),
      });
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()} (is 'ollama serve' running?)`);
      return (await r.json()).response || "";
    },
  },
};

// ---- PDF I/O (Node side; the browser uses src/engine/extractText + ocr) ----
async function textLayer(doc) {
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    let line = "", lastY = null; const lines = [];
    for (const it of content.items) {
      const y = it.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) { lines.push(line); line = ""; }
      line += it.str;
      if (it.hasEOL) { lines.push(line); line = ""; lastY = null; } else lastY = y;
    }
    if (line) lines.push(line);
    pages.push(lines.join("\n"));
  }
  return pages;
}
async function ocr(doc) {
  const worker = await createWorker("eng");
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 2 });
    const canvas = createCanvas(vp.width, vp.height);
    await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
    const { data } = await worker.recognize(canvas.toBuffer("image/png"));
    pages.push(data.text);
  }
  await worker.terminate();
  return pages;
}
const load = async (path) => getDocument({ data: new Uint8Array(readFileSync(path)), useSystemFonts: true }).promise;
const readPages = async (path) => {
  let pages = await textLayer(await load(path)); let method = "text";
  if (!isUsableText(pages.join("\n"))) { pages = await ocr(await load(path)); method = "ocr"; }
  return { pages, method };
};

// ---- args ----
const args = process.argv.slice(2);
const opt = (name, def) => { const a = args.find((x) => x.startsWith(`--${name}=`)); return a ? a.split("=")[1] : def; };
const providerName = opt("provider", "gemini");
const provider = PROVIDERS[providerName];
if (!provider) { console.error(`Unknown --provider=${providerName}. Options: ${Object.keys(PROVIDERS).join(", ")}`); process.exit(1); }
const model = opt("model", provider.model);
const outPath = opt("out", "scripts/llm-groups.out.json");
const manifest = opt("manifest", null);

let slidePaths, paperPaths;
if (manifest) {
  // Pull every file path out of the manifest; the comment line mentioning
  // "ppt"/"slide" divides papers (before) from slide decks (after).
  const PATH = /[a-zA-Z]:\\[^\r\n]*?\.(?:pdf|png|jpe?g|webp)(?=\s|$)/gi;
  const papers = [], slides = [];
  let bucket = papers;
  for (const line of readFileSync(manifest, "utf8").split(/\r?\n/)) {
    if (/^\s*\/\//.test(line)) { if (/\b(ppt|slide|deck)/i.test(line)) bucket = slides; continue; }
    for (const m of line.match(PATH) || []) bucket.push(m.trim());
  }
  slidePaths = slides; paperPaths = papers;
  console.error(`Manifest: ${paperPaths.length} papers, ${slidePaths.length} slide decks`);
} else {
  const flag = (a) => a.startsWith("--");
  const sep = args.indexOf("--");
  slidePaths = (sep >= 0 ? args.slice(0, sep) : []).filter((a) => !flag(a));
  paperPaths = (sep >= 0 ? args.slice(sep + 1) : args).filter((a) => !flag(a));
}

if (!paperPaths.length) { console.error("usage: node --env-file=.env scripts/llm-group.mjs <slides...> -- <papers...>   (or --manifest=samples/coa_sample)"); process.exit(1); }
const apiKey = provider.env ? process.env[provider.env] : null;
if (provider.env && !apiKey) { console.error(`Missing ${provider.env} (put it in .env and run with --env-file=.env)`); process.exit(1); }

// ---- 1) slides -> deck topics (the candidate chapter labels) ----
const decks = [];
for (const sp of slidePaths) {
  try { decks.push({ label: deckLabel(sp), slides: (await readPages(sp)).pages }); }
  catch (e) { console.error(`  ! skip slides ${sp.split(/[\\/]/).pop()}: ${e.message}`); }
}
const { deckOf } = slidePaths.length ? extractDeckTopics(decks) : { deckOf: [] };
const chapters = [...new Set(deckOf)];
console.error(`Slides: ${decks.length} deck(s) -> ${chapters.length} chapters`);

// ---- 2) papers -> question items ----
const items = [];
for (let i = 0; i < paperPaths.length; i++) {
  try {
    const { pages, method } = await readPages(paperPaths[i]);
    const { meta, questions } = parsePaper(pages.join("\n"));
    const paperId = `${meta.session ?? meta.examType ?? "Paper"} ${meta.year ?? i + 1}`;
    console.error(`  ${paperPaths[i].split(/[\\/]/).pop()} [${method}] -> ${questions.length} questions`);
    for (const q of questions) items.push({ ...q, paperId, year: meta.year ?? null, pIdx: i });
  } catch (e) {
    console.error(`  ! skip paper ${paperPaths[i].split(/[\\/]/).pop()}: ${e.message}`);
  }
}
if (!items.length) { console.error("No questions parsed — nothing to group."); process.exit(1); }

// ---- 3) ask the LLM to group (shared prompt with the in-app proxy) ----
const prompt = buildGroupingPrompt(items, chapters);

console.error(`\nAsking ${providerName} (${model}) to group ${items.length} questions...`);
let raw;
try { raw = await provider.call(prompt, model, apiKey); }
catch (e) { console.error(`LLM call failed: ${e.message}`); process.exit(1); }

// Tolerate ```json fences / stray prose around the object.
const jsonStr = (raw.match(/\{[\s\S]*\}/) || [raw])[0];
let parsed;
try { parsed = JSON.parse(jsonStr); }
catch (e) { console.error("Could not parse model JSON:\n" + raw); process.exit(1); }

// ---- 4) map ids back to questions -> app `groups` format ----
// Each group is a FINE question-type tagged with its `deck` (chapter/PPT), the
// same shape the in-app AI path and the two analysis views consume.
const hasChapters = chapters.length > 0;
const toItem = (q) => ({ uid: `${q.pIdx}__${q.id}`, pIdx: q.pIdx, id: q.id, text: q.text, paperId: q.paperId, year: q.year, marks: q.marks ?? 5 });
const used = new Set();
const groups = (parsed.groups || [])
  .map((g, gi) => {
    const its = (g.ids || [])
      .map((n) => items[n - 1])
      .filter((q) => q && !used.has(q))
      .map((q) => { used.add(q); return toItem(q); });
    return { id: `g${gi}`, topic: String(g.topic || "Topic"), deck: chapterToDeck(g.chapter, hasChapters), items: its };
  })
  .filter((g) => g.items.length > 0);

// Safety net: any question the model dropped goes to "Ungrouped".
const missed = items.filter((q) => !used.has(q));
if (missed.length) {
  groups.push({ id: `g${groups.length}`, topic: "Ungrouped", deck: hasChapters ? "Not on any PPT" : null, items: missed.map(toItem) });
  console.error(`  (model dropped ${missed.length} question(s) -> Ungrouped)`);
}

writeFileSync(outPath, JSON.stringify({ groups }, null, 2));
console.error(`\nWrote ${groups.length} groups (${items.length} questions) -> ${outPath}`);

// Print grouped by chapter (the "By PPT" view) so the structure is easy to eyeball.
const exams = (g) => new Set(g.items.map((it) => it.pIdx)).size;
const byDeck = new Map();
for (const g of groups) { const d = g.deck ?? "(no chapter)"; (byDeck.get(d) || byDeck.set(d, []).get(d)).push(g); }
console.log("\n=== GROUPS BY CHAPTER ===");
for (const [deck, gs] of [...byDeck.entries()].sort((a, b) => (a[0] === "Not on any PPT") - (b[0] === "Not on any PPT"))) {
  console.log(`\n>>> ${deck}  (${gs.length} types · ${gs.reduce((s, g) => s + g.items.length, 0)} Qs)`);
  for (const g of gs.slice().sort((a, b) => exams(b) - exams(a) || b.items.length - a.items.length)) {
    console.log(`   • ${g.topic}  [${exams(g)}x exams · ${g.items.length} Qs]`);
    for (const it of g.items) console.log(`       (${it.paperId}) ${it.text.slice(0, 78)}`);
  }
}
