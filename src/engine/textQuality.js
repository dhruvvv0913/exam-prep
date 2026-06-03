// Decide whether text extracted from a PDF is good enough to analyse, or
// whether we should fall back to OCR. Two failure modes we catch:
//   1. EMPTY  — image-only scans give little/no text.
//   2. GARBLED — some scans carry a junk OCR text layer, e.g. COA 2025's
//      "SPRJNG", "Proga rne", "*ncster". The words are mostly non-words.
//
// Heuristic: real exam prose is full of common English words ("the", "what",
// "explain", "between"...). Garbled text has almost none. So we measure the
// fraction of words that are common-English; clean prose scores high, junk low.

const COMMON = new Set(
  ("the of and to in is are a an for with on at as by it its from this that these " +
   "be or how what why when which who whose where each both all any following given " +
   "explain define write state describe discuss compare difference between using use " +
   "system data model time marks question section answer").split(" ")
);

// Returns { usable, words, ratio } so callers can log/threshold if they want.
export function assessText(text) {
  const words = (text.toLowerCase().match(/[a-z]{2,}/g) || []);
  if (words.length < 20) return { usable: false, words: words.length, ratio: 0 };
  const hits = words.reduce((n, w) => n + (COMMON.has(w) ? 1 : 0), 0);
  const ratio = hits / words.length;
  // Clean prose lands ~0.15–0.35; garbled scans land near 0. 0.08 separates them.
  return { usable: ratio >= 0.08, words: words.length, ratio };
}

export const isUsableText = (text) => assessText(text).usable;
