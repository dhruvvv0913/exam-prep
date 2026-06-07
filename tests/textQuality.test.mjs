// Tests for the usable-text-vs-needs-OCR heuristic.
import { test } from "node:test";
import assert from "node:assert/strict";
import { assessText, isUsableText } from "../src/engine/textQuality.js";

test("clean exam prose is usable", () => {
  const text = "Explain the difference between cache and main memory. " +
    "Describe how virtual memory translation works and what a TLB is used for. " +
    "Discuss the factors that affect the performance of a computer system.";
  const r = assessText(text);
  assert.equal(r.usable, true);
  assert.ok(r.ratio >= 0.08, `ratio ${r.ratio} should clear the 0.08 bar`);
});

test("garbled OCR junk is not usable", () => {
  const junk = "SPRJNG Proga rne ncster xkqz wptf zzql mmbr kkll pqrs tzvx " +
    "bvcx zxqw plmn okij nhbg vfre dswa qazx wsxc edcv rfvt gbnh";
  assert.equal(isUsableText(junk), false);
});

test("too-short text is not usable (needs >= 20 words)", () => {
  assert.equal(isUsableText("Define cache memory."), false);
});

test("assessText reports word count and ratio", () => {
  // 24 common words (>= the 20-word floor) -> high ratio.
  const r = assessText("the of and to in is are for with on at by it its from this that these what why when which who where");
  assert.ok(r.words >= 20);
  assert.ok(r.ratio > 0.5, "all-common-words text should score high");
});
