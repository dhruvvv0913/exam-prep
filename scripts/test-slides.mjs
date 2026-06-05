// Dev-only: extract a topic taxonomy from a slide-deck PDF and print it, so we
// can eyeball how good the slide-title detection is on a real deck.
// Usage: node scripts/test-slides.mjs "<slides.pdf>"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "node:fs";
import { extractTopics } from "../src/engine/slides.js";

// One string per PDF page (= one slide), lines reconstructed from item coords.
async function slidePages(path) {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(path)), useSystemFonts: true }).promise;
  const out = [];
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
    out.push(lines.join("\n"));
  }
  return out;
}

const path = process.argv[2];
if (!path) { console.error("usage: node scripts/test-slides.mjs <slides.pdf>"); process.exit(1); }

const slides = await slidePages(path);
const topics = extractTopics(slides);
console.log(`\n${slides.length} slides -> ${topics.length} topics:\n`);
topics.forEach((t, i) => console.log(`  ${String(i + 1).padStart(2)}. ${t}`));
