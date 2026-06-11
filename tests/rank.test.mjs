// Tests for groups <-> ranked/by-paper derivations and topic labelling.
import { test } from "node:test";
import assert from "node:assert/strict";
import { groupsFromClusters, summarize, byPpt, topicLabel } from "../src/engine/rank.js";
import { NOT_ON_SLIDES } from "../src/engine/clusterCore.js";

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

test("summarize exposes pIdx on each question (drives the distinct-exam count)", () => {
  const { ranked } = summarize(GROUPS);
  const idxs = ranked[0].questions.map((q) => q.pIdx).sort();
  assert.deepEqual(idxs, [0, 1]);
});

test("groupsFromClusters carries the deck (PPT) label, defaulting to null", () => {
  const out = groupsFromClusters([
    { deck: "Cache Memory", items: [{ id: "q1", text: "cache mapping", pIdx: 0 }] },
    { items: [{ id: "q2", text: "no slides uploaded", pIdx: 0 }] },
  ]);
  assert.equal(out[0].deck, "Cache Memory");
  assert.equal(out[1].deck, null);
});

const DECK_GROUPS = [
  { id: "g0", topic: "Direct mapping", deck: "Cache Memory", items: [
    { uid: "0__q1", pIdx: 0, id: "q1", text: "Explain direct mapping.", paperId: "Spring 2023", year: 2023, marks: 5 },
    { uid: "1__q1", pIdx: 1, id: "q1", text: "Describe a direct-mapped cache.", paperId: "Spring 2024", year: 2024, marks: 5 },
  ] },
  { id: "g1", topic: "Associative mapping", deck: "Cache Memory", items: [
    { uid: "0__q2", pIdx: 0, id: "q2", text: "What is associative mapping?", paperId: "Spring 2023", year: 2023, marks: 10 },
  ] },
  { id: "g2", topic: "Booth's algorithm", deck: "Multiplication", items: [
    { uid: "2__q1", pIdx: 2, id: "q1", text: "Booth's algorithm steps.", paperId: "Spring 2022", year: 2022, marks: 5 },
  ] },
  { id: "g3", topic: "Mystery", deck: NOT_ON_SLIDES, items: [
    { uid: "0__q9", pIdx: 0, id: "q9", text: "Some off-syllabus question.", paperId: "Spring 2023", year: 2023, marks: 5 },
  ] },
];

test("byPpt buckets type-groups under their PPT; heaviest first, off-syllabus last", () => {
  const decks = byPpt(DECK_GROUPS);
  assert.equal(decks.length, 3);
  // Cache Memory = 20 marks (5+5+10) => first; off-syllabus bucket => last
  assert.equal(decks[0].deck, "Cache Memory");
  assert.equal(decks[0].typeCount, 2);       // two question-types under this PPT
  assert.equal(decks[0].questionCount, 3);   // three questions total
  assert.equal(decks[0].appears, 2);         // spanning papers pIdx 0 and 1
  assert.equal(decks[0].totalMarks, 20);
  assert.equal(decks[0].types[0].topic, "Direct mapping"); // repeated type ranks above asked-once
  assert.equal(decks[decks.length - 1].deck, NOT_ON_SLIDES);
});

test("byPpt ignores groups with no deck (no slides were uploaded)", () => {
  const out = byPpt([{ id: "g0", topic: "X", deck: null, items: [{ id: "q1", text: "t", pIdx: 0, marks: 5 }] }]);
  assert.deepEqual(out, []);
});

test("topicLabel weights acronyms over generic words", () => {
  const label = topicLabel([
    { text: "Explain the role of the WTO in global trade." },
    { text: "How does the WTO resolve trade disputes between nations?" },
  ]);
  assert.match(label, /WTO/);
});
