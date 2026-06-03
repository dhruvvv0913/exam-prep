// PDF → plain text, in the browser, using pdfjs-dist.
// We reconstruct lines from text-item positions (pdfjs gives us loose runs of
// text with x/y coords, not lines), because the parser works line-by-line.
import * as pdfjs from "pdfjs-dist";
// Vite-friendly worker import: gives us a URL string for the worker bundle.
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { isUsableText } from "./textQuality.js";
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

// Extract the full text of a PDF given as an ArrayBuffer / Uint8Array.
// Tries the embedded text layer first; if it's empty or garbled (a scan),
// falls back to OCR. Returns { text, method: "text" | "ocr" }.
// `onOcrProgress(done, total)` is optional, for the loading UI.
export async function extractText(data, { onOcrProgress } = {}) {
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    pages.push(itemsToLines(content.items).join("\n"));
  }
  const text = pages.join("\n\n");

  if (isUsableText(text)) return { text, method: "text" };
  // Scanned / image-only PDF: recover it with OCR.
  const ocrText = await ocrDocument(doc, { onProgress: onOcrProgress });
  return { text: ocrText, method: "ocr" };
}
