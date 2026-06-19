// Tests for the pure "View original" crop matching/bounds (cropCore.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { startScore, findRegion, MARK, wordsOf } from "../src/engine/cropCore.js";

test("startScore counts the leading-word run, ignoring the marker token", () => {
  const qw = wordsOf("What is the hit ratio of the cache");
  // line carries a "(d)" marker before the same words
  assert.equal(startScore("(d) What is the hit ratio of the cache memory", qw), 8);
  // a different line shares only the first word
  assert.equal(startScore("What are addressing modes", qw), 1);
});

test("startScore survives a marker that collides with the content's first word", () => {
  // "(a) A cache…" normalises to "a a cache…"; the run must still find "a cache consists"
  const qw = wordsOf("A cache consists of a total of 512 blocks");
  assert.ok(startScore("4. (a) A cache consists of a total of 512 blocks", qw) >= 3);
});

test("startScore requires the question to start near the line start", () => {
  // qw[0] appears deep in the line (offset > 2) → no match
  assert.equal(startScore("see figure below then cache mapping explain", wordsOf("cache mapping explain it")), 0);
});

test("findRegion locates a question and bounds it at the next marker", () => {
  const pages = [{
    lines: [
      { text: "1. Answer all questions", topFrac: 0.10 },
      { text: "(a) Explain direct mapping in cache", topFrac: 0.20 },
      { text: "with a neat diagram of the blocks", topFrac: 0.26 },
      { text: "(b) Differentiate write-back and write-through", topFrac: 0.40 },
    ],
  }];
  const r = findRegion(pages, "Explain direct mapping in cache memory");
  assert.equal(r.pageIndex, 0);
  assert.ok(r.topFrac < 0.20 && r.topFrac >= 0.19); // just above the (a) line
  assert.ok(r.botFrac < 0.40 && r.botFrac > 0.26);  // bounded at the (b) marker
});

test("findRegion runs to the page bottom when no later marker exists", () => {
  const pages = [{
    lines: [
      { text: "(c) Describe virtual memory address translation", topFrac: 0.60 },
      { text: "and the role of the TLB in it", topFrac: 0.66 },
    ],
  }];
  const r = findRegion(pages, "Describe virtual memory address translation");
  assert.equal(r.botFrac, 1);
});

test("findRegion returns null below the match threshold", () => {
  const pages = [{ lines: [{ text: "(a) Define cache", topFrac: 0.3 }] }];
  assert.equal(findRegion(pages, "Booth multiplication algorithm steps"), null);
});

test("findRegion picks the best-scoring line across pages", () => {
  const pages = [
    { lines: [{ text: "(a) cache mapping techniques overview", topFrac: 0.5 }] },
    { lines: [{ text: "(a) cache mapping techniques compared in detail today", topFrac: 0.2 }] },
  ];
  const r = findRegion(pages, "cache mapping techniques compared in detail");
  assert.equal(r.pageIndex, 1); // longer consecutive run wins
});

test("MARK matches both numbering styles", () => {
  for (const s of ["1.", "1)", "(a)", "a)", "10. foo", "(b) bar"]) assert.ok(MARK.test(s), s);
  for (const s of ["Explain the", "cache memory", "- bullet"]) assert.equal(MARK.test(s), false, s);
});
