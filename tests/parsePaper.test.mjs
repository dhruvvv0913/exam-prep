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

test("detects exam type written with a hyphen (Mid-Semester)", () => {
  const { meta } = parsePaper("Mid-Semester Examination 2024\nComputer Organization\nCS21002\n1. Explain cache memory in detail.");
  assert.equal(meta.examType, "MID");
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

test("reads an explicit per-question marks token when the paper has one", () => {
  const out = splitQuestions("2. Explain virtual memory and address translation. [10]\n3. Differentiate SRAM and DRAM in detail. [5]");
  const by = Object.fromEntries(out.map((q) => [q.id, q.marks]));
  assert.equal(by.q2, 10);
  assert.equal(by.q3, 5);
});

test("marks token sums '+' parts; falls back to the estimate when absent", () => {
  const out = splitQuestions("2. Solve part A and part B of this numerical problem. [3+2]\n3. A long enough question with no marks token at all here.");
  const by = Object.fromEntries(out.map((q) => [q.id, q.marks]));
  assert.equal(by.q2, 5); // 3 + 2
  assert.equal(by.q3, 5); // estimate (no token)
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

test("dot-numbered paper with bare a) parts: parts recovered + Q1 parts = 1 mark", () => {
  // Mixed style: "1." numbers but "a)" parts (real KIIT pattern that used to
  // lose every sub-part). Q1 is the compulsory multi-part (>=3 parts) => 1 mark each.
  const paper = `MID SEMESTER EXAMINATION 2025
Operating Systems
1. Answer all the questions.
a) Define a process control block.
b) What is a context switch?
c) State two CPU scheduling criteria.
2. Explain the Resource Allocation Graph with an example.
3. Describe Peterson's solution to the critical section problem.`;
  const qs = splitQuestions(paper);
  const ids = qs.map((q) => q.id);
  assert.ok(ids.includes("q1a") && ids.includes("q1b") && ids.includes("q1c"), `parts lost: ${ids}`);
  for (const q of qs.filter((q) => q.num === "1")) assert.equal(q.marks, 1, `Q1 part should be 1 mark: ${q.id}`);
  assert.ok(ids.includes("q2") && ids.includes("q3"), `top-level questions lost: ${ids}`);
});

test("an inline MCQ options line (a) … b) … c)) is content, not new parts", () => {
  const paper = `MID SEMESTER EXAMINATION 2025
Operating Systems
1. Answer all the questions.
a) How many times will P0 print?
a) twice b) thrice c) once d) never
b) Define a semaphore.
c) What is a deadlock?`;
  const qs = splitQuestions(paper);
  const ids = qs.map((q) => q.id);
  // the options line must NOT create a stub or bump the numbering into q2
  assert.ok(ids.includes("q1a") && ids.includes("q1b") && ids.includes("q1c"), ids.join(","));
  assert.ok(!ids.includes("q2a"), `options line spawned a part: ${ids}`);
});

test("instruction stem with a real question after the terminator is kept, not dropped", () => {
  const paper = `MID SEMESTER EXAMINATION 2025
Operating Systems
1. Answer all the questions.
a) Define a process.
b) What is a thread?
c) Define a semaphore.
2. Answer the following questions: (i) Explain the five-state process model with a diagram.
3. Differentiate paging and segmentation in detail.`;
  const qs = splitQuestions(paper);
  const q2 = qs.find((q) => q.num === "2");
  assert.ok(q2, "Q2 (instruction + real question) was dropped");
  assert.ok(/five-state process model/i.test(q2.text), `Q2 text wrong: ${q2 && q2.text}`);
  assert.ok(!/^answer the following/i.test(q2.text), "instruction prefix not stripped");
});

test("a bare 'Answer the following questions' stem (no real content) is still dropped", () => {
  const qs = splitQuestions("1. Define cache memory in detail.\n2. Answer the following questions\n3. Explain virtual memory clearly.");
  assert.ok(!qs.some((q) => /^answer the following/i.test(q.text)), qs.map((q) => q.text).join(" | "));
});

test("OCR-mangled and bare marks tokens are stripped from question text", () => {
  // "=" OCR'd as ":" inside a split bracket
  const a = splitQuestions("1. Define cache memory clearly here for us. [3 + 2 : 5 Marks]\n2. Explain the TLB in good detail now.");
  assert.ok(!/marks?/i.test(a[0].text), `bracketed marks leaked: ${a[0].text}`);
  // unbracketed "5 Marks"
  const b = splitQuestions("1. Explain virtual memory in good detail here. 5 Marks\n2. Define paging clearly for us now.");
  assert.ok(!/5\s*marks/i.test(b[0].text), `bare marks leaked: ${b[0].text}`);
});

test("garbled OCR Q1 number ('74 Answer all the questions') still yields Q1's parts", () => {
  const paper = `MID SEMESTER EXAMINATION 2024
Computer Organization and Architecture
74 Answer all the questions. [1 Mark X 5]
a) What is Von Neumann architecture and how does it differ from Harvard?
b) Convert the decimal number 45 to its binary representation.
c) Define pipelining in a processor clearly.
2. Explain the memory hierarchy in detail with a diagram.`;
  const ids = splitQuestions(paper).map((q) => q.id);
  assert.ok(ids.includes("q1a") && ids.includes("q1b") && ids.includes("q1c"), `Q1 parts lost: ${ids}`);
  for (const q of splitQuestions(paper).filter((q) => q.num === "1")) assert.equal(q.marks, 1, `Q1 part should be 1 mark: ${q.id}`);
  assert.ok(ids.includes("q2"), `Q2 lost: ${ids}`);
});

test("the general rubric 'Answer any four…' is NOT treated as a question stem", () => {
  const paper = `MID SEMESTER EXAMINATION 2024
Subject: COA
Answer any four questions including question No.1 which is compulsory.
The figures in the margin indicate full marks.
1. Define cache memory and its purpose clearly.
2. Explain virtual memory translation in detail.`;
  const qs = splitQuestions(paper);
  assert.ok(!qs.some((q) => /including question|figures in the margin|compulsory/i.test(q.text)), qs.map((q) => q.text).join(" | "));
  assert.ok(qs.some((q) => /cache memory/i.test(q.text)) && qs.some((q) => /virtual memory/i.test(q.text)));
});
