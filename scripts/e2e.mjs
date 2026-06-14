// END-TO-END, as a student would experience it: extract (smart: text layer or
// high-res OCR, keep the richer) -> parse -> LLM-group every question under its
// chapter. Reports per-paper extraction completeness + the important questions.
//   node --env-file=.env scripts/e2e.mjs samples/coa_sample
import { readFileSync } from "node:fs";
import { parsePaper } from "../src/engine/parsePaper.js";
import { extractDeckTopics, deckLabel } from "../src/engine/slides.js";
import { buildGroupingPrompt, chapterToDeck } from "../src/engine/aiPrompt.js";
import { readPagesSmart } from "./lib-extract.mjs";

const manifestPath = process.argv[2] || "samples/coa_sample";
const PATH = /[a-zA-Z]:\\[^\r\n]*?\.(?:pdf|png|jpe?g|webp)(?=\s|$)/gi;
const papers = [], slides = [];
let bucket = papers;
for (const line of readFileSync(manifestPath, "utf8").split(/\r?\n/)) {
  if (/^\s*\/\//.test(line)) { if (/\b(ppt|slide|deck)/i.test(line)) bucket = slides; continue; }
  for (const m of line.match(PATH) || []) bucket.push(m.trim());
}
console.log(`Manifest: ${papers.length} papers, ${slides.length} decks\n`);

// --- papers: smart extract + parse, with per-paper completeness diagnostics ---
const items = [];
console.log("PAPER".padEnd(24) + "METHOD  RATIO  tlQ  ocrQ  ->Q");
for (let i = 0; i < papers.length; i++) {
  const name = papers[i].split(/[\\/]/).pop();
  try {
    const r = await readPagesSmart(papers[i]);
    const { meta, questions } = parsePaper(r.text);
    const paperId = `${meta.session ?? meta.examType ?? "Paper"} ${meta.year ?? i + 1}`;
    for (const q of questions) items.push({ ...q, paperId, year: meta.year ?? null, pIdx: i });
    console.log(name.slice(0, 23).padEnd(24) + `${r.method.padEnd(7)} ${String(r.ratio).padEnd(6)} ${String(r.tlQ).padEnd(4)} ${String(r.ocrQ ?? "-").padEnd(5)} ${questions.length}${meta.solution ? "  [solution sheet]" : ""}`);
  } catch (e) { console.log(name.slice(0, 23).padEnd(24) + "FAILED: " + e.message); }
}
console.log(`\nTotal questions parsed: ${items.length}\n`);

// --- slides -> chapters ---
const decks = [];
for (const sp of slides) {
  try { const r = await readPagesSmart(sp); decks.push({ label: deckLabel(sp), slides: r.text.split(/\n\s*\n/).filter((c) => c.trim()) }); } catch {}
}
const { deckOf } = slides.length ? extractDeckTopics(decks) : { deckOf: [] };
const chapters = [...new Set(deckOf)];
console.log(`Chapters (${chapters.length}): ${chapters.join(" · ")}\n`);

// --- LLM group (the signed-in / recommended path) ---
const key = process.env.GEMINI_API_KEY;
if (!key) { console.log("(no GEMINI_API_KEY — skipped LLM grouping)"); process.exit(0); }
const model = "gemini-2.5-flash";
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
const resp = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: buildGroupingPrompt(items, chapters) }] }], generationConfig: { temperature: 0, maxOutputTokens: 32768, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } } }) });
const d = await resp.json();
const raw = (d.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
let parsed; try { parsed = JSON.parse((raw.match(/\{[\s\S]*\}/) || [raw])[0]); } catch { console.error("LLM JSON parse failed:\n" + raw.slice(0, 400)); process.exit(1); }

const used = new Set();
const groups = (parsed.groups || []).map((g) => ({
  topic: String(g.topic || "Topic"),
  deck: chapterToDeck(g.chapter, chapters.length > 0),
  items: (g.ids || []).map((n) => items[n - 1]).filter((q) => q && !used.has(q)).map((q) => { used.add(q); return q; }),
})).filter((g) => g.items.length);
const missed = items.filter((q) => !used.has(q));
if (missed.length) groups.push({ topic: "Ungrouped", deck: chapters.length ? "Not on any PPT" : null, items: missed });

const exams = (g) => new Set(g.items.map((it) => it.pIdx)).size;
const byDeck = new Map();
for (const g of groups) { const k = g.deck ?? "(none)"; if (!byDeck.has(k)) byDeck.set(k, []); byDeck.get(k).push(g); }
console.log("=== IMPORTANT QUESTIONS (LLM, grouped by chapter) ===");
for (const [deck, gs] of [...byDeck.entries()].sort((a, b) => (a[0] === "Not on any PPT") - (b[0] === "Not on any PPT"))) {
  console.log(`\n>>> ${deck}  (${gs.reduce((n, g) => n + g.items.length, 0)} Qs)`);
  for (const g of gs.sort((a, b) => exams(b) - exams(a) || b.items.length - a.items.length)) console.log(`   • ${g.topic}  [${exams(g)}x exams · ${g.items.length} Qs]`);
}
console.log(`\nGrouped ${items.length} questions into ${groups.length} types${missed.length ? ` (${missed.length} ungrouped — every question is still accounted for)` : " — every question accounted for"}.`);
