// "View original" — crop the EXACT image of a question out of its source file,
// in the browser, on demand. So students see the original wording, math and
// diagrams (and clean text for scans whose OCR came out garbled) instead of the
// mangled extracted text. Display-only; grouping still uses the extracted text.
//
// Boundaries come from positions, not pixels:
//   - born-digital PDFs → pdf.js text-item coordinates;
//   - scans / images   → Tesseract line bounding-boxes (ocr.js `ocrLines`).
// A question's strip = [its first line .. the next question/part marker], which
// works because KIIT papers are single-column. Validated in scripts/crop-probe.mjs.
//
// In-session uploads ONLY (we crop straight from the uploaded File); saved/
// library subjects hold no File, so they show text only. Nothing is persisted.
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { ocrLines } from "./ocr.js";
import { findRegion } from "./cropCore.js"; // pure matching/bounds (unit-tested)

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const CROP_SCALE = 2; // render scale for the final crop (positions are scale-free)
const isPdf = (f) => f && (f.type === "application/pdf" || /\.pdf$/i.test(f.name || ""));

// Caches keyed on the stable per-paper `pages[]` array (from the session's
// `sources`), so we extract line positions / OCR a scan only once per paper and
// reuse crops across reopens.
const _pageCache = new WeakMap(); // pages[] -> Promise<PageEntry[]>
const _cropCache = new WeakMap(); // pages[] -> Map<questionText, Promise<url|null>>

// Reconstruct text-layer lines (top y as a FRACTION of page height, so it's
// independent of the scale we later render the crop at).
function textLines(items, vp, H) {
  const lines = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const [, vy] = vp.convertToViewportPoint(it.transform[4], it.transform[5]); // baseline, top-left origin
    const h = (it.height || 10);
    let line = lines.find((l) => Math.abs(l.vy - vy) < Math.max(3, h * 0.6));
    if (!line) { line = { vy, top: vy - h, text: "" }; lines.push(line); }
    line.text += it.str;
    line.top = Math.min(line.top, vy - h);
  }
  lines.sort((a, b) => a.vy - b.vy);
  return lines.map((l) => ({ text: l.text, topFrac: Math.max(0, l.top) / H }));
}

// One renderable page + its line positions. `render(scale)` paints it to a
// fresh canvas (opaque white bg, as scans can be transparent).
async function pdfPageEntry(page) {
  const vp1 = page.getViewport({ scale: 1 });
  const H = vp1.height;
  const render = async (scale) => {
    const vp = page.getViewport({ scale });
    const c = document.createElement("canvas");
    c.width = vp.width; c.height = vp.height;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    return c;
  };
  let lines = textLines((await page.getTextContent()).items, vp1, H);
  if (lines.length < 2) {
    // No usable text layer → it's a scan: OCR a high-res render for line boxes.
    const s = Math.min(4, Math.max(2, 2200 / (vp1.width || 595)));
    const canvas = await render(s);
    lines = (await ocrLines(canvas)).map((l) => ({ text: l.text, topFrac: l.top / canvas.height }));
  }
  return { render, lines };
}

async function imagePageEntry(buf, type) {
  const bitmap = await createImageBitmap(new Blob([buf], { type: type || "image/png" }));
  const render = async (scale) => {
    const c = document.createElement("canvas");
    c.width = bitmap.width * scale; c.height = bitmap.height * scale;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bitmap, 0, 0, c.width, c.height);
    return c;
  };
  const canvas = await render(2);
  const lines = (await ocrLines(canvas)).map((l) => ({ text: l.text, topFrac: l.top / canvas.height }));
  return { render, lines };
}

// All pages of a paper (one multi-page PDF, or several single-page images),
// flattened in reading order, each with its line positions.
function pagesOf(pages) {
  let p = _pageCache.get(pages);
  if (p) return p;
  p = (async () => {
    const out = [];
    for (const file of pages) {
      const buf = await file.arrayBuffer();
      if (isPdf(file)) {
        const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true }).promise;
        for (let n = 1; n <= doc.numPages; n++) out.push(await pdfPageEntry(await doc.getPage(n)));
      } else {
        out.push(await imagePageEntry(buf, file.type));
      }
    }
    return out;
  })();
  _pageCache.set(pages, p);
  return p;
}

// Crop the strip for `questionText` out of `pages` (a paper's File[]). Returns
// an object-URL for a PNG, or null if the question couldn't be located. Cached.
export async function getQuestionCrop(pages, questionText) {
  if (!pages || !pages.length || !questionText) return null;
  let map = _cropCache.get(pages);
  if (!map) { map = new Map(); _cropCache.set(pages, map); }
  if (map.has(questionText)) return map.get(questionText);

  const job = (async () => {
    const entries = await pagesOf(pages);
    const region = findRegion(entries, questionText); // pure: { pageIndex, topFrac, botFrac } | null
    if (!region) return null;
    const { pageIndex, topFrac, botFrac } = region;

    const canvas = await entries[pageIndex].render(CROP_SCALE);
    const W = canvas.width, H = canvas.height;
    const y0 = Math.max(0, Math.floor(topFrac * H));
    const y1 = Math.min(H, Math.ceil(botFrac * H));
    const ch = Math.max(1, y1 - y0);
    const crop = document.createElement("canvas");
    crop.width = W; crop.height = ch;
    crop.getContext("2d").drawImage(canvas, 0, y0, W, ch, 0, 0, W, ch);
    return await new Promise((res) => crop.toBlob((b) => res(b ? URL.createObjectURL(b) : null), "image/png"));
  })();

  map.set(questionText, job);
  return job;
}
