// Tests for slide-deck topic extraction + deck labelling.
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractTopics, extractDeckTopics, deckLabel } from "../src/engine/slides.js";

test("extractTopics picks per-slide titles and drops bullets/footers", () => {
  const slides = [
    "Introduction\n• overview of the course\nLecture 1",
    "Cache Memory\n• mapping techniques\nLecture 1",
    "Booth Multiplication\n• signed numbers\nLecture 1",
    "Virtual Memory\n• paging and the TLB\nLecture 1",
    "Pipelining\n• data and control hazards\nLecture 1",
  ];
  const topics = extractTopics(slides);
  assert.ok(topics.includes("Cache Memory"));
  assert.ok(topics.includes("Booth Multiplication"));
  assert.ok(!topics.includes("Lecture 1"), "running footer should be dropped");
  assert.ok(!topics.some((t) => t.startsWith("•")), "bullets are body, not titles");
});

test("extractTopics rejects gibberish-only slides (no real vowel-word)", () => {
  const topics = extractTopics(["KPQR\nMNTX\nZXCV"]); // no vowels anywhere
  assert.equal(topics.length, 0);
});

test("extractTopics rejects long sentence fragments and mark tokens", () => {
  const topics = extractTopics([
    "Consider a fully associative cache with eight blocks numbered zero to seven and",
    "OSGN - OSPN [10]",
  ]);
  assert.equal(topics.length, 0);
});

test("deckLabel cleans a slide filename into a chapter name", () => {
  assert.equal(deckLabel("8 COA Addressing Modes.pdf"), "Addressing Modes");
  assert.equal(deckLabel("1 COA Introduction (1).pdf"), "Introduction");
  assert.equal(deckLabel("13 Memory System 2024.pdf"), "Memory System");
  assert.equal(deckLabel("11 Basic Processing Unit.pdf"), "Basic Processing Unit");
});

test("deckLabel collapses near-duplicate decks to the same chapter (so they merge)", () => {
  // A trailing version letter and a stray year are dropped, so two uploads of
  // the same chapter share one label (and thus one "By PPT" section).
  assert.equal(deckLabel("14 Cache Memory B.pdf"), "Cache Memory");
  assert.equal(deckLabel("14_Cache_Memory_2024.pdf"), "Cache Memory");
  assert.equal(deckLabel("14 Cache Memory B.pdf"), deckLabel("14_Cache_Memory_2024.pdf"));
});

test("extractDeckTopics tags each title with its deck label", () => {
  const { titles, deckOf } = extractDeckTopics([
    { label: "Cache Memory", slides: ["Cache Memory\nmapping techniques"] },
    { label: "Arithmetic", slides: ["Booth Multiplication\nsigned numbers"] },
  ]);
  assert.equal(titles.length, deckOf.length);
  const i = titles.indexOf("Cache Memory");
  assert.ok(i >= 0);
  assert.equal(deckOf[i], "Cache Memory");
});
