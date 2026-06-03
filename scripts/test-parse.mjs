// Dev-only: extract + parse a PDF and print structured output.
// Usage: node scripts/test-parse.mjs "<path-to-pdf>"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "node:fs";
import { parsePaper } from "../src/engine/parsePaper.js";

async function extract(path) {
  const data = new Uint8Array(readFileSync(path));
  const doc = await getDocument({ data, useSystemFonts: true }).promise;
  let out = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    let line = "", lastY = null;
    const lines = [];
    for (const it of content.items) {
      const y = it.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) { lines.push(line); line = ""; }
      line += it.str;
      if (it.hasEOL) { lines.push(line); line = ""; lastY = null; } else lastY = y;
    }
    if (line) lines.push(line);
    out += lines.join("\n") + "\n";
  }
  return out;
}

const text = await extract(process.argv[2]);
const { meta, questions } = parsePaper(text);
console.log("META:", JSON.stringify(meta));
console.log(`QUESTIONS (${questions.length}):`);
for (const q of questions) console.log(`  [${q.id}] ${q.text}`);
