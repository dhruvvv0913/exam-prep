// Groups <-> ranked display data.
//
// A "group" is the editable source of truth: { id, topic, items: [question] }.
// The analysis screen shows a derived, ranked view; the review screen edits the
// groups directly. Keeping groups as the source lets the user merge/split/rename
// without re-running the AI.
//   appears  = number of distinct exams (papers) the concept showed up in
//   variants = number of distinct question wordings found
import { NOT_ON_SLIDES } from "./clusterCore.js";

const STOP = new Set(
  ("the of and to in is are be a an for with on at as by it its from this that these how " +
   "what why when which who where each both all any following given using use explain define " +
   "write state describe discuss compare differentiate difference between find calculate consider " +
   "brief major role about can does do how various their there here also with respect " +
   // generic exam-formatting words — never the actual topic of a question
   "diagram neat suitable figure draw steps note notes short parts example examples").split(" ")
);

// Short human label for a group. Weights distinctive terms — acronyms (WTO,
// SDG, HDI) and proper nouns (Myrdal, Ricardo, Adam) — above generic content
// words, so labels name the actual topic instead of filler like "Development".
export function topicLabel(items) {
  const score = new Map(); // lowercase key -> total weight
  const disp = new Map(); // lowercase key -> { d: display form, w: best single weight }
  const consider = (token, weight, display) => {
    const k = token.toLowerCase();
    if (STOP.has(k) || k.length < 2) return;
    score.set(k, (score.get(k) || 0) + weight);
    if (!disp.has(k) || weight > disp.get(k).w) disp.set(k, { d: display, w: weight });
  };
  for (const it of items) {
    for (const a of (it.text.match(/\b[A-Z]{2,5}\b/g) || [])) consider(a, 3, a); // acronyms
    for (const w of (it.text.match(/\b[A-Z][a-z]{3,}\b/g) || [])) consider(w, 2, w); // proper nouns
    for (const w of (it.text.toLowerCase().match(/[a-z]{4,}/g) || [])) consider(w, 1, w[0].toUpperCase() + w.slice(1));
  }
  const top = [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => disp.get(k).d);
  return top.join(" · ") || "General";
}

// The longest wording is usually the most descriptive => use as representative.
const representative = (items) => items.slice().sort((a, b) => b.text.length - a.text.length)[0];

// Raw clusters (with embedding vecs) -> serializable, editable groups.
// Slide-anchored clusters carry a real `topic` name (from the slides); for
// bottom-up clusters we synthesise a label from the questions themselves.
export function groupsFromClusters(clusters) {
  return clusters.map((c, i) => ({
    id: `g${i}`,
    topic: c.topic || topicLabel(c.items),
    // which PPT/slide deck this type-group belongs to (fine slide-anchored
    // grouping). null when no slides were uploaded; NOT_ON_SLIDES for the
    // off-syllabus bucket. Powers the "By PPT" view.
    deck: c.deck ?? null,
    items: c.items.map((it) => ({
      uid: `${it.pIdx ?? 0}__${it.id}`, // stable per-question identity for editing
      pIdx: it.pIdx ?? 0, // which uploaded paper it came from (for the "appears" count)
      id: it.id,
      text: it.text,
      paperId: it.paperId,
      year: it.year ?? null,
      marks: it.marks ?? 5,
    })),
  }));
}

// One group -> its derived display row (shared by summarize and byPpt).
function enrichGroup(g) {
  // "appears" = distinct uploaded papers (by pIdx), robust to two papers
  // sharing a session/year label.
  const papers = new Set(g.items.map((it) => it.pIdx ?? it.paperId));
  const rep = representative(g.items);
  const marksOf = (it) => (typeof it.marks === "number" ? it.marks : 5);
  const totalMarks = g.items.reduce((s, it) => s + marksOf(it), 0);
  // newest year first; unknown years sink to the bottom
  const ordered = [...g.items].sort((a, b) => (b.year ?? -1) - (a.year ?? -1));
  return {
    id: g.id,
    topic: g.topic,
    deck: g.deck ?? null, // which PPT this type belongs to (for the By PPT view)
    totalMarks, // collective marks across all questions in the group
    q: rep.text, // representative (kept for back-compat / Node scripts)
    appears: papers.size,
    variants: g.items.length,
    // full list of questions in the group (year-sorted), for the card layout
    questions: ordered.map((it) => ({ src: `${it.year ?? "?"} · ${it.paperId}`, paperId: it.paperId, pIdx: it.pIdx ?? null, text: it.text, year: it.year ?? null, marks: marksOf(it) })),
    similars: g.items
      .filter((it) => it !== rep)
      .map((it) => ({ src: `${it.year ?? "?"} · ${it.paperId}`, text: it.text })),
    unique: papers.size < 2,
  };
}

// Most exam weight first, then repetition, then count. Shared comparator.
const byWeight = (a, b) => b.totalMarks - a.totalMarks || b.appears - a.appears || b.variants - a.variants;

// Groups -> ranked display data for the analysis screen ("By importance").
export function summarize(groups) {
  const enriched = groups.filter((g) => g.items.length > 0).map(enrichGroup);
  const ranked = enriched.filter((c) => !c.unique).sort(byWeight);
  const unique = enriched.filter((c) => c.unique);
  return { ranked, unique };
}

// The "By PPT" view: bucket the SAME type-groups under their slide deck (PPT),
// each PPT showing every question-type asked from it (repeated AND asked-once),
// ranked by exam weight. A per-deck header aggregates marks / distinct exams.
// Off-syllabus types collect under one final NOT_ON_SLIDES bucket. Groups with
// no deck (no slides were uploaded) are skipped — the UI hides this view then.
export function byPpt(groups) {
  const byDeck = new Map(); // deck label -> [enriched type]
  for (const g of groups) {
    if (g.items.length === 0 || g.deck == null) continue;
    if (!byDeck.has(g.deck)) byDeck.set(g.deck, []);
    byDeck.get(g.deck).push(enrichGroup(g));
  }
  const decks = [...byDeck.entries()].map(([deck, types]) => {
    types.sort(byWeight);
    const papers = new Set(types.flatMap((t) => t.questions.map((q) => q.pIdx ?? q.paperId)));
    return {
      deck,
      types,
      typeCount: types.length,
      questionCount: types.reduce((s, t) => s + t.variants, 0),
      appears: papers.size, // distinct exams this PPT's questions span
      totalMarks: types.reduce((s, t) => s + t.totalMarks, 0),
    };
  });
  // Heaviest PPT first; the off-syllabus bucket always last.
  decks.sort((a, b) =>
    (a.deck === NOT_ON_SLIDES) - (b.deck === NOT_ON_SLIDES) ||
    b.totalMarks - a.totalMarks || b.appears - a.appears);
  return decks;
}

// Back-compat for the Node dev scripts: clusters -> { ranked, unique }.
export function rankClusters(clusters) {
  return summarize(groupsFromClusters(clusters));
}
