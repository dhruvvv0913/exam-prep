// Dev diagnostic: per-paper question count + marks breakdown + grand total,
// to debug the "total marks looks wrong" report. Mirrors the production marks
// path (parsePaper) on Node-side extraction.
//   node scripts/test-marks.mjs "<pdf1>" "<pdf2>" ...
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "node:fs";
import { createCanvas } from "@napi-rs/canvas";
import { createWorker } from "tesseract.js";
import { parsePaper, splitQuestions } from "../src/engine/parsePaper.js";
import { assessText } from "../src/engine/textQuality.js";

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
    // Match the browser's resolution-aware OCR scale (ocr.js): ~300 DPI, capped
    // 2–4×. Rendering scans too small (e.g. a flat scale 2) loses whole papers.
    const baseW = page.getViewport({ scale: 1 }).width || 595;
    const s = Math.min(4, Math.max(2, 2200 / baseW));
    const vp = page.getViewport({ scale: s });
    const canvas = createCanvas(vp.width, vp.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, vp.width, vp.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const { data } = await worker.recognize(canvas.toBuffer("image/png"));
    out += data.text + "\n";
  }
  await worker.terminate();
  return out;
}

let grand = 0, grandQ = 0;
for (const path of process.argv.slice(2)) {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(path)), useSystemFonts: true }).promise;
  // Mirror src/engine/extractText.js: trust the text layer only if it's clearly
  // clean AND yields a sensible number of questions; otherwise OCR and keep
  // whichever recovers more questions (then better word quality).
  let text = await textLayer(doc); let method = "text";
  const tlA = assessText(text); const tlQ = splitQuestions(text).length;
  if (!(tlA.usable && tlA.ratio >= 0.15 && tlQ >= 5)) {
    const ocrText = await ocr(doc);
    const ocrQ = splitQuestions(ocrText).length;
    const ocrRatio = assessText(ocrText).ratio;
    if (ocrQ > tlQ || (ocrQ === tlQ && ocrRatio >= tlA.ratio)) { text = ocrText; method = "ocr"; }
  }
  const { meta, questions } = parsePaper(text);
  const total = questions.reduce((s, q) => s + (q.marks || 0), 0);
  grand += total; grandQ += questions.length;
  console.log(`\n=== ${path.split(/[\\/]/).pop()} [${method}] — ${meta.examType || "?"} ${meta.year || "?"} | ${questions.length} questions | ${total} marks total ===`);
  for (const q of questions) console.log(`   Q${(q.id || "").padEnd(4)} ${String(q.marks).padStart(2)}m  ${q.text.replace(/\s+/g, " ").slice(0, 64)}`);
}
console.log(`\n>>> GRAND: ${grandQ} questions, ${grand} marks across ${process.argv.slice(2).length} papers`);
