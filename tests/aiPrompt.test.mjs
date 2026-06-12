// Tests for the shared LLM-grouping prompt + chapter->deck mapping.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGroupingPrompt, chapterToDeck } from "../src/engine/aiPrompt.js";
import { NOT_ON_SLIDES } from "../src/engine/clusterCore.js";

test("chapterToDeck: real chapters pass; off-syllabus/empty -> NOT_ON_SLIDES; no slides -> null", () => {
  assert.equal(chapterToDeck("Number Representation", true), "Number Representation");
  assert.equal(chapterToDeck("Not on slides", true), NOT_ON_SLIDES);
  assert.equal(chapterToDeck("none", true), NOT_ON_SLIDES);
  assert.equal(chapterToDeck("", true), NOT_ON_SLIDES);
  assert.equal(chapterToDeck(null, true), NOT_ON_SLIDES);
  assert.equal(chapterToDeck("Anything", false), null); // no slides => no deck
});

test("buildGroupingPrompt lists chapters and asks for chapter-tagged JSON", () => {
  const p = buildGroupingPrompt([{ text: "Explain Booth's multiplication" }], ["Number Representation", "Cache Memory"]);
  assert.match(p, /Number Representation/);
  assert.match(p, /Cache Memory/);
  assert.match(p, /"chapter"/);
  assert.match(p, /1\. Explain Booth/); // questions are numbered for the model
});

test("buildGroupingPrompt with no chapters tells the model to null the chapter", () => {
  const p = buildGroupingPrompt([{ text: "Some question" }], []);
  assert.match(p, /set "chapter" to null/i);
});
