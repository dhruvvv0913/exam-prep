// Dev-only helper: extract raw text from a PDF using the same pdfjs-dist the
// browser will use, so we can design the parser against real output.
// Usage: node scripts/extract-text.mjs "<path-to-pdf>"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) { console.error("pass a pdf path"); process.exit(1); }

const data = new Uint8Array(readFileSync(path));
const doc = await getDocument({ data, useSystemFonts: true }).promise;

let out = "";
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const content = await page.getTextContent();
  // Reconstruct lines using item positions: a new line when Y changes.
  let lastY = null;
  let line = "";
  const lines = [];
  for (const item of content.items) {
    const y = item.transform[5];
    if (lastY !== null && Math.abs(y - lastY) > 2) { lines.push(line); line = ""; }
    line += item.str;
    if (item.hasEOL) { lines.push(line); line = ""; lastY = null; }
    else lastY = y;
  }
  if (line) lines.push(line);
  out += `\n===== PAGE ${p} =====\n` + lines.join("\n");
}
console.log(out);
