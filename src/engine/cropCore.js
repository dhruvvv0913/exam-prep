// Pure, Node-safe core of the "View original" crop: matching a parsed question
// to its line on a page and picking the crop's vertical bounds. Kept separate
// from cropQuestion.js (which does the browser-only pdf.js/Tesseract I/O) so it
// can be unit-tested without a DOM — same split as clusterCore vs cluster.

// A top-level "1." / "1)" or a part "(a)" / "a)" — the start of a new unit.
export const MARK = /^\s*(\(?\d{1,2}\s*[.)]|\(?[a-z]\s*[.)])/i;

export const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export const wordsOf = (s) => norm(s).split(" ").filter(Boolean);

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

// Locate a question's crop strip across a paper's pages. `pages` is the line
// layout per page: [{ lines: [{ text, topFrac }] }] with topFrac = the line's
// top as a fraction (0–1) of page height. Returns { pageIndex, topFrac, botFrac }
// (botFrac = the next question/part marker below, else the page bottom), or null
// when the question can't be confidently located (needs a ≥3-word run).
export function findRegion(pages, questionText) {
  const qw = wordsOf(questionText).slice(0, 8);
  let best = null; // { pi, li, sc }
  for (let pi = 0; pi < pages.length; pi++) {
    const ls = pages[pi].lines || [];
    for (let li = 0; li < ls.length; li++) {
      const sc = startScore(ls[li].text, qw);
      if (sc >= 3 && (!best || sc > best.sc)) best = { pi, li, sc };
    }
  }
  if (!best) return null;
  const ls = pages[best.pi].lines;
  const topFrac = Math.max(0, ls[best.li].topFrac - 0.004);
  let botFrac = 1; // default: to the bottom of the page
  for (let li = best.li + 1; li < ls.length; li++) {
    if (MARK.test(String(ls[li].text).trim())) { botFrac = Math.max(topFrac + 0.012, ls[li].topFrac - 0.004); break; }
  }
  return { pageIndex: best.pi, topFrac, botFrac };
}
