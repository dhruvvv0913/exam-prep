// Dev-only: run the FULL strict slide-anchored pipeline in Node and print which
// questions landed under which slide topic. Use it to calibrate the match floor.
//   Slide decks come first, then "--", then the exam paper PDFs:
//     node scripts/test-anchor.mjs <slides1.pdf> <slides2.pdf> ... -- <paper1.pdf> <paper2.pdf> ...
//   --floor=0.5  overrides the default confidence floor (placed anywhere).
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "node:fs";
import { createCanvas } from "@napi-rs/canvas";
import { createWorker } from "tesseract.js";
import { env } from "@xenova/transformers";
import { parsePaper } from "../src/engine/parsePaper.js";
import { isUsableText } from "../src/engine/textQuality.js";
import { extractDeckTopics, deckLabel } from "../src/engine/slides.js";
import { anchorAndClusterQuestions, embed } from "../src/engine/cluster.js";
import { groupsFromClusters, summarize, byPpt } from "../src/engine/rank.js";

// Self-hosted model on disk (the same files the browser loads) — no network.
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = "./public/models/";

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
  return pages;
}

async function ocr(doc) {
  const worker = await createWorker("eng");
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 2 });
    const canvas = createCanvas(vp.width, vp.height);
    await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
    const { data } = await worker.recognize(canvas.toBuffer("image/png"));
    pages.push(data.text);
  }
  await worker.terminate();
  return pages;
}

const load = async (path) => getDocument({ data: new Uint8Array(readFileSync(path)), useSystemFonts: true }).promise;
const readPages = async (path) => {
  let pages = await textLayer(await load(path)); let method = "text";
  if (!isUsableText(pages.join("\n"))) { pages = await ocr(await load(path)); method = "ocr"; }
  return { pages, method };
};
const args = process.argv.slice(2);
const floorArg = args.find((a) => a.startsWith("--floor="));
const floor = floorArg ? Number(floorArg.split("=")[1]) : undefined;
const sep = args.indexOf("--");
const flag = (a) => a.startsWith("--");
const slidePaths = (sep >= 0 ? args.slice(0, sep) : args.slice(0, 1)).filter((a) => !flag(a));
const paperPaths = (sep >= 0 ? args.slice(sep + 1) : args.slice(1)).filter((a) => !flag(a));

if (!slidePaths.length || !paperPaths.length) { console.error("usage: node scripts/test-anchor.mjs <slides...> -- <papers...> [--floor=0.5]"); process.exit(1); }

// 1) slides -> deck-level topics (each deck = one coarse topic, labelled from
//    its filename; per-slide titles are the precise match targets)
const decks = [];
for (const sp of slidePaths) {
  try { decks.push({ label: deckLabel(sp), slides: (await readPages(sp)).pages }); }
  catch (e) { console.error(`  ! skip slides ${sp.split(/[\\/]/).pop()}: ${e.message}`); }
}
const { titles: topics, deckOf } = extractDeckTopics(decks);
const slideCount = decks.reduce((n, d) => n + d.slides.length, 0);
console.error(`Slides: ${decks.length} deck(s), ${slideCount} slides -> ${new Set(deckOf).size} deck topics (${topics.length} title targets)`);

// 2) papers -> question items
const items = [];
for (let i = 0; i < paperPaths.length; i++) {
  try {
    const { pages, method } = await readPages(paperPaths[i]);
    const { meta, questions } = parsePaper(pages.join("\n"));
    const paperId = `${meta.session ?? meta.examType ?? "Paper"} ${meta.year ?? i + 1}`;
    console.error(`  ${paperPaths[i].split(/[\\/]/).pop()} [${method}] -> ${questions.length} questions`);
    for (const q of questions) items.push({ ...q, paperId, year: meta.year, pIdx: i });
  } catch (e) {
    console.error(`  ! skip paper ${paperPaths[i].split(/[\\/]/).pop()}: ${e.message}`);
  }
}

// 3) strict anchoring
console.error(`\nAnchoring ${items.length} questions to ${topics.length} topics${floor != null ? ` (floor=${floor})` : ""}...`);

// --debug: print the top-3 topic matches + scores per question (to pick a floor)
if (args.includes("--debug")) {
  const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
  const qVecs = await embed(items.map((q) => q.text));
  const tVecs = await embed(topics);
  console.log("\n=== TOP MATCHES PER QUESTION (for floor calibration) ===");
  items.forEach((q, i) => {
    const scored = topics.map((t, j) => [t, dot(qVecs[i], tVecs[j])]).sort((a, b) => b[1] - a[1]).slice(0, 3);
    console.log(`\nQ: ${q.text.slice(0, 80)}`);
    for (const [t, s] of scored) console.log(`   ${s.toFixed(3)}  ${t}`);
  });
}

const clusters = await anchorAndClusterQuestions(items, topics, { deckOf, ...(floor != null ? { floor } : {}) });
const groups = groupsFromClusters(clusters);
const { ranked, unique } = summarize(groups);

const show = (g) => {
  console.log(`\n[${g.topic}]  ${g.appears}x exams · ${g.variants} variants · ${g.totalMarks} marks`);
  for (const q of g.questions) console.log(`   (${q.src}) ${q.text.slice(0, 90)}`);
};

// ---- Section 1: "By importance" — fine question-types ranked by repeats -----
console.log(`\n############  BY IMPORTANCE  ############`);
console.log(`\n=== RANKED TYPES (appear in ≥2 exams) ===`);
ranked.forEach(show);
console.log(`\n=== asked once ===`);
unique.forEach(show);

// ---- Section 2: "By PPT" — the same types nested under their slide deck ------
console.log(`\n\n############  BY PPT  ############`);
for (const d of byPpt(groups)) {
  console.log(`\n>>> ${d.deck}  (${d.typeCount} types · ${d.questionCount} Qs · ${d.appears} exams · ${d.totalMarks} marks)`);
  for (const t of d.types) {
    const tag = t.unique ? "asked once" : `${t.appears}x exams`;
    console.log(`   • ${t.topic}  [${tag} · ${t.totalMarks} marks]`);
    for (const q of t.questions) console.log(`       (${q.src}) ${q.text.slice(0, 84)}`);
  }
}
