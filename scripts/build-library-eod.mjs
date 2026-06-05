// Dev/setup: seed the subject library with the EOD data we already OCR'd.
// Produces public/library/eod.json (a full analysis result) and registers it in
// public/library/index.json. Mirrors what an admin "Save to library" will emit.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { env } from "@xenova/transformers";
import { embed, clusterVectors } from "../src/engine/cluster.js";
import { groupsFromClusters } from "../src/engine/rank.js";

env.localModelPath = "./public/models/";

const SUBJECT = "Economics of Development";
const CODE = "HS20120";
const ID = "eod";

const items = JSON.parse(readFileSync("scripts/eod-items.json", "utf8"));
const vecs = await embed(items.map((i) => i.text));
const groups = groupsFromClusters(clusterVectors(items, vecs));

// Synthesize one "paper" entry per distinct uploaded doc (for subject + counts).
const byPidx = new Map();
for (const it of items) if (!byPidx.has(it.pIdx)) byPidx.set(it.pIdx, { subject: SUBJECT, code: CODE, year: it.year ?? null });
const papers = [...byPidx.values()];

const result = { papers, groups, questionCount: items.length, paperCount: papers.length };

mkdirSync("public/library", { recursive: true });
writeFileSync(`public/library/${ID}.json`, JSON.stringify(result));

const index = existsSync("public/library/index.json")
  ? JSON.parse(readFileSync("public/library/index.json", "utf8"))
  : { subjects: [] };
index.subjects = (index.subjects || []).filter((s) => s.id !== ID);
index.subjects.push({ id: ID, subject: SUBJECT, code: CODE, paperCount: papers.length, questionCount: items.length, topicCount: groups.length });
writeFileSync("public/library/index.json", JSON.stringify(index, null, 2));

console.log(`Seeded "${SUBJECT}": ${papers.length} papers, ${items.length} questions, ${groups.length} topics.`);
