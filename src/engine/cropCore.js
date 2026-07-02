// Pure, Node-safe core of the "View original" crop: matching a parsed question
// to its line on a page and picking the crop's vertical bounds. Kept separate
// from cropQuestion.js (which does the browser-only pdf.js/Tesseract I/O) so it
// can be unit-tested without a DOM — same split as clusterCore vs cluster.

// A top-level "1." / "1)" or a part "(a)" / "a)" — the start of a new unit.
export const MARK = /^\s*(\(?\d{1,2}\s*[.)]|\(?[a-z]\s*[.)])/i;

export const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export const wordsOf = (s) => norm(s).split(" ").filter(Boolean);

// Two words are "the same" allowing ONE OCR slip (insert/delete/substitute) —
// only for longer words, so short tokens don't collapse into each other. Used by
// the loose page-level fallback, NOT by the strict `startScore` (which stays
// exact so precise strip bounds don't drift).
export function within1(a, b) {
  if (a === b) return true;
  if (a.length < 5 || b.length < 5) return false;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;            // deletion from a
    else if (b.length > a.length) j++;       // insertion into a
    else { i++; j++; }                        // substitution
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}
const setHasFuzzy = (set, w) => set.has(w) || [...set].some((s) => within1(s, w));

// How well a line STARTS the given question: the longest run of the question's
// first words that match consecutively at (near) the start of the line. We try
// each candidate start position 0–2 and keep the longest run, so a line like
// "(a) A cache…" → "a a cache…" still aligns on the content "a cache…" instead
// of stopping on the marker's "a". Robust to marker differences / minor OCR
// drift because the question text and the line text come from one extraction.
export function startScore(lineText, qw) {
  const lw = wordsOf(lineText);
  if (!lw.length || !qw.length) return 0;
  let best = 0;
  for (let start = 0; start <= 2 && start < lw.length; start++) {
    if (lw[start] !== qw[0]) continue;
    let n = 0;
    while (n < qw.length && start + n < lw.length && lw[start + n] === qw[n]) n++;
    if (n > best) best = n;
  }
  return best;
}

// How many of the question's leading CONTENT words (len ≥ 3, deduped) appear
// ANYWHERE on the page — order-free and OCR-fuzzy. Powers the whole-page
// fallback when the exact leading run can't be found.
export function pageCoverage(lines, qLoose) {
  const words = new Set();
  for (const l of lines) for (const w of wordsOf(l.text)) if (w.length >= 3) words.add(w);
  let cover = 0;
  for (const w of qLoose) if (setHasFuzzy(words, w)) cover++;
  return cover;
}

// Locate a question's crop strip across a paper's pages. `pages` is the line
// layout per page: [{ lines: [{ text, topFrac }] }] with topFrac = the line's
// top as a fraction (0–1) of page height.
//
// Returns { pageIndex, topFrac, botFrac } for a confident strip match (botFrac =
// the next question/part marker below, else the page bottom). If no line starts
// the question but a page still carries most of its words (the two extractions —
// e.g. an AI/OCR read vs. this re-OCR — diverged), returns that WHOLE page
// { pageIndex, topFrac: 0, botFrac: 1, approximate: true } so the student still
// sees the original instead of an error. Returns null only when nothing matches.
export function findRegion(pages, questionText) {
  const all = wordsOf(questionText);
  const qw = all.slice(0, 8);
  const qLoose = [...new Set(all.slice(0, 16).filter((w) => w.length >= 3))];
  let best = null;      // strict: { pi, li, sc }
  let bestPage = null;  // fallback: { pi, cover }
  for (let pi = 0; pi < pages.length; pi++) {
    const ls = pages[pi].lines || [];
    for (let li = 0; li < ls.length; li++) {
      const sc = startScore(ls[li].text, qw);
      if (sc >= 3 && (!best || sc > best.sc)) best = { pi, li, sc };
    }
    const cover = pageCoverage(ls, qLoose);
    if (!bestPage || cover > bestPage.cover) bestPage = { pi, cover };
  }

  if (best) {
    const ls = pages[best.pi].lines;
    const topFrac = Math.max(0, ls[best.li].topFrac - 0.004);
    let botFrac = 1; // default: to the bottom of the page
    for (let li = best.li + 1; li < ls.length; li++) {
      if (MARK.test(String(ls[li].text).trim())) { botFrac = Math.max(topFrac + 0.012, ls[li].topFrac - 0.004); break; }
    }
    return { pageIndex: best.pi, topFrac, botFrac };
  }

  // No confident leading run — fall back to the page carrying the most of the
  // question's words (needs ~40% of them, min 3, so a random page never wins).
  const need = Math.max(3, Math.ceil(qLoose.length * 0.4));
  if (bestPage && bestPage.cover >= need) {
    return { pageIndex: bestPage.pi, topFrac: 0, botFrac: 1, approximate: true };
  }
  return null;
}
