// Dev-only: extract + parse multiple PDFs, cluster questions across them, and
// print clusters that repeat across papers (the core value of the product).
// Usage: node scripts/test-cluster.mjs "<pdf1>" "<pdf2>" ...
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "node:fs";
import { parsePaper } from "../src/engine/parsePaper.js";
import { clusterQuestions } from "../src/engine/cluster.js";

async function extract(path) {
  const data = new Uint8Array(readFileSync(path));
  const doc = await getDocument({ data, useSystemFonts: true }).promise;
  let out = "";
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
    out += lines.join("\n") + "\n";
  }
  return out;
}

const items = [];
for (const path of process.argv.slice(2)) {
  const { meta, questions } = parsePaper(await extract(path));
  const paperId = `${meta.session} ${meta.year}`;
  for (const q of questions) items.push({ ...q, paperId, year: meta.year });
}
console.log(`Parsed ${items.length} questions from ${process.argv.length - 2} papers.\n`);

const clusters = await clusterQuestions(items, 0.55);
// distinct papers per cluster = how often the concept repeats
const ranked = clusters
  .map((c) => ({ c, papers: new Set(c.items.map((i) => i.paperId)).size }))
  .sort((a, b) => b.papers - a.papers || b.c.items.length - a.c.items.length);

console.log("=== CLUSTERS THAT REPEAT ACROSS PAPERS ===");
for (const { c, papers } of ranked) {
  if (papers < 2) continue;
  console.log(`\n• repeats in ${papers} papers (${c.items.length} questions):`);
  for (const it of c.items) console.log(`    [${it.paperId} ${it.id}] ${it.text.slice(0, 90)}`);
}
