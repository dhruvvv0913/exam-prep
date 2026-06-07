// Tests for groups <-> ranked/by-paper derivations and topic labelling.
import { test } from "node:test";
import assert from "node:assert/strict";
import { groupsFromClusters, summarize, byPaper, topicLabel } from "../src/engine/rank.js";

const GROUPS = [
  { id: "g0", topic: "Cache Memory", items: [
    { uid: "0__q1", pIdx: 0, id: "q1", text: "Explain cache mapping techniques.", paperId: "Spring 2023", year: 2023, marks: 5 },
    { uid: "1__q1", pIdx: 1, id: "q1", text: "Compare direct and associative cache.", paperId: "Spring 2024", year: 2024, marks: 5 },
  ] },
  { id: "g1", topic: "Stack & Subroutines", items: [
    { uid: "0__q2", pIdx: 0, id: "q2", text: "Describe stack-based subroutine linkage.", paperId: "Spring 2023", year: 2023, marks: 5 },
  ] },
];

test("groupsFromClusters keeps a given (slide-anchored) topic and adds stable uids", () => {
  const out = groupsFromClusters([{ topic: "Addressing Modes", items: [{ id: "q1", text: "indexed addressing", pIdx: 2, paperId: "P", year: 2020, marks: 5 }] }]);
  assert.equal(out[0].topic, "Addressing Modes");
  assert.equal(out[0].items[0].uid, "2__q1");
});

test("groupsFromClusters synthesises a label when none is given", () => {
  const out = groupsFromClusters([{ items: [{ id: "q1", text: "Explain the WTO and GATT trade framework.", pIdx: 0 }] }]);
  assert.equal(typeof out[0].topic, "string");
  assert.ok(out[0].topic.length > 0);
});

test("summarize ranks repeats and separates asked-once", () => {
  const { ranked, unique } = summarize(GROUPS);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].topic, "Cache Memory");
  assert.equal(ranked[0].appears, 2);       // two distinct papers
  assert.equal(ranked[0].totalMarks, 10);
  assert.equal(unique.length, 1);
  assert.equal(unique[0].topic, "Stack & Subroutines");
});

test("summarize exposes pIdx on each question (for the by-paper cross-link)", () => {
  const { ranked } = summarize(GROUPS);
  const idxs = ranked[0].questions.map((q) => q.pIdx).sort();
  assert.deepEqual(idxs, [0, 1]);
});

test("byPaper regroups by source paper, tagging each question with its topic", () => {
  const papers = byPaper(GROUPS);
  assert.equal(papers.length, 2); // pIdx 0 and 1
  const p0 = papers.find((p) => p.pIdx === 0);
  assert.equal(p0.questions.length, 2);
  assert.ok(p0.questions.some((q) => q.topic === "Cache Memory"));
  assert.ok(p0.questions.some((q) => q.topic === "Stack & Subroutines"));
  assert.equal(p0.totalMarks, 10);
});

test("topicLabel weights acronyms over generic words", () => {
  const label = topicLabel([
    { text: "Explain the role of the WTO in global trade." },
    { text: "How does the WTO resolve trade disputes between nations?" },
  ]);
  assert.match(label, /WTO/);
});
