// Phase-1 validation #2: prove the REAL flow — parse a paper into questions
// with the actual engine, then map each PARSED QUESTION to its crop strip using
// the same text→line matching cropQuestion.js uses (startScore + next-marker
// boundary). Confirms a question lands on its OWN strip, not a neighbour's.
//   node scripts/crop-match.mjs "C:/Users/KIIT/Downloads/2018 (1).pdf"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { createCanvas } from "@napi-rs/canvas";
import { createWorker } from "tesseract.js";
import { splitQuestions } from "../src/engine/parsePaper.js";

// ---- mirror of cropQuestion.js pure bits --------------------------------
const MARK = /^\s*(\(?\d{1,2}\s*[.)]|\(?[a-z]\s*[.)])/i;
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const wordsOf = (s) => norm(s).split(" ").filter(Boolean);
function startScore(lineText, qw) {
  const lw = wordsOf(lineText);
  if (!lw.length || !qw.length) return 0;
  let best = 0;
  for (let start = 0; start <= 2 && start < lw.length; start++) {
    if (lw[start] !== qw[0]) continue;
    let n = 0;
    while (n < qw.length && start + n < lw.length && lw[start + n] === qw[n]) n++;
    if (n > best) best = n;
  }
  return best;
}

const path = process.argv[2];
if (!path) { console.error("usage: node scripts/crop-match.mjs <pdf>"); process.exit(1); }
const outDir = "scripts/_crops";
try { rmSync(outDir, { recursive: true, force: true }); } catch {}
mkdirSync(outDir, { recursive: true });
const SCALE = 2;

const doc = await getDocument({ data: new Uint8Array(readFileSync(path)), useSystemFonts: true }).promise;
const pages = []; // { canvas, H, lines:[{text, topFrac}] }
let fullText = "";
let worker = null;

for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const vp = page.getViewport({ scale: SCALE });
  const canvas = createCanvas(vp.width, vp.height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, vp.width, vp.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;

  // text-layer lines
  let lines = [];
  for (const it of (await page.getTextContent()).items) {
    if (!it.str.trim()) continue;
    const [, vy] = vp.convertToViewportPoint(it.transform[4], it.transform[5]);
    const h = (it.height || 10) * SCALE;
    let line = lines.find((l) => Math.abs(l.vy - vy) < h * 0.6);
    if (!line) { line = { vy, top: vy - h, text: "" }; lines.push(line); }
    line.text += it.str; line.top = Math.min(line.top, vy - h);
  }
  lines.sort((a, b) => a.vy - b.vy);

  if (lines.length < 2) { // scan → OCR this rendered page (text + line boxes)
    worker ||= await createWorker("eng");
    const { data } = await worker.recognize(canvas.toBuffer("image/png"), {}, { blocks: true });
    lines = [];
    for (const b of data.blocks || []) for (const par of b.paragraphs || []) for (const ln of par.lines || []) {
      const t = (ln.text || "").trim();
      if (t && ln.bbox) lines.push({ top: ln.bbox.y0, text: t });
    }
    fullText += data.text + "\n";
  } else {
    fullText += lines.map((l) => l.text).join("\n") + "\n\n";
  }
  pages.push({ canvas, H: vp.height, lines: lines.map((l) => ({ text: l.text, topFrac: Math.max(0, l.top) / vp.height })) });
}
if (worker) await worker.terminate();

const questions = splitQuestions(fullText);
console.log(`parsed ${questions.length} questions across ${doc.numPages} pages\n`);

let ok = 0, miss = 0;
questions.forEach((q, qi) => {
  const qw = wordsOf(q.text).slice(0, 8);
  let best = null;
  for (let pi = 0; pi < pages.length; pi++) {
    const ls = pages[pi].lines;
    for (let li = 0; li < ls.length; li++) {
      const sc = startScore(ls[li].text, qw);
      if (sc >= 3 && (!best || sc > best.sc)) best = { pi, li, sc };
    }
  }
  if (!best) { miss++; console.log(`  ✗ no match  «${q.text.slice(0, 46)}»`); return; }
  const ls = pages[best.pi].lines;
  const topFrac = Math.max(0, ls[best.li].topFrac - 0.004);
  let botFrac = 1;
  for (let li = best.li + 1; li < ls.length; li++) {
    if (MARK.test(ls[li].text.trim())) { botFrac = Math.max(topFrac + 0.012, ls[li].topFrac - 0.004); break; }
  }
  const { canvas, H } = pages[best.pi];
  const y0 = Math.max(0, Math.floor(topFrac * H)), y1 = Math.min(H, Math.ceil(botFrac * H));
  const crop = createCanvas(canvas.width, Math.max(1, y1 - y0));
  crop.getContext("2d").drawImage(canvas, 0, y0, canvas.width, y1 - y0, 0, 0, canvas.width, y1 - y0);
  const f = `${outDir}/q${String(qi).padStart(2, "0")}.png`;
  writeFileSync(f, crop.toBuffer("image/png"));
  ok++;
  console.log(`  ✓ p${best.pi + 1} sc=${best.sc} «${q.text.slice(0, 40)}»  →  line «${ls[best.li].text.slice(0, 40)}»  → ${f}`);
});
console.log(`\nmatched ${ok}/${questions.length} (missed ${miss})`);
