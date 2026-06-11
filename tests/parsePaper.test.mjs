// Tests for paper metadata detection + question splitting.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePaper, splitQuestions, assessSolutionSheet } from "../src/engine/parsePaper.js";

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

test("parses paren-style numbering (1) / a)) used by some mid-sems", () => {
  const paren = `1) Short Questions
a) Define cache memory and its purpose.
b) Explain virtual memory translation.
2) Differentiate between SRAM and DRAM in detail.
3) Describe Booth's multiplication algorithm clearly.`;
  const questions = splitQuestions(paren);
  const ids = questions.map((q) => q.id);
  // the "Short Questions" header stub is dropped; parts + later questions parse
  assert.deepEqual(ids, ["q1a", "q1b", "q2", "q3"]);
  assert.match(questions[0].text, /Define cache memory/);
});

test("dot-style answer-list bullets are NOT mis-split into questions", () => {
  // A dot-style paper whose Q1 answer lists "a) … b) …" must stay strict: the
  // bare "a)"/"b)" lines are continuation text, not new question parts.
  const dot = "1. Name the addressing modes. a) immediate b) direct c) indirect\n2. Explain pipelining in detail and its hazards.";
  const ids = splitQuestions(dot).map((q) => q.id);
  assert.deepEqual(ids, ["q1", "q2"]);
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

test("strips model answers in solution PDFs (incl. en-dash separator)", () => {
  const out = splitQuestions("1. Define cache memory and its purpose. Solution – Cache is a fast memory between the CPU and RAM. mark for definition");
  assert.equal(out.length, 1);
  assert.match(out[0].text, /Define cache memory/);
  assert.ok(!/Solution|fast memory|mark for/i.test(out[0].text), "the model answer must be removed");
});

test("very short / empty stems are discarded", () => {
  const out = splitQuestions("1. ok\n2. Explain the working of a hardwired control unit in detail.");
  assert.equal(out.length, 1); // "ok" is < 8 chars after cleaning
  assert.match(out[0].text, /hardwired control/i);
});

test("assessSolutionSheet: a normal question paper is NOT flagged", () => {
  const r = assessSolutionSheet(PAPER, parsePaper(PAPER).questions.length);
  assert.equal(r.isSolution, false);
  // parsePaper exposes the same flag on meta
  assert.equal(parsePaper(PAPER).meta.solution, false);
});

test("assessSolutionSheet: a lone 'Answer:' does not trip detection", () => {
  const text = "1. Define cache memory. Answer: a fast buffer.\n2. Explain pipelining in detail.\n3. Describe DMA transfers.";
  assert.equal(assessSolutionSheet(text, 3).isSolution, false);
});

test("assessSolutionSheet: an explicit 'Marking Scheme' header is flagged", () => {
  assert.equal(assessSolutionSheet("MARKING SCHEME\n1. Define cache memory.").isSolution, true);
});

test("assessSolutionSheet: pervasive per-question model answers are flagged", () => {
  const sheet = [
    "1. Define cache memory. Solution – a fast buffer between CPU and RAM.",
    "2. Explain virtual memory. Solution – translation of virtual to physical.",
    "3. What is a TLB? Ans: a cache of page-table entries.",
    "4. Describe DMA. Solution — direct memory access without the CPU.",
  ].join("\n");
  const r = assessSolutionSheet(sheet, parsePaper(sheet).questions.length);
  assert.equal(r.isSolution, true);
  assert.ok(r.markers >= 4, "should count the per-question answer separators");
});

test("'Answer all the questions' instruction is not counted as an answer", () => {
  // No separator after the word, so markers stay 0 and it isn't flagged.
  assert.equal(assessSolutionSheet("1. Answer all the questions\n(a) What is X?\n(b) Define Y.", 2).markers, 0);
});
