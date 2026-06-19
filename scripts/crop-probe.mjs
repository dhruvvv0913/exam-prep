// Phase-1 validation: prove we can crop a source PDF page into per-question
// image strips using text-layer positions. Renders each page, finds question/
// part marker lines, crops [marker .. next marker], writes PNGs to scripts/_crops.
//   node scripts/crop-probe.mjs "C:/Users/KIIT/Downloads/2019.pdf"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { createCanvas } from "@napi-rs/canvas";
import { createWorker } from "tesseract.js";

const path = process.argv[2];
if (!path) { console.error("usage: node scripts/crop-probe.mjs <pdf>"); process.exit(1); }
const outDir = "scripts/_crops";
try { rmSync(outDir, { recursive: true, force: true }); } catch {}
mkdirSync(outDir, { recursive: true });

const MARK = /^\s*(\d{1,2}\s*[.)]|\(?[a-z]\s*[.)])/i; // top-level "1." "1)" or part "(a)" "a)"
const SCALE = 2;
const doc = await getDocument({ data: new Uint8Array(readFileSync(path)), useSystemFonts: true }).promise;
let total = 0;

for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const vp = page.getViewport({ scale: SCALE });
  const canvas = createCanvas(vp.width, vp.height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, vp.width, vp.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  writeFileSync(`${outDir}/p${p}_full.png`, canvas.toBuffer("image/png")); // full-page render for inspection

  // Reconstruct lines with their TOP y in canvas pixels (group items by baseline).
  const lines = [];
  for (const it of (await page.getTextContent()).items) {
    if (!it.str.trim()) continue;
    const [, vy] = vp.convertToViewportPoint(it.transform[4], it.transform[5]); // baseline y (canvas px)
    const h = (it.height || 10) * SCALE;
    let line = lines.find((l) => Math.abs(l.vy - vy) < h * 0.6);
    if (!line) { line = { vy, top: vy - h, text: "" }; lines.push(line); }
    line.text += it.str;
    line.top = Math.min(line.top, vy - h);
  }
  lines.sort((a, b) => a.vy - b.vy);

  // No text layer (a scan) → OCR the rendered canvas to get line bounding boxes
  // (already in canvas pixels, since we OCR the SCALE-rendered page).
  if (lines.length === 0) {
    const worker = await createWorker("eng");
    const { data } = await worker.recognize(canvas.toBuffer("image/png"), {}, { blocks: true });
    await worker.terminate();
    for (const block of data.blocks || []) for (const para of block.paragraphs || []) for (const ln of para.lines || []) {
      const text = (ln.text || "").trim();
      if (text && ln.bbox) lines.push({ vy: ln.bbox.y1, top: ln.bbox.y0, text });
    }
    lines.sort((a, b) => a.top - b.top);
  }

  const marks = lines.filter((l) => MARK.test(l.text.trim()));
  console.log(`page ${p}: ${lines.length} lines, ${marks.length} marker lines`);

  for (let i = 0; i < marks.length; i++) {
    const y0 = Math.max(0, Math.floor(marks[i].top - 5));
    const y1 = Math.min(vp.height, Math.floor(i + 1 < marks.length ? marks[i + 1].top - 3 : vp.height));
    if (y1 - y0 < 14) continue;
    const crop = createCanvas(vp.width, y1 - y0);
    crop.getContext("2d").drawImage(canvas, 0, y0, vp.width, y1 - y0, 0, 0, vp.width, y1 - y0);
    const f = `${outDir}/p${p}_${String(i).padStart(2, "0")}.png`;
    writeFileSync(f, crop.toBuffer("image/png"));
    console.log(`  ${f.padEnd(28)} y[${y0}..${y1}]  "${marks[i].text.trim().slice(0, 46)}"`);
    total++;
  }
}
console.log(`\nWrote ${total} crops -> ${outDir}`);
