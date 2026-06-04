// Dev-only: sweep clustering thresholds over the cached EOD questions to find
// the setting that reduces fragmentation (same topic split into many groups)
// without causing over-merge (a giant mixed group). No OCR — uses the cache
// written by test-eod.mjs.
import { readFileSync } from "node:fs";
import { env } from "@xenova/transformers";
import { embed, clusterVectors } from "../src/engine/cluster.js";

env.localModelPath = "./public/models/";

const items = JSON.parse(readFileSync("scripts/eod-items.json", "utf8"));
console.log(`Loaded ${items.length} cached questions. Embedding once...\n`);
const vecs = await embed(items.map((i) => i.text));

// How many separate groups a topic is split across (1 = fully merged).
const TOPICS = {
  externalities: /externalit/i,
  WTO: /\bWTO\b|world trade/i,
  "prebisch-singer": /prebisch/i,
  myrdal: /myrdal|backwash/i,
  ricardo: /ricardo/i,
  gini: /gini|lorenz/i,
  sustainable: /sustainable develop/i,
};

const frag = (clusters, re) => clusters.filter((g) => g.items.some((it) => re.test(it.text))).length;

const detail = process.argv.includes("--detail");
const sweep = process.argv.slice(2).map(Number).filter(Boolean);
const thresholds = sweep.length ? sweep : [0.62, 0.65, 0.68, 0.70, 0.72];

if (detail && thresholds.length === 1) {
  const clusters = clusterVectors(items, vecs, { threshold: thresholds[0], strong: thresholds[0] + 0.17 });
  const withN = clusters.map((c) => ({ c, papers: new Set(c.items.map((i) => i.paperId)).size }))
    .filter((x) => x.papers >= 2).sort((a, b) => b.c.items.length - a.c.items.length);
  console.log(`\n=== groups @ ${thresholds[0]} (${withN.length} multi-doc) ===`);
  for (const { c } of withN) {
    console.log(`\n• [${c.items.length}q]`);
    for (const it of c.items) console.log(`    (${it.paperId}) ${it.text.slice(0, 72)}`);
  }
  process.exit(0);
}

console.log("thr  | groups multiDoc single maxGrp | " + Object.keys(TOPICS).map((k) => k.slice(0, 6)).join(" "));
for (const t of thresholds) {
  const clusters = clusterVectors(items, vecs, { threshold: t, strong: t + 0.17 });
  const multiDoc = clusters.filter((c) => new Set(c.items.map((i) => i.paperId)).size >= 2).length;
  const single = clusters.filter((c) => c.items.length === 1).length;
  const maxGrp = Math.max(...clusters.map((c) => c.items.length));
  const fragStr = Object.values(TOPICS).map((re) => frag(clusters, re)).join("      ").replace(/(\d)/g, "$1");
  const fcells = Object.values(TOPICS).map((re) => String(frag(clusters, re)).padEnd(6)).join(" ");
  console.log(`${t.toFixed(2)} | ${String(clusters.length).padEnd(6)} ${String(multiDoc).padEnd(8)} ${String(single).padEnd(6)} ${String(maxGrp).padEnd(6)} | ${fcells}`);
}
