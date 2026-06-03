// Turn raw clusters into ranked, display-ready data.
//   appears  = number of distinct exams (papers) the concept showed up in
//   variants = number of distinct question wordings found
// A concept that appears in >= 2 exams is a "repeat" (ranked); one that shows
// up in a single exam is "asked once" (lower priority).

const STOP = new Set(
  ("the of and to in is are be a an for with on at as by it its from this that these how " +
   "what why when which who where each both all any following given using use explain define " +
   "write state describe discuss compare differentiate difference between find calculate consider " +
   "brief major role about can does do how various their there here also with respect").split(" ")
);

// Short human label from the most frequent meaningful words across the cluster.
function topicLabel(items) {
  const freq = new Map();
  for (const it of items) {
    for (const w of (it.text.toLowerCase().match(/[a-z]{4,}/g) || [])) {
      if (STOP.has(w)) continue;
      freq.set(w, (freq.get(w) || 0) + 1);
    }
  }
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([w]) => w[0].toUpperCase() + w.slice(1));
  return top.join(" · ") || "General";
}

// The longest wording is usually the most descriptive => use as representative.
const representative = (items) => items.slice().sort((a, b) => b.text.length - a.text.length)[0];

export function rankClusters(clusters) {
  const enriched = clusters.map((c, i) => {
    const papers = new Set(c.items.map((it) => it.paperId));
    const rep = representative(c.items);
    return {
      id: "c" + i,
      topic: topicLabel(c.items),
      marks: rep.marks || "",
      q: rep.text,
      appears: papers.size,
      variants: c.items.length,
      similars: c.items
        .filter((it) => it !== rep)
        .map((it) => ({ src: `${it.year ?? "?"} · ${it.paperId}`, text: it.text })),
      unique: papers.size < 2,
    };
  });

  const score = (c) => c.appears * 100 + c.variants;
  const ranked = enriched.filter((c) => !c.unique).sort((a, b) => score(b) - score(a));
  const unique = enriched.filter((c) => c.unique);
  return { clusters: enriched, ranked, unique };
}
