// Validate the "Improve result" refine pass: feed a deliberately-imperfect
// grouping and confirm the LLM audit moves the misfit, merges the duplicate,
// and fixes the bad label. node --env-file=.env scripts/test-refine.mjs
import { buildRefinePrompt, chapterToDeck } from "../src/engine/aiPrompt.js";

const Q = [
  "Explain direct mapping in cache memory with a neat diagram.",                 // 1 cache
  "A cache has 90% hit ratio, 10ns hit time, 100ns on miss; find avg access time.", // 2 cache
  "Compare direct, associative and set-associative cache mapping techniques.",   // 3 cache
  "Multiply -7 x 3 using Booth's multiplication algorithm, show the table.",     // 4 BOOTH (misfiled in cache below)
  "Write the steps of Booth's multiplication algorithm with a flowchart.",       // 5 BOOTH (lonely, bad label)
  "Explain immediate, indirect and indexed addressing modes with examples.",     // 6 addressing
  "Evaluate the effective address for indexed addressing given the registers.",  // 7 addressing
  "Differentiate Von Neumann and Harvard architecture.",                          // 8 architecture
];
const current = [
  { topic: "Cache Memory", chapter: null, ids: [1, 2, 3, 4] }, // 4 is a Booth Q wrongly here
  { topic: "stuff", chapter: null, ids: [5] },                  // bad label, should be Booth + merge w/ 4
  { topic: "Addressing modes", chapter: null, ids: [6, 7] },
  { topic: "Architecture", chapter: null, ids: [8] },
];

const key = process.env.GEMINI_API_KEY;
if (!key) { console.error("no GEMINI_API_KEY"); process.exit(1); }
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: buildRefinePrompt(Q.map((t) => ({ text: t })), current, []) }] }], generationConfig: { temperature: 0, maxOutputTokens: 16384, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } } }) });
const d = await r.json();
const raw = (d.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
const parsed = JSON.parse((raw.match(/\{[\s\S]*\}/) || [raw])[0]);

console.log("=== BEFORE ===");
for (const g of current) console.log(`  [${g.topic}] ${g.ids.join(", ")}`);
console.log("\n=== AFTER (refined) ===");
for (const g of parsed.groups) console.log(`  [${g.topic}] ${(g.ids || []).join(", ")}`);

// Checks
const find = (id) => parsed.groups.find((g) => (g.ids || []).includes(id));
const booth4 = find(4), booth5 = find(5);
console.log("\n=== CHECKS ===");
console.log(booth4 && booth5 && booth4 === booth5 ? "✓ Booth Qs 4 & 5 now grouped together" : "✗ Booth Qs 4 & 5 NOT merged");
console.log(/booth/i.test(booth4?.topic || "") ? `✓ that group is labelled Booth ("${booth4.topic}")` : `✗ Booth group label is "${booth4?.topic}"`);
const cache = parsed.groups.find((g) => /cache/i.test(g.topic));
console.log(cache && !cache.ids.includes(4) ? "✓ Booth Q4 removed from the Cache group" : "✗ Q4 still in Cache");
const allIds = parsed.groups.flatMap((g) => g.ids || []).sort((a, b) => a - b);
console.log(JSON.stringify(allIds) === JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8]) ? "✓ every question accounted for exactly once" : `✗ id coverage off: ${allIds}`);
