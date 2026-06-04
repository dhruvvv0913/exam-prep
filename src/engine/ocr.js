// OCR fallback for scanned / image-only PDFs, in the browser.
// We render each PDF page to a canvas with pdfjs, then read the pixels with
// tesseract.js (free, local, no API). Used only when the embedded text layer
// is empty or garbled — see textQuality.assessText.
import { createWorker } from "tesseract.js";

// Self-hosted worker/core/lang (public/tesseract) so OCR works on networks
// that block CDNs — same reason as the model in cluster.js.
const WORKER_OPTS = {
  workerPath: "/tesseract/worker.min.js",
  corePath: "/tesseract",
  langPath: "/tesseract/lang",
};

// OCR a single uploaded image (e.g. a screenshot of a question paper).
export async function ocrImage(image) {
  const worker = await createWorker("eng", 1, WORKER_OPTS);
  try {
    const { data } = await worker.recognize(image);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

// OCR every page of an already-loaded pdfjs document.
// `onProgress(done, total)` is optional, for the loading UI.
export async function ocrDocument(doc, { scale = 2, onProgress } = {}) {
  const worker = await createWorker("eng", 1, WORKER_OPTS);
  try {
    let text = "";
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale }); // 2x => crisper glyphs
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      const { data } = await worker.recognize(canvas);
      text += data.text + "\n";
      onProgress?.(p, doc.numPages);
    }
    return text;
  } finally {
    await worker.terminate();
  }
}
