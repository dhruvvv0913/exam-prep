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

test("Q-prefixed numbering ('Q1.' and OCR 'Ql.') is parsed; directive stem dropped", () => {
  const paper = `MID SEMESTER EXAMINATION 2020
Computer Organization and Architecture
Ql. Write short answers or do as directed.
a) What is Von Neumann architecture and how does it differ from Harvard?
b) Explain the register content after a shift instruction in good detail.
c) Why is the WFMC needed in a control step, explain here.
Q2. a) What do you mean by register transfer notation, explain in detail?
b) Write a routine for the PUSH and POP stack operations clearly.`;
  const qs = splitQuestions(paper);
  const ids = qs.map((q) => q.id);
  assert.ok(ids.includes("q1a") && ids.includes("q1b") && ids.includes("q1c"), `Q1 parts lost: ${ids}`);
  assert.ok(ids.includes("q2a") && ids.includes("q2b"), `Q2 parts lost: ${ids}`);
  assert.ok(!qs.some((q) => /do as directed|write short answers/i.test(q.text)), "directive stem not dropped");
  for (const q of qs.filter((q) => q.num === "1")) assert.equal(q.marks, 1, `Q1 part should be 1 mark: ${q.id}`);
});

// ---- numbered answer-list / sub-task-list guard (solved papers) ----------

test("numbered ANSWER list in a solved paper does not create phantom questions", () => {
  // Modelled on the OS Feb-2026 model-answer paper: Q1(e) asks about the PCB,
  // then "Ans." + a numbered list of PCB fields ("1. Process ID", ...) which
  // used to parse as phantom questions q1_, q2, q3...
  const paper = `MID SEMESTER EXAMINATION 2026
Operating Systems
1. Answer all the questions. [1 Mark X 5]
(a) What do the burst times of these processes indicate exactly?
(b) What must the time quantum be for round robin here?
(c) Give an example of a voluntary context switch scenario.
(d) How does a system call differ from a function call?
(e) Explain the working procedure of the process control block.
Ans.
The PCB stores the following information about a process.
1. Process ID
When a process is created, a unique id is assigned to the process.
2. Program counter
A program counter is a register that stores the next instruction address.
3. Process State
The process moves through several states during its lifetime.
4. Priority
Every process has its own priority level assigned.
5. General Purpose Registers
Every process has its own set of register contents saved.
2. (a) Consider a system with semaphores and describe its behaviour fully.
(b) Using semaphores, design a solution for a traffic signal controller.`;
  const qs = splitQuestions(paper);
  const ids = qs.map((q) => q.id);
  assert.deepEqual(ids, ["q1a", "q1b", "q1c", "q1d", "q1e", "q2a", "q2b"], `phantom questions: ${ids}`);
  // and the answer content itself was stripped from q1e (Ans. separator)
  const q1e = qs.find((q) => q.id === "q1e");
  assert.ok(!/process id|program counter/i.test(q1e.text), `answer leaked into q1e: ${q1e.text}`);
});

test("numbered SUB-TASK list inside a question stays attached (no phantom questions)", () => {
  // Modelled on the OOPJ Feb-2026 paper: Q4(a) describes a system then lists
  // numbered requirements 1..4 — they are part of Q4(a), not new questions.
  const paper = `MID SEMESTER EXAMINATION 2026
Object Oriented Programming
1. Answer all the questions briefly. [1 Mark X 5]
(a) What is multiple inheritance and how does an interface support it?
(b) What will be the output of the following code segment exactly?
(c) What is the output of this code snippet, explain briefly?
2. (a) Write a program to receive five integers from the user cleanly.
(b) Define a class to implement a stack data structure in Java.
3. (a) Define a class Player with name, gender and age as data members.
(b) Create a user-defined package named college with a class inside.
4. (a) A university wants to design a Digital Evaluation System where different assessments are evaluated.
1. Analyze why an interface-based design is appropriate for this system.
2. Design an interface Evaluation with a method calculateScore.
3. Implement the interface in the three classes mentioned above.
4. Demonstrate runtime polymorphism using an interface reference.
(b) While writing a program when does it become mandatory to use a default method?`;
  const qs = splitQuestions(paper);
  const ids = qs.map((q) => q.id);
  assert.deepEqual(ids, ["q1a", "q1b", "q1c", "q2a", "q2b", "q3a", "q3b", "q4a", "q4b"], `phantom questions: ${ids}`);
  const q4a = qs.find((q) => q.id === "q4a");
  assert.ok(/interface-based design/i.test(q4a.text), `sub-tasks lost from q4a: ${q4a.text}`);
});

test("an answer list marching PAST the current question number stays rejected", () => {
  // Modelled on the EOD Feb-2026 answer scheme: under Q3(a), a list runs
  // 1..5 — items 4 and 5 exceed the current question number 3 and used to
  // become phantom q4/q5.
  const paper = `MID SEMESTER EXAMINATION 2026
Economics of Development
1. Define economic growth in one or two clear sentences.
2. Explain the Lorenz curve and its meaning in detail.
3. (a) Division of labour increases economic development in several ways as follows:
1. Increasing productivity
2. Saving time
3. Improving skills of workers
4. Encouraging technological innovation
5. Expanding markets
(b) The Invisible Hand means individuals pursuing their self-interest promote welfare.
4. Explain the difference between growth and development fully.`;
  const qs = splitQuestions(paper);
  const ids = qs.map((q) => q.id);
  assert.deepEqual(ids, ["q1", "q2", "q3a", "q3b", "q4"], `phantom questions: ${ids}`);
  const q4 = qs.find((q) => q.id === "q4");
  assert.ok(/growth and development/i.test(q4.text), `wrong q4: ${q4.text}`);
});

test("an absurd number jump ('33.33%' OCR'd as a question number) is content, not a question", () => {
  const paper = `MID SEMESTER EXAMINATION 2026
Economics of Development
1. Define national income properly with an example.
2. Explain income distribution among the population groups here.
33.33% of the income goes to the top decile in this example table.
3. Describe the Gini coefficient and what it measures exactly.`;
  const qs = splitQuestions(paper);
  const ids = qs.map((q) => q.id);
  assert.deepEqual(ids, ["q1", "q2", "q3"], `junk number became a question: ${ids}`);
});

test("SECTION headers allow legitimate per-section renumbering", () => {
  const paper = `END SEMESTER EXAMINATION 2025
Subject Title Here
SECTION-A
1. Define cache memory and its purpose clearly.
2. Explain virtual memory translation in detail.
SECTION-B
1. Describe pipelining hazards with clear examples.
2. Compare RISC and CISC architectures in detail.`;
  const qs = splitQuestions(paper);
  assert.equal(qs.length, 4, `section renumbering broken: ${qs.map((q) => q.id)}`);
  assert.ok(qs.some((q) => /pipelining hazards/i.test(q.text)), "Section B Q1 lost");
});

test("assessSolutionSheet flags an explicit 'Answer Scheme' header", () => {
  const r = assessSolutionSheet("SPRING MID SEMESTER EXAMINATION-2026\nEconomics of Development\nAnswer Scheme\n1. Something here.", 3);
  assert.equal(r.isSolution, true);
  assert.equal(r.explicit, true);
});

test("the marks-note 'answer to each question carries 1 mark' is noise, not a question", () => {
  const qs = splitQuestions("1. Appropriate answer to each question carries 1 mark. [ 1 Mark X 5 ]\n2. Define elasticity of demand with an example.");
  assert.ok(!qs.some((q) => /carries 1 mark/i.test(q.text)), qs.map((q) => q.text).join(" | "));
});

test("a content-free 'Write short notes on any two' stem is dropped; one WITH topics is kept", () => {
  const qs = splitQuestions(`1. Define cache memory and its purpose clearly.
2. Write short notes on any two of the following
3. Write short notes on any two.
4. Write short notes on any two among the followings: Outer join in relational algebra, Views, Triggers.`);
  const texts = qs.map((q) => q.text);
  assert.ok(!texts.some((t) => /^write short notes on any two\.?$/i.test(t)), `stub kept: ${texts}`);
  assert.ok(!texts.some((t) => /any two of the following$/i.test(t)), `stub kept: ${texts}`);
  assert.ok(texts.some((t) => /outer join/i.test(t)), `real short-notes question lost: ${texts}`);
});

test("a directive stem with leading OCR junk (curly quote) is still dropped", () => {
  const qs = splitQuestions("1. ‘Write short answers or do as directed.\na) Define cache memory and its purpose clearly.\nb) Explain virtual memory translation in detail.");
  assert.ok(!qs.some((q) => /do as directed/i.test(q.text)), qs.map((q) => q.text).join(" | "));
  assert.ok(qs.some((q) => /cache memory/i.test(q.text)), "parts lost");
});
