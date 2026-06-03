// Dev-only: report the text-quality score for each PDF passed in.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "node:fs";
import { assessText } from "../src/engine/textQuality.js";

async function extract(path) {
  const data = new Uint8Array(readFileSync(path));
  const doc = await getDocument({ data, useSystemFonts: true }).promise;
  let out = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    out += content.items.map((i) => i.str).join(" ") + " ";
  }
  return out;
}

for (const path of process.argv.slice(2)) {
  const { usable, words, ratio } = assessText(await extract(path));
  const name = path.split(/[\\/]/).pop();
  console.log(`${usable ? "USABLE " : "OCR    "} ratio=${ratio.toFixed(3)} words=${words}  ${name}`);
}
