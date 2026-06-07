// Groups <-> ranked display data.
//
// A "group" is the editable source of truth: { id, topic, items: [question] }.
// The analysis screen shows a derived, ranked view; the review screen edits the
// groups directly. Keeping groups as the source lets the user merge/split/rename
// without re-running the AI.
//   appears  = number of distinct exams (papers) the concept showed up in
//   variants = number of distinct question wordings found

const STOP = new Set(
  ("the of and to in is are be a an for with on at as by it its from this that these how " +
   "what why when which who where each both all any following given using use explain define " +
   "write state describe discuss compare differentiate difference between find calculate consider " +
   "brief major role about can does do how various their there here also with respect").split(" ")
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

// Groups -> ranked display data for the analysis screen.
export function summarize(groups) {
  const enriched = groups
    .filter((g) => g.items.length > 0)
    .map((g) => {
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
    });

  // Rank by total marks (most exam weight first), then repetition, then count.
  const ranked = enriched
    .filter((c) => !c.unique)
    .sort((a, b) => b.totalMarks - a.totalMarks || b.appears - a.appears || b.variants - a.variants);
  const unique = enriched.filter((c) => c.unique);
  return { ranked, unique };
}

// The "By paper" view: regroup the SAME questions by their source paper (pIdx),
// in original question order, each tagged with the topic it belongs to (so the
// UI can cross-link a question back to its topic group). Pure / derived.
export function byPaper(groups) {
  const papers = new Map(); // key -> { pIdx, paperId, year, questions: [] }
  for (const g of groups) {
    for (const it of g.items) {
      const key = it.pIdx ?? it.paperId ?? 0;
      if (!papers.has(key)) papers.set(key, { pIdx: it.pIdx ?? 0, paperId: it.paperId, year: it.year ?? null, questions: [] });
      papers.get(key).questions.push({
        id: it.id, text: it.text, marks: typeof it.marks === "number" ? it.marks : 5,
        topic: g.topic, topicId: g.id, year: it.year ?? null, paperId: it.paperId,
      });
    }
  }
  // Order questions within a paper by their number/part parsed from the id (q1a…).
  const ord = (id) => { const m = /(\d+)\s*([a-z]?)/i.exec(id || ""); return m ? Number(m[1]) * 100 + (m[2] ? m[2].toLowerCase().charCodeAt(0) - 96 : 0) : 9999; };
  const out = [...papers.values()].map((p) => {
    p.questions.sort((a, b) => ord(a.id) - ord(b.id));
    p.totalMarks = p.questions.reduce((s, q) => s + q.marks, 0);
    p.count = p.questions.length;
    return p;
  });
  out.sort((a, b) => (b.year ?? -1) - (a.year ?? -1) || a.pIdx - b.pIdx); // newest first
  return out;
}

// Back-compat for the Node dev scripts: clusters -> { ranked, unique }.
export function rankClusters(clusters) {
  return summarize(groupsFromClusters(clusters));
}
