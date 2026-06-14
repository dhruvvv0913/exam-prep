// Shared PDF extraction for the dev harnesses — mirrors src/engine/extractText
// so Node runs reflect production: a clearly-clean text layer is used as-is,
// otherwise we high-res OCR and keep whichever recovers MORE questions.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "node:fs";
import { createCanvas } from "@napi-rs/canvas";
import { createWorker } from "tesseract.js";
import { assessText } from "../src/engine/textQuality.js";
import { splitQuestions } from "../src/engine/parsePaper.js";

const load = (path) => getDocument({ data: new Uint8Array(readFileSync(path)), useSystemFonts: true }).promise;

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
  return pages.join("\n\n");
}

async function ocr(doc) {
  const worker = await createWorker("eng");
  const out = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const baseW = page.getViewport({ scale: 1 }).width || 595;
    const s = Math.min(4, Math.max(2, 2200 / baseW)); // hi-res, matches production ocr.js
    const vp = page.getViewport({ scale: s });
    const canvas = createCanvas(vp.width, vp.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, vp.width, vp.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const { data } = await worker.recognize(canvas.toBuffer("image/png"));
    out.push(data.text);
  }
  await worker.terminate();
  return out.join("\n\n");
}

// { text, method, ratio, tlQ, ocrQ } — the chosen text + diagnostics.
export async function readPagesSmart(path) {
  const doc = await load(path);
  const tl = await textLayer(doc);
  const tlA = assessText(tl);
  const tlQ = splitQuestions(tl).length;
  if (tlA.usable && tlA.ratio >= 0.15 && tlQ >= 5) return { text: tl, method: "text", ratio: +tlA.ratio.toFixed(3), tlQ, ocrQ: null };
  const o = await ocr(doc);
  const ocrQ = splitQuestions(o).length;
  const ocrWins = ocrQ > tlQ || (ocrQ === tlQ && assessText(o).ratio >= tlA.ratio);
  return { text: ocrWins ? o : tl, method: ocrWins ? "ocr" : "text", ratio: +tlA.ratio.toFixed(3), tlQ, ocrQ };
}
