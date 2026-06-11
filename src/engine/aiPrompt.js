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

// Normalise the model's chapter string to a deck label. Off-syllabus / missing
// chapters collapse to NOT_ON_SLIDES; when no slides were provided, deck is null
// (so only the "By importance" view shows).
export function chapterToDeck(chapter, hasChapters) {
  if (!hasChapters) return null;
  const s = String(chapter ?? "").trim();
  return (!s || /^(not on slides|none|off.?syllabus|n\/?a)$/i.test(s)) ? NOT_ON_SLIDES : s;
}
