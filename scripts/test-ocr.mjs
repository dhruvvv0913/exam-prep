// Dev-only: prove OCR recovers an image-only scanned paper.
// Renders each PDF page to an image (via @napi-rs/canvas) and OCRs it
// (tesseract.js), then runs the parser on the recovered text.
// Usage: node scripts/test-ocr.mjs "<pdf>"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "node:fs";
import { createCanvas } from "@napi-rs/canvas";
import { createWorker } from "tesseract.js";
import { parsePaper } from "../src/engine/parsePaper.js";

const path = process.argv[2];
const data = new Uint8Array(readFileSync(path));
const doc = await getDocument({ data, useSystemFonts: true }).promise;
const worker = await createWorker("eng");

let text = "";
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const viewport = page.getViewport({ scale: 2 }); // 2x = sharper text for OCR
  const canvas = createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext("2d");
  await page.render({ canvasContext: ctx, viewport }).promise;
  const png = canvas.toBuffer("image/png");
  const { data: { text: t } } = await worker.recognize(png);
  text += t + "\n";
  console.error(`  OCR page ${p}/${doc.numPages} -> ${t.length} chars`);
}
await worker.terminate();

const { meta, questions } = parsePaper(text);
console.log("\nMETA:", JSON.stringify(meta));
console.log(`QUESTIONS (${questions.length}):`);
for (const q of questions) console.log(`  [${q.id}] ${q.text}`);
