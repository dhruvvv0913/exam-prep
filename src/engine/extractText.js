// PDF → plain text, in the browser, using pdfjs-dist.
// We reconstruct lines from text-item positions (pdfjs gives us loose runs of
// text with x/y coords, not lines), because the parser works line-by-line.
import * as pdfjs from "pdfjs-dist";
// Vite-friendly worker import: gives us a URL string for the worker bundle.
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { assessText } from "./textQuality.js";
import { splitQuestions } from "./parsePaper.js";
import { ocrDocument } from "./ocr.js";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

// Turn one page's text items into newline-separated lines.
function itemsToLines(items) {
  const lines = [];
  let line = "";
  let lastY = null;
  for (const item of items) {
    const y = item.transform[5];
    if (lastY !== null && Math.abs(y - lastY) > 2) {
      lines.push(line);
      line = "";
    }
    line += item.str;
    if (item.hasEOL) {
      lines.push(line);
      line = "";
      lastY = null;
    } else {
      lastY = y;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function readTextLayer(doc) {
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    pages.push(itemsToLines(content.items).join("\n"));
  }
  return pages.join("\n\n");
}

// Extract the full text of a PDF given as an ArrayBuffer / Uint8Array.
// Returns { text, method: "text" | "ocr" }. `onOcrProgress(done, total)` is
// optional, for the loading UI.
//
// Strategy (accuracy over speed — leaving questions behind is the worst outcome):
//   - We trust the text layer as-is only if it's CLEARLY clean (common-word
//     ratio >= 0.15) AND already yields a sensible number of questions. A
//     mediocre scan can score a high word-ratio yet be badly structured (few
//     questions parse) — that no longer fools us.
//   - Otherwise (empty / garbled / okish / under-parsed) we ALSO run a high-res
//     OCR and keep whichever recovers MORE questions (then better word quality).
const CLEAN_RATIO = 0.15;   // low end of clean born-digital prose (0.15–0.35)
const MIN_QUESTIONS = 5;    // a real paper parses to at least a handful of units

export async function extractText(data, { onOcrProgress } = {}) {
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const text = await readTextLayer(doc);
  const tlA = assessText(text);
  const tlQ = splitQuestions(text).length;
  if (tlA.usable && tlA.ratio >= CLEAN_RATIO && tlQ >= MIN_QUESTIONS) return { text, method: "text" };

  // Recover with high-res OCR, then keep whichever yields more questions.
  const ocrText = await ocrDocument(doc, { onProgress: onOcrProgress });
  const ocrQ = splitQuestions(ocrText).length;
  const ocrRatio = assessText(ocrText).ratio;
  const ocrWins = ocrQ > tlQ || (ocrQ === tlQ && ocrRatio >= tlA.ratio);
  return ocrWins ? { text: ocrText, method: "ocr" } : { text, method: "text" };
}
