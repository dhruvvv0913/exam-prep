// Pure clustering logic — no model, no DOM, Node-safe. Split out from cluster.js
// (which owns the transformers.js embedder) so these can be unit-tested and
// A/B-tuned without loading the embedding model. cluster.js re-exports these.

// Words that carry no topic signal: stopwords + generic exam verbs/phrasing.
const STOP = new Set(
  ("the of and to in is are be a an for with on at as by it its from this that these how what why " +
   "when which who where each both all any following given using use explain define write state describe " +
   "discuss compare differentiate difference between find calculate consider brief major role about can " +
   "does do various their there here also respect example importance concept basic types short note").split(" ")
);

// Topic words for a question: content words (len>=4, minus stopwords) plus
// short UPPERCASE acronyms (AR, VR, AI, ML, DL, IoT, M2M...) which are strong
// topic signals but too short for the word filter.
export function extractKeywords(text) {
  const words = (text.toLowerCase().match(/[a-z]{4,}/g) || []).filter((w) => !STOP.has(w));
  const acronyms = (text.match(/\b[A-Z]{2,5}\b/g) || []).map((a) => a.toLowerCase());
  return new Set([...words, ...acronyms]);
}

// Cosine similarity of two already-normalized vectors == dot product.
export function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

// Pure clustering given precomputed vectors (so it's easy to A/B test models).
//
// Complete-linkage: an item joins a cluster only if it's similar (>= threshold)
// to EVERY member, avoiding "junk-drawer" clusters. PLUS a keyword guard: in the
// weaker similarity band [threshold, strong), the item must also share a real
// topic word with the cluster — this stops questions that merely share generic
// exam phrasing from grouping. Words that appear in most questions (e.g. the
// subject name) are treated as non-distinctive and ignored.
//
// items: [{ id, text, ... }]   returns clusters: [{ items: [...] }] largest-first
export function clusterVectors(items, vecs, { threshold = 0.72, strong = 0.89 } = {}) {
  const kwSets = items.map((it) => extractKeywords(it.text));
  const N = items.length;
  const df = new Map();
  for (const s of kwSets) for (const w of s) df.set(w, (df.get(w) || 0) + 1);
  const ubiquitous = new Set([...df].filter(([, c]) => c / N > 0.5).map(([w]) => w));
  const kw = kwSets.map((s) => new Set([...s].filter((w) => !ubiquitous.has(w))));

  const clusters = [];
  items.forEach((item, i) => {
    const v = vecs[i];
    let best = null;
    let bestAvg = -1;
    for (const c of clusters) {
      let min = Infinity, sum = 0;
      for (const m of c.items) { const s = dot(v, m.vec); if (s < min) min = s; sum += s; }
      if (min < threshold) continue;
      const shares = [...kw[i]].some((w) => c.kw.has(w));
      if (min < strong && !shares) continue; // weak match needs a shared topic word
      const avg = sum / c.items.length;
      if (avg > bestAvg) { bestAvg = avg; best = c; }
    }
    if (best) { best.items.push({ ...item, vec: v }); for (const w of kw[i]) best.kw.add(w); }
    else clusters.push({ items: [{ ...item, vec: v }], kw: new Set(kw[i]) });
  });

  return clusters.sort((a, b) => b.items.length - a.items.length);
}

// ---- slide-anchored grouping (strict) ----------------------------------
//
// When the user supplies course slides we have a real topic taxonomy to group
// AGAINST, instead of discovering clusters bottom-up. Strict mode assigns every
// question to its single nearest slide TITLE; a question whose best match is
// below `floor` goes to one "Not on slides" bucket rather than a forced match.
// When `deckOf` is given, questions are GROUPED by the matched title's deck
// label (coarser) so a topic spanning many slide titles aggregates into one
// group; without it, grouping is per title.
//
// `floor` is calibrated for bge-small CLS cosines, whose short-text similarities
// bunch up around 0.65–0.80: on real COA papers, correct topic matches scored
// ≥0.73 while questions with no matching slide peaked at ~0.69, so 0.70 cleanly
// routes off-syllabus questions to "Not on slides". The admin review then fixes
// any borderline calls. Returns clusters [{ topic, items }] largest-first, with
// the "Not on slides" bucket always last.
export function anchorVectors(items, qVecs, topics, topicVecs, { floor = 0.70, deckOf = null } = {}) {
  const labelOf = (j) => (deckOf ? deckOf[j] : topics[j]);
  const buckets = new Map(); // label -> { topic, items }
  const leftover = [];
  items.forEach((item, i) => {
    let bestJ = -1, best = -Infinity;
    for (let j = 0; j < topicVecs.length; j++) {
      const s = dot(qVecs[i], topicVecs[j]);
      if (s > best) { best = s; bestJ = j; }
    }
    if (bestJ >= 0 && best >= floor) {
      const lab = labelOf(bestJ);
      if (!buckets.has(lab)) buckets.set(lab, { topic: lab, items: [] });
      buckets.get(lab).items.push(item);
    } else {
      leftover.push(item);
    }
  });
  const groups = [...buckets.values()].sort((a, b) => b.items.length - a.items.length);
  if (leftover.length) groups.push({ topic: "Not on slides", items: leftover });
  return groups;
}
