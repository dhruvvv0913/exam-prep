// Dev-only: OCR the EOD screenshot sets listed in samples/eod_sample, parse +
// cluster them, and print the grouping. Real-world test of the pipeline on
// image-based papers across multiple years.
import { readFileSync, writeFileSync } from "node:fs";
import { createWorker } from "tesseract.js";
import { env } from "@xenova/transformers";
import { parsePaper } from "../src/engine/parsePaper.js";
import { embed, clusterVectors } from "../src/engine/cluster.js";

// Load the self-hosted model from the filesystem in Node.
env.localModelPath = "./public/models/";

const DIR = "C:/Users/KIIT/OneDrive/Documents/Pictures/Screenshots";
const raw = readFileSync("samples/eod_sample", "utf8");

// Each numbered line is one document; collect its page filenames.
const docs = [];
for (const line of raw.split("\n")) {
  if (!/^\s*\d+\s*\.?/.test(line)) continue;
  const pages = [...line.matchAll(/Screenshot 2026-06-04 \d+\.png/g)].map((m) => m[0]);
  if (pages.length) docs.push(pages);
}
console.log(`Found ${docs.length} documents, ${docs.reduce((n, d) => n + d.length, 0)} pages total.\n`);

const worker = await createWorker("eng");
const items = [];
for (let d = 0; d < docs.length; d++) {
  let text = "";
  for (const page of docs[d]) {
    const { data } = await worker.recognize(`${DIR}/${page}`);
    text += data.text + "\n";
  }
  const { meta, questions } = parsePaper(text);
  const paperId = `Doc${d + 1}${meta.year ? ` ${meta.year}` : ""}`;
  console.error(`  Doc${d + 1}: ${meta.examType ?? "?"} ${meta.year ?? "?"} | ${meta.subject ?? "?"} | ${questions.length} questions`);
  for (const q of questions) items.push({ ...q, paperId, year: meta.year, pIdx: d });
}
await worker.terminate();

// Cache the OCR'd questions so threshold tuning doesn't need to re-OCR.
writeFileSync("scripts/eod-items.json", JSON.stringify(items));
console.log(`\nCached ${items.length} questions to scripts/eod-items.json`);

console.log(`\nClustering ${items.length} questions across ${docs.length} docs...\n`);
const vecs = await embed(items.map((i) => i.text));
const clusters = clusterVectors(items, vecs); // default threshold 0.72

const withCount = clusters.map((c) => ({ c, papers: new Set(c.items.map((i) => i.paperId)).size }));
withCount.sort((a, b) => b.papers - a.papers || b.c.items.length - a.c.items.length);

console.log("===== GROUPS THAT REPEAT ACROSS DOCS =====");
for (const { c, papers } of withCount) {
  if (papers < 2) continue;
  console.log(`\n• repeats in ${papers} docs (${c.items.length} questions):`);
  for (const it of c.items) console.log(`    [${it.paperId} ${it.id}] ${it.text.slice(0, 85)}`);
}
console.log(`\n===== asked once: ${withCount.filter((x) => x.papers < 2).length} groups =====`);
