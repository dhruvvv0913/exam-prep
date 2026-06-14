// One-off: generate the PWA app icons (public/icon-192.png, icon-512.png) from
// the brand mark (indigo square + white circle, matching public/favicon.svg).
// Full-bleed background so the icons are maskable-safe. Run: node scripts/gen-icons.mjs
import { createCanvas } from "@napi-rs/canvas";
import { writeFileSync } from "node:fs";

const draw = (size) => {
  const c = createCanvas(size, size);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#3f51c4";          // brand indigo, full bleed (maskable-safe)
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.2, 0, Math.PI * 2); // r ≈ favicon's 6.5/32
  ctx.fill();
  return c.toBuffer("image/png");
};

writeFileSync("public/icon-192.png", draw(192));
writeFileSync("public/icon-512.png", draw(512));
console.log("wrote public/icon-192.png + public/icon-512.png");
