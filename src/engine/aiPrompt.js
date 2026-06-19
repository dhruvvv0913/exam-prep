// The LLM question-grouping prompt + chapter→deck mapping, shared by the
// in-app proxy (api/group.js) and the admin offline script (scripts/llm-group.mjs)
// so the two never drift. The LLM is the high-accuracy grouping path: it puts
// each question under the right chapter with clean labels and no off-syllabus
// dumping — what the in-browser embedding pass can't match.
//
// Output shape: FINE "question types", each tagged with a `chapter` (the slide
// deck / PPT it belongs to), which feed the app's "By importance" + "By PPT"
// views. Pure / Node-safe (no DOM).
import { NOT_ON_SLIDES } from "./clusterCore.js";

export function buildGroupingPrompt(questions, chapters = []) {
  const numbered = questions
    .map((q, i) => `${i + 1}. ${String(q.text || "").replace(/\s+/g, " ").slice(0, 400)}`)
    .join("\n");
  const has = chapters && chapters.length;
  const chapterList = has ? chapters.map((c) => `- ${c}`).join("\n") : "(none)";
  return `You are organising a college exam-prep tool. Past-exam questions are listed below. Group them into FINE "question types" — each type is the set of questions that test the SAME specific thing (the same numerical, derivation, definition, or concept), even when worded differently or garbled by OCR — so students see exactly which questions recur across years and can study them together.

${has
  ? `Course chapters (from the uploaded slide decks):
${chapterList}

Tag every question type with the ONE chapter it belongs to — copy a chapter name from the list above VERBATIM. A chapter normally contains SEVERAL distinct question types; that is expected and wanted. If a question is genuinely not covered by any chapter above, set its chapter to "Not on slides".`
  : `No chapters were provided, so set "chapter" to null for every group.`}

Rules:
- Use EVERY question exactly once — each number appears in exactly one group.
- Make types SPECIFIC, not broad: inside a "Cache Memory" chapter, "direct-mapping hit-ratio numericals" and "write-back vs write-through" are TWO separate types. Never collapse a whole chapter into a single type.
- Merge questions that are the same underlying problem even if their numbers/wording differ or OCR mangled them.
- "topic" = a short, clear, student-friendly name for the type (e.g. "Booth's multiplication", "Direct-mapping hit ratio", "Von Neumann vs Harvard"). No marks, no question numbers, no OCR gibberish in the label.

Questions:
${numbered}

Respond with ONLY a JSON object, no prose, in exactly this shape:
{"groups":[{"chapter":${has ? `"<a chapter from the list above, or 'Not on slides'>"` : "null"},"topic":"<short type label>","ids":[<question numbers>]}]}`;
}

// "Improve result" — a QUALITY-CHECK pass over an EXISTING grouping. The model
// sees the current groups and only CORRECTS mistakes (move a misfit question,
// merge same-type groups, split a mixed one, fix labels) rather than regrouping
// from scratch. Output shape is identical to buildGroupingPrompt, so the same
// mapping applies. `current` = [{ topic, chapter, ids:[1-based question #s] }].
export function buildRefinePrompt(questions, current, chapters = []) {
  const numbered = questions
    .map((q, i) => `${i + 1}. ${String(q.text || "").replace(/\s+/g, " ").slice(0, 400)}`)
    .join("\n");
  const has = chapters && chapters.length;
  const chapterList = has ? chapters.map((c) => `- ${c}`).join("\n") : "(none)";
  const cur = (current || [])
    .map((g, i) => `${i + 1}. "${g.topic}"${has && g.chapter ? ` [chapter: ${g.chapter}]` : ""} → questions ${(g.ids || []).join(", ")}`)
    .join("\n");
  return `You are QUALITY-CHECKING an existing grouping of past-exam questions for a study tool. They were auto-grouped into "question types", but some questions may sit in the wrong group, some groups may be duplicates of the same type, some may mix two types, and some labels may be unclear.

Questions (numbered):
${numbered}

Current grouping:
${cur}

${has
  ? `Course chapters:
${chapterList}

Keep each group tagged with the ONE chapter it belongs to — copy a chapter name VERBATIM, or "Not on slides" if none fits.`
  : `No chapters were provided, so set "chapter" to null for every group.`}

AUDIT and CORRECT — change ONLY what is actually wrong, and leave correct groupings untouched:
- Move a question into the group whose type it genuinely matches.
- MERGE groups that are really the same question-type.
- SPLIT a group that clearly mixes two distinct types.
- Fix unclear or wrong "topic" labels (short, student-friendly).
- Use EVERY question exactly once (each number appears in exactly one group).

Respond with ONLY the corrected FULL grouping as JSON, no prose, in exactly this shape:
{"groups":[{"chapter":${has ? `"<a chapter from the list above, or 'Not on slides'>"` : "null"},"topic":"<short type label>","ids":[<question numbers>]}]}`;
}

// "AI scan": a VISION transcription pass for papers our local OCR couldn't read
// cleanly. The model is sent the page IMAGES and must transcribe the QUESTIONS
// faithfully (clean text we then split with parsePaper). Used only when local
// extraction is poor, for signed-in users. Shared by the proxy (api/scan.js).
export function buildScanPrompt() {
  return `You are transcribing a scanned or photographed university exam question paper that automatic OCR could not read cleanly. Reproduce its QUESTIONS as clean plain text, faithfully — this will be parsed by a program, so structure matters.

Rules:
- Output EVERY question and sub-part. Preserve the numbering EXACTLY as printed: top-level "1." "2." …, parts "(a)" "(b)" … (or "a)" "b)" if that is how it is printed), roman sub-parts "(i)" "(ii)".
- Put each question / part on its OWN line, starting with its marker. Keep the marks token if it is shown next to a question (e.g. "[5]", "[1 x 10]", "[3+2]").
- Write any mathematics, formulae, registers, binary/hex, tables inline in plain text. For a diagram / figure / circuit / graph that cannot be written as text, put "[diagram]" where it appears — do NOT invent its contents.
- Transcribe ONLY the question-paper text. SKIP the institute header, exam rubric/instructions ("Answer any four…", "figures in the margin…"), candidate/branch/code lines, page numbers, footers, and ANY printed answers or marking scheme.
- Do NOT solve, summarise, translate, or rephrase. Transcribe what is printed (silently fixing obvious OCR-level letter garble within words).

Return ONLY the transcribed question text — no preamble, no commentary, no markdown fences.`;
}

// Normalise the model's chapter string to a deck label. Off-syllabus / missing
// chapters collapse to NOT_ON_SLIDES; when no slides were provided, deck is null
// (so only the "By importance" view shows).
export function chapterToDeck(chapter, hasChapters) {
  if (!hasChapters) return null;
  const s = String(chapter ?? "").trim();
  return (!s || /^(not on slides|none|off.?syllabus|n\/?a)$/i.test(s)) ? NOT_ON_SLIDES : s;
}
