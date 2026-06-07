// Tests for paper metadata detection + question splitting.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePaper, splitQuestions } from "../src/engine/parsePaper.js";

const PAPER = `END SEMESTER EXAMINATION 2024
SPRING
Computer Organisation and Architecture
CS21002
Full Marks : 50
1. (a) Define cache memory and its purpose.
(b) Explain virtual memory translation.
(c) What is a TLB?
2. Differentiate between SRAM and DRAM.
3. Describe Booth's multiplication algorithm.`;

test("parseMeta detects exam type, session, year, code, marks, subject", () => {
  const { meta } = parsePaper(PAPER);
  assert.equal(meta.examType, "END");
  assert.equal(meta.session, "Spring");
  assert.equal(meta.year, 2024);
  assert.equal(meta.code, "CS21002");
  assert.equal(meta.fullMarks, 50);
  assert.match(meta.subject, /Computer Organisation/i);
});

test("year tolerates OCR O-for-0", () => {
  const { meta } = parsePaper("END SEMESTER EXAMINATION 2O24\nSPRING\nSubject Title\nCS21002");
  assert.equal(meta.year, 2024);
});

test("splits numbered questions and inline parts with stable ids", () => {
  const { questions } = parsePaper(PAPER);
  const ids = questions.map((q) => q.id);
  assert.deepEqual(ids, ["q1a", "q1b", "q1c", "q2", "q3"]);
});

test("marks: a multi-part Q1 is 1 mark/part, everything else 5", () => {
  const { questions } = parsePaper(PAPER);
  const by = Object.fromEntries(questions.map((q) => [q.id, q.marks]));
  assert.equal(by.q1a, 1); // Q1 has 3 parts => short-answer scheme
  assert.equal(by.q2, 5);
  assert.equal(by.q3, 5);
});

test("drops 'Answer the following questions' instruction headers", () => {
  const text = "1. Answer the following questions\n(a) What is X?\n(b) Define Y.";
  const { questions } = parsePaper(text);
  assert.equal(questions.length, 2);
  assert.ok(!questions.some((q) => /answer the following/i.test(q.text)));
});

test("very short / empty stems are discarded", () => {
  const out = splitQuestions("1. ok\n2. Explain the working of a hardwired control unit in detail.");
  assert.equal(out.length, 1); // "ok" is < 8 chars after cleaning
  assert.match(out[0].text, /hardwired control/i);
});
