// PDF → plain text, in the browser, using pdfjs-dist.
// We reconstruct lines from text-item positions (pdfjs gives us loose runs of
// text with x/y coords, not lines), because the parser works line-by-line.
import * as pdfjs from "pdfjs-dist";
// Vite-friendly worker import: gives us a URL string for the worker bundle.
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { assessText } from "./textQuality.js";
import { splitQuestions } from "./parsePaper.js";
import { ocrDocument, renderPageImages } from "./ocr.js";
import { sniffPdf, notPdfMessage } from "./pdfSniff.js";

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

export async function extractText(data, { onOcrProgress, aiScan, onAiScan, name } = {}) {
  // Catch not-actually-a-PDF uploads (e.g. a portal's HTML login page saved as
  // .pdf — a real failure mode on the campus network) BEFORE pdf.js throws its
  // opaque "Invalid PDF structure.", so the user gets an actionable message.
  // A PDF with junk bytes prepended is recovered by slicing to the real header.
  const sniff = sniffPdf(data);
  if (sniff.kind !== "pdf") throw new Error(notPdfMessage(sniff.kind, name));
  if (sniff.offset > 0) data = (data instanceof Uint8Array ? data : new Uint8Array(data)).subarray(sniff.offset);
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const text = await readTextLayer(doc);
  const tlA = assessText(text);
  const tlQ = splitQuestions(text).length;
  if (tlA.usable && tlA.ratio >= CLEAN_RATIO && tlQ >= MIN_QUESTIONS) return { text, method: "text" };

  // Recover with high-res OCR, then keep whichever yields more questions.
  const ocrText = await ocrDocument(doc, { onProgress: onOcrProgress });
  const ocrQ = splitQuestions(ocrText).length;
  const ocrA = assessText(ocrText);
  const ocrWins = ocrQ > tlQ || (ocrQ === tlQ && ocrA.ratio >= tlA.ratio);
  const best = ocrWins
    ? { text: ocrText, method: "ocr", q: ocrQ, usable: ocrA.usable }
    : { text, method: "text", q: tlQ, usable: tlA.usable };

  // Signed-in users (aiScan provided) get the VISION read whenever the paper was
  // SCANNED (OCR path), under-parsed, OR the winning read is still garbled
  // (unusable word-ratio — a junk text layer can "win" the OCR comparison with
  // enough phantom question markers yet contain no real prose; without the
  // usable check such papers skipped their AI rescue). "Keep whichever finds
  // more questions" means it can only improve the result, never worsen it;
  // falls back silently on any failure / quota. (Born-digital papers with a
  // clean text layer returned above and never reach here, so they skip it.)
  if (aiScan && (best.method === "ocr" || best.q < MIN_QUESTIONS || !best.usable)) {
    try {
      onAiScan?.();
      const aiText = await aiScan(await renderPageImages(doc));
      if (splitQuestions(aiText).length > best.q) return { text: aiText, method: "ai" };
    } catch (e) { console.error("AI scan failed; using local extraction", e); }
  }
  return { text: best.text, method: best.method };
}
