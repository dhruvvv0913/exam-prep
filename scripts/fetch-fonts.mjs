// Dev/setup: download the Poppins woff2 files (latin subset, weights 400-700)
// and generate public/fonts/poppins.css with local @font-face rules, so the app
// serves its font itself (no Google Fonts CDN). Re-run if weights change.
import { mkdirSync, writeFileSync } from "node:fs";

const URL = "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

mkdirSync("public/fonts", { recursive: true });
const css = await (await fetch(URL, { headers: { "User-Agent": UA } })).text();

let out = "";
// Each @font-face is preceded by a "/* subset */" comment; keep latin only.
for (const block of css.split("/*").slice(1)) {
  const label = block.slice(0, block.indexOf("*/")).trim();
  if (label !== "latin") continue;
  const weight = (block.match(/font-weight:\s*(\d+)/) || [])[1];
  const url = (block.match(/src:\s*url\(([^)]+)\)/) || [])[1];
  const range = (block.match(/unicode-range:\s*([^;]+);/) || [])[1];
  if (!weight || !url) continue;
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  const file = `poppins-${weight}.woff2`;
  writeFileSync(`public/fonts/${file}`, buf);
  out += `@font-face{font-family:'Poppins';font-style:normal;font-weight:${weight};font-display:swap;src:url(/fonts/${file}) format('woff2');unicode-range:${range};}\n`;
  console.log(`downloaded ${file} (${buf.length} bytes)`);
}
writeFileSync("public/fonts/poppins.css", out);
console.log("wrote public/fonts/poppins.css");
