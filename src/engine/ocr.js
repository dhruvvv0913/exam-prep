// OCR fallback for scanned / image-only PDFs, in the browser.
// We render each PDF page to a canvas with pdfjs, then read the pixels with
// tesseract.js (free, local, no API). Used only when the embedded text layer
// is empty or garbled — see textQuality.assessText.

// tesseract.js is loaded *lazily* (dynamic import) so the common case — PDFs
// with a real text layer — never downloads the OCR engine; it splits into its
// own chunk that loads only when we actually OCR. The import promise is cached
// so repeat/concurrent calls share one load.
let _tesseract;
const loadTesseract = () => (_tesseract ??= import("tesseract.js"));

// Self-hosted worker/core/lang (public/tesseract) so OCR works on networks
// that block CDNs — same reason as the model in cluster.js.
const WORKER_OPTS = {
  workerPath: "/tesseract/worker.min.js",
  corePath: "/tesseract",
  langPath: "/tesseract/lang",
};

// OCR a single uploaded image (e.g. a screenshot of a question paper).
export async function ocrImage(image) {
  const { createWorker } = await loadTesseract();
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
export async function ocrDocument(doc, { scale, onProgress } = {}) {
  const { createWorker } = await loadTesseract();
  const worker = await createWorker("eng", 1, WORKER_OPTS);
  try {
    let text = "";
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      // Render at a high, resolution-aware scale (~300 DPI-equivalent) so small
      // or low-quality scans give Tesseract crisp glyphs — speed isn't a
      // constraint here. Derive from the page width, capped to 2–4x to bound
      // canvas memory; an explicit `scale` overrides.
      const baseW = page.getViewport({ scale: 1 }).width || 595;
      const s = scale ?? Math.min(4, Math.max(2, 2200 / baseW));
      const viewport = page.getViewport({ scale: s });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      // Paint an opaque white background first — some scanned PDFs render with a
      // transparent layer, which OCRs as noise without this.
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const { data } = await worker.recognize(canvas);
      text += data.text + "\n";
      onProgress?.(p, doc.numPages);
    }
    return text;
  } finally {
    await worker.terminate();
  }
}
