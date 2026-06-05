// Turn slide-deck text into a clean topic taxonomy used to ANCHOR grouping.
//
// Each "slide" is one chunk of text (a PDF page). The slide TITLE — almost
// always the first real line — becomes a topic. Lines that repeat across most
// slides are running headers/footers (course name, "Lecture 4", slide numbers)
// and are dropped. We rely on per-slide titles only: on real decks they ARE the
// syllabus ("Cache Memory", "Booth Multiplication", "Bus Structure"), whereas
// agenda/outline slides tend to be wrapped, keyword-stuffed fragments that would
// hijack questions under strict matching — so those are intentionally skipped.
//
// Pure + Node-safe (no DOM / no pdfjs) so scripts/test-slides.mjs can test it.

// Lines that are structural chrome, never a topic.
const FOOTER = [
  /^\d{1,3}$/,                                   // bare slide number
  /^(slide|page|lecture|lec|unit|module|chapter|ch|topic)\s*[-:.]?\s*\d+$/i,
  /^\d{1,2}\s*(?:\/|of)\s*\d{1,3}$/i,            // "3 / 40", "3 of 40"
  /copyright|all\s+rights\s+reserved|©/i,
  /^(dr|prof|mr|ms|mrs)\.?\s+[a-z]/i,            // presenter line
  /^(thank\s*you|thanks|the\s+end|q\s*&\s*a|questions\??|review|references?|summary)$/i,
];

// Leading bullet glyphs, incl. the ones PowerPoint exports from Wingdings/Symbol
// fonts (Ø, §, », ➢…) which otherwise look like the start of a title.
const BULLET = /^[\s•▪◦·∙*‣o›»►▶➢➤❖✦◆Ø§¦]+/;

const isFooter = (l) => FOOTER.some((re) => re.test(l));

// Tidy a candidate into a bare topic phrase.
function clean(t) {
  return t
    .replace(/\s+/g, " ")
    .replace(BULLET, "")
    .replace(/^[^\sA-Za-z0-9(]+/, "")                 // any other leading symbol gunk
    .replace(/^\d+[.)]\s*/, "")                       // "1) ", "2. "
    .replace(/^\([ivxlc]+\)\s*/i, "")                 // "(ii) "
    .replace(/\s*[-–—:]?\s*\(?\bcont(?:inued|d)?\.?\)?\s*$/i, "")
    .replace(/[\s:–-]+$/, "")
    .trim();
}

// Sentence/problem lead-ins: a "title" starting like this is really body prose
// wrapped onto the title line (e.g. "Consider a fully associative cache…").
const SENTENCE_LEADIN = /^(consider|let\b|assume|suppose|given\b|note that|in the\b|the (contents|sense|following|above|number|value|figure)|be both|cells all|enables|initially|if |when |where |here |we |you |this |these |there |it )/i;

// Is a CLEANED string a usable standalone topic (vs prose / fragment / gibberish)?
function isTopicPhrase(t) {
  if (t.length < 3 || t.length > 64) return false;
  if (isFooter(t)) return false;
  if (/^(and|or|but|with|to|for|in|on)\b/i.test(t)) return false; // line-wrap continuation
  if (SENTENCE_LEADIN.test(t)) return false;         // wrapped body sentence
  if (/[.;]\s+\S/.test(t)) return false;             // mid-line sentence break ⇒ prose
  if (/,\s*$/.test(t)) return false;                 // trailing comma ⇒ wrapped line
  if ((t.match(/,/g) || []).length >= 2) return false; // comma-separated list dump
  if (/[\[(]\s*\d/.test(t)) return false;            // mark token e.g. "[10]" ⇒ exam noise
  if (/\?$/.test(t)) return false;                   // a question, not a topic
  // Titles are short noun phrases; a long run of words is a sentence fragment.
  const words = t.match(/[A-Za-z0-9’'./-]+/g) || [];
  if (words.length > 8) return false;
  // Reject OCR gibberish: needs at least one real word (≥3 letters with a vowel).
  if (!words.some((w) => w.length >= 3 && /[aeiou]/i.test(w))) return false;
  return true;
}

// A raw line that could be the slide's TITLE (a heading, not a body bullet).
function titleOf(raw) {
  if (BULLET.test(raw)) return null;                 // bullets are body content
  const t = clean(raw);
  return isTopicPhrase(t) ? t : null;
}

// slides: array of strings (one per slide/page).
// Returns an ordered, de-duplicated list of topic strings.
export function extractTopics(slides, { maxTopics = 300 } = {}) {
  const slideLines = slides
    .map((s) => String(s || "").split("\n").map((l) => l.trim()).filter(Boolean))
    .filter((lines) => lines.length > 0);

  // Lines appearing on a large fraction of slides are headers/footers, not
  // topics. Only trust this signal once there are enough slides to judge.
  const freq = new Map();
  for (const lines of slideLines) {
    for (const l of new Set(lines.map((x) => x.toLowerCase()))) freq.set(l, (freq.get(l) || 0) + 1);
  }
  const n = slideLines.length;
  const ubiquitous = (l) => n >= 5 && (freq.get(l.toLowerCase()) || 0) / n > 0.4;

  const topics = [];
  const seen = new Set();
  for (const lines of slideLines) {
    if (topics.length >= maxTopics) break;
    let title = null;
    for (const l of lines) {
      if (ubiquitous(l)) continue;
      title = titleOf(l);
      if (title) break;
    }
    if (!title) continue;
    const k = title.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    topics.push(title);
  }

  return topics;
}

// Turn a slide-deck FILENAME into a human label, used as the coarse grouping
// topic ("8 COA Addressing Modes.pdf" -> "Addressing Modes"). Strips the
// extension, copy markers, a leading index number, a stray year, and a leading
// subject acronym (COA, CSE…). Falls back to the raw stem if nothing's left.
export function deckLabel(name = "") {
  const stem = String(name).replace(/^.*[\\/]/, "").replace(/\.[a-z0-9]+$/i, "");
  let s = stem
    .replace(/\((\d+)\)/g, " ")             // "(1)" duplicate marker
    .replace(/^\s*\d+[\s._)-]*/, "")        // leading index "8 ", "8."
    .replace(/_/g, " ")
    .replace(/\b(?:19|20)\d{2}\b/g, " ")    // stray year
    .replace(/^[A-Z]{2,4}\b[\s_-]*/, "")    // leading subject acronym "COA "
    .replace(/\s+/g, " ")
    .trim();
  return s.length >= 3 ? s : stem.trim();
}

// Coarse, deck-level topic taxonomy. `decks` is [{ label, slides: [chunk] }].
// We still extract per-slide TITLES (precise targets for matching a question),
// but tag each title with its deck's label so anchoring can GROUP by deck —
// fixing over-granular slide titles that otherwise scatter one repeated topic
// ("Addressing Modes" asked every year) across many "asked once" sub-titles.
// Returns { titles: [string], deckOf: [string] } (parallel arrays).
export function extractDeckTopics(decks, opts = {}) {
  const titles = [];
  const deckOf = [];
  for (const d of decks) {
    const ts = extractTopics(d.slides, opts);
    const label = d.label && d.label.length >= 3 ? d.label : (ts[0] || d.label || "Topic");
    for (const t of ts) { titles.push(t); deckOf.push(label); }
  }
  return { titles, deckOf };
}
