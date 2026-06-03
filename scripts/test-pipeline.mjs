// Dev-only: run the FULL real pipeline in Node across several PDFs and print
// ranked repeats. Uses node-side extraction/OCR (browser uses src/engine/*),
// but the parse -> cluster -> rank stages are the exact production modules.
// Usage: node scripts/test-pipeline.mjs "<pdf1>" "<pdf2>" ...
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "node:fs";
import { createCanvas } from "@napi-rs/canvas";
import { createWorker } from "tesseract.js";
import { parsePaper } from "../src/engine/parsePaper.js";
import { isUsableText } from "../src/engine/textQuality.js";
import { clusterQuestions } from "../src/engine/cluster.js";
import { rankClusters } from "../src/engine/rank.js";

async function textLayer(doc) {
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

async function ocr(doc) {
  const worker = await createWorker("eng");
  let out = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 2 });
    const canvas = createCanvas(vp.width, vp.height);
    await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
    const { data } = await worker.recognize(canvas.toBuffer("image/png"));
    out += data.text + "\n";
  }
  await worker.terminate();
  return out;
}

const items = [];
for (const path of process.argv.slice(2)) {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(path)), useSystemFonts: true }).promise;
  let text = await textLayer(doc);
  let method = "text";
  if (!isUsableText(text)) { text = await ocr(doc); method = "ocr"; }
  const { meta, questions } = parsePaper(text);
  const paperId = `${meta.session ?? meta.examType} ${meta.year}`;
  console.error(`  ${path.split(/[\\/]/).pop()} [${method}] -> ${meta.subject} | ${questions.length} questions`);
  for (const q of questions) items.push({ ...q, paperId, year: meta.year, marks: meta.fullMarks === 50 ? "5 marks" : "" });
}

console.log(`\nClustering ${items.length} questions...`);
const clusters = await clusterQuestions(items);
const { ranked, unique } = rankClusters(clusters);

console.log(`\n=== RANKED IMPORTANT QUESTIONS (${ranked.length} repeated concepts) ===`);
ranked.forEach((c, i) => {
  console.log(`\n#${i + 1}  [${c.topic}]  appears ${c.appears}x · ${c.variants} variants`);
  console.log(`    Q: ${c.q.slice(0, 100)}`);
  for (const s of c.similars) console.log(`     ↳ (${s.src}) ${s.text.slice(0, 70)}`);
});
console.log(`\n=== asked once (${unique.length}) ===`);
for (const c of unique) console.log(`   [${c.topic}] ${c.q.slice(0, 70)}`);
