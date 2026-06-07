// Turn the raw text of one exam paper into structured data:
//   { meta: { examType, session, year, subject, code, fullMarks },
//     questions: [ { id, num, part, text } ] }
//
// Pure functions only (no DOM / no pdfjs), so this is easy to unit-test in
// Node against real extracted text. Designed for the 3 KIIT formats; see
// memory: paper-formats-and-extraction-findings.

// ---- noise: lines that are never question content ----------------------
const NOISE = [
  /^Qn\.?\s*Set\s*Code/i,
  /SEMESTER\s+EXAMINATION/i,
  /^\d+\s*h?\s*Semester\b/i,
  /^Semester\s*:/i,
  /^Programme\s*:/i,
  /^Branch\s*[:(]/i,
  /^Time\s*:/i,
  /^Full\s*Marks?\s*:/i,
  /^Answer\s+(any|all|the)\b/i,
  /Question\s+paper\s+consists/i,
  /^A[t]+empt\b/i,
  /figures\s+in\s+the\s+margin/i,
  /Candidates\s+are\s+required/i,
  /answers\s+in\s+their\s+own\s+words/i,
  /^Section\s+[ABC]\s+(is\s+compulsory|b\s+corrr)/i,
  /^SECTION\s*-?\s*[ABC]\b/i,
  /^School\s+of\b/i,
  /Kalinga\s+Institute/i,
  /Deemed\s+to\s+be\s+University/i,
  /^K[I1]+T[\s-]*DU/i, // footer: KIIT-DU/2025/SOT...
  /Spring\s+End\s+Semester\s+Examination/i,
  /^\*+\s*$/, // *****
  /Best\s+of\s+Luck/i,
  /^=+\s*PAGE/i, // our own page markers (dev)
  /^Subject\s*Name\s*:/i, // running headers on solution scans
  /^Sub\b.*Code\s*:/i,
  /^th\b/i, // stray superscript "th" from "4th"
];

// A line that is ONLY a marks token, e.g. "[5]", "[S]", "(5]", "[1 x 10]".
const MARKS_ONLY = /^[[(]\s*[\dSsIl][\dSsIl\s×xX+=.,Mark]*[\])]$/;

// Marks tokens to strip from inside a question line.
const MARKS_INLINE = /[[(]\s*[\dSsIl][\dSsIl\s×xX+=.,]*\s*(?:Marks?)?\s*[\])]/g;

const isNoise = (l) => NOISE.some((re) => re.test(l)) || MARKS_ONLY.test(l);

// ---- metadata ----------------------------------------------------------
// A line that could be the subject title (works for ALL-CAPS and Title Case).
function looksLikeTitle(l) {
  if (l.length < 4 || isNoise(l)) return false;
  if (/EXAMINATION|SEMESTER|^Qn|B\.?Tech|Branch|Programme|Admitted|Marks|Time\s*:/i.test(l)) return false;
  if (/&/.test(l) || (l.match(/,/g) || []).length >= 2) return false; // branch lists
  return /[A-Za-z]{5,}/.test(l); // has a real word
}

function parseMeta(text) {
  const lines = text.split("\n").map((l) => l.trim());
  // Tolerant of garbled scans: match each field independently, allow the
  // letter "O" misread for "0" in the year, and "." / "-" separators.
  const examType = (/(MID|END)\s+SEMESTER/i.exec(text) || [])[1]?.toUpperCase() || null;
  const sessM = /\b(SPRING|AUTUMN|WINTER|SUMMER|FALL)\b/i.exec(text);
  const session = sessM ? sessM[1][0].toUpperCase() + sessM[1].slice(1).toLowerCase() : null;
  const yM = /EXAMINATION[.\-\s]*([12][0-9O][0-9O]{2})/i.exec(text) || /\b([12][0O]\d{2})\b/.exec(text);
  const year = yM ? Number(yM[1].replace(/O/gi, "0")) : null;
  const codeM = /\b([A-Z]{2}\d{4,5})\b/i.exec(text);
  const code = codeM ? codeM[1].toUpperCase() : null;
  const fullMarks = Number((/Full\s*Marks?\s*:\s*(\d+)/i.exec(text) || [])[1]) || null;

  // Subject sits just above the subject code; walk up past noise lines (Time,
  // brackets, etc.) to the first title-like line. Works for "INDUSTRY 4.0
  // TECHNOLOGIES" and Title-Case "Operating Systems" alike.
  let subject = null;
  const codeIdx = code ? lines.findIndex((l) => new RegExp(code, "i").test(l)) : -1;
  if (codeIdx > 0) {
    for (let i = codeIdx - 1; i >= 0 && i >= codeIdx - 5; i--) {
      if (looksLikeTitle(lines[i])) { subject = lines[i]; break; }
    }
  }
  if (!subject) subject = lines.find(looksLikeTitle) || null; // fallback
  return { examType, session, year, subject: cleanSubject(subject), code, fullMarks };
}

// Tidy a detected subject title: drop leading OCR junk (stray symbols, or a lone
// "I"/"l"/"1"/"|" left over from a margin mark, e.g. "I ENVIRONMENTAL SCIENCES").
function cleanSubject(s) {
  if (!s) return null;
  return s
    .replace(/^[^A-Za-z0-9]+/, "")
    .replace(/^[Il1|0-9]\s+(?=[A-Za-z])/, "")
    .replace(/\s+/g, " ")
    .trim() || null;
}

// ---- question splitting ------------------------------------------------
const cleanText = (s) =>
  s
    // Drop any model answer in solution PDFs: keep only the question stem.
    // The separator may be a hyphen, colon, period, or an en/em-dash (– —),
    // which KIIT solution sheets use ("Solution – ...").
    .replace(/\b(Ans(wer)?|Solution|Note)\b\s*[-–—:.].*$/is, " ")
    // OCR noise from scans:
    .replace(/Page\s*\d+\s*\/\s*\d+/gi, " ") // "Page 5 / 7" footers
    .replace(/K[\w-]{0,4}D[uU][\s\S]*$/g, " ") // "KIIT-DU/2025/..." exam footer to end
    .replace(MARKS_INLINE, " ")
    .replace(/\[\s*\d{1,3}\s*[\])]?/g, " ") // bracketed mark artifacts: "[5]" "[51" "[10"
    .replace(/\b\d{1,2}\s*[\])]/g, " ") // orphan marks: "15]" "5)" "5]"
    .replace(/[|*]{2,}|\*k[ok]+/gi, " ") // OCR'd dividers / "*****" -> "*kokokk"
    .replace(/\[\s*[A-Za-z&]{1,3}\s*\]/g, " ") // junk like "[EB]" "[&]"
    .replace(/[\[\]{}]+/g, " ") // stray brackets/braces e.g. "[&)]"
    .replace(/[«»©®~^_|@]+/g, " ") // stray OCR symbols
    .replace(/(^|\s)[&)(]+(?=\s|$)/g, " ") // orphan "&" ")" "(" tokens
    .replace(/\(\s*[A-Za-z]{0,2}\s*$/g, " ") // trailing partial "(DO" "(@" "("
    .replace(/\s+([.,?])/g, "$1") // tidy space-before-punctuation
    .replace(/\s+/g, " ")
    .trim();

// Line starting a numbered question, optionally with an inline part:
//   "1. (a) text"  |  "1. text"  |  "4."
// NOTE: kept deliberately strict ("1." + "(a)"). Broadening to "1)"/"a)" was
// tried and reverted — it doubled the question count on KIIT *solution* sheets
// by matching answer-list bullets ("a) ...", "1) ...") as new questions.
const Q_NUM = /^(\d{1,2})\.\s*(?:\(([a-z])\)\s*)?(.*)$/i;
// Line starting a part of the current question: "(a) text"
const Q_PART = /^\(([a-z])\)\s*(.*)$/i;

export function splitQuestions(text) {
  const out = [];
  const seen = new Set();
  let cur = null;
  let curNum = null;
  let lastPart = null; // last part letter seen under curNum
  // "Answer all the questions" / "Answer any two of the following" are exam
  // instructions that ride in as a question stem (e.g. "1. Answer the following
  // questions") — not real content.
  const isInstruction = (t) => /^answer\s+(all|any|the\s+following)\b/i.test(t);
  const flush = () => {
    if (cur) {
      const text = cleanText(cur.text);
      if (text.length > 8 && !isInstruction(text)) {
        cur.text = text;
        let id = `q${cur.num}${cur.part || ""}`;
        while (seen.has(id)) id += "_"; // guarantee uniqueness
        seen.add(id);
        cur.id = id;
        out.push(cur);
      }
    }
    cur = null;
  };

  for (const raw of text.split("\n")) {
    const l = raw.trim();
    if (!l || isNoise(l)) continue;

    let m = Q_NUM.exec(l);
    if (m) {
      flush();
      curNum = m[1];
      const part = m[2] ? m[2].toLowerCase() : null;
      lastPart = part;
      cur = { num: curNum, part, text: m[3] || "" };
      continue;
    }
    m = Q_PART.exec(l);
    if (m && curNum) {
      const part = m[1].toLowerCase();
      const isRoman = part === "i" || part === "v" || part === "x";
      const sequential = lastPart && part.charCodeAt(0) === lastPart.charCodeAt(0) + 1;
      // (i)/(v)/(x) that don't continue the a,b,c… sequence are roman SUB-parts
      // of the current question — keep them attached instead of making a tiny
      // stub question. (Multi-letter romans like (ii)/(iii) already fall through
      // to the continuation case below.)
      if (isRoman && !sequential && cur) {
        cur.text += ` (${part}) ` + (m[2] || "");
        continue;
      }
      // A part letter that doesn't advance (e.g. another "(a)" after "(b)")
      // means the question NUMBER was dropped by the PDF — start a new one.
      if (lastPart && part <= lastPart) curNum = String(Number(curNum) + 1);
      lastPart = part;
      flush();
      cur = { num: curNum, part, text: m[2] || "" };
      continue;
    }
    // continuation of the current question
    if (cur) cur.text += " " + l;
  }
  flush();

  // Marks per question (standard KIIT scheme): the compulsory multi-part Q1
  // (mid-sem and end-sem Section-A) is worth 1 mark per part; every other part
  // is a 5-mark long-answer question. We detect "Q1 is multi-part" by counting
  // its parts, so it works across all three formats without reading the (often
  // garbled) marks column.
  const q1Parts = out.filter((q) => q.num === "1").length;
  const q1IsShort = q1Parts >= 3;
  for (const q of out) q.marks = (q.num === "1" && q1IsShort) ? 1 : 5;

  return out;
}

// ---- solution-sheet detection ------------------------------------------
// Decide whether an uploaded PDF is really an *answer key / solution sheet*
// rather than a question paper. Such PDFs still parse (cleanText strips the
// "Solution – …" model answers, keeping the stems), but the written answers
// blur the grouping and inflate counts, so we warn the user to prefer the
// question paper. Pure + Node-safe; runs on the RAW extracted text.
//
//   questionCount — how many questions splitQuestions() found (for the ratio).
// Returns { isSolution, markers, explicit }.
export function assessSolutionSheet(text, questionCount = 0) {
  const t = text || "";
  // An explicit answer-key header is conclusive on its own.
  const explicit = /\b(marking\s+scheme|model\s+answers?|answer\s+key|scheme\s+of\s+(?:valuation|evaluation)|solution\s+sheet)\b/i.test(t);
  // Per-question model-answer lead-ins: "Solution –", "Ans:", "Answer -",
  // "Soln.". This is the same separator cleanText strips, so counting it
  // estimates how many questions carry a written answer. The separator char
  // after the word is required, so the instruction "Answer all the questions"
  // (word followed by a space, not a separator) is NOT counted.
  const markers = (t.match(/\b(?:Ans(?:wer)?|Soln?|Solution)\b\s*[-–—:.]/gi) || []).length;
  // Pervasive = a lot of answers in absolute terms, OR enough to cover ~half the
  // detected questions (so a lone stray "Answer:" in a normal paper won't trip).
  const pervasive = markers >= 6 || (markers >= 3 && questionCount > 0 && markers >= Math.ceil(questionCount * 0.5));
  return { isSolution: explicit || pervasive, markers, explicit };
}

// ---- public entry point ------------------------------------------------
export function parsePaper(text) {
  const meta = parseMeta(text);
  const questions = splitQuestions(text);
  return { meta: { ...meta, solution: assessSolutionSheet(text, questions.length).isSolution }, questions };
}
