// Append one analysis's groups into another's, re-basing pIdx so paper counts
// don't collide. Used when the admin approves a "pool into an existing subject"
// contribution. Same-topic groups are NOT auto-merged — the admin tidies those
// in the review screen afterward. Pure / Node-safe (no Supabase), so it's unit-
// testable and reused by libraryDb.approveContribution.
export function mergeContent(target, add) {
  const tGroups = target.groups || [];
  const maxP = Math.max(-1, ...tGroups.flatMap((g) => g.items.map((it) => it.pIdx ?? 0)));
  const offset = maxP + 1;
  const shifted = (add.groups || []).map((g) => ({
    ...g,
    items: g.items.map((it) => { const p = (it.pIdx ?? 0) + offset; return { ...it, pIdx: p, uid: `${p}__${it.id}` }; }),
  }));
  const groups = [...tGroups, ...shifted].map((g, i) => ({ ...g, id: `g${i}` }));
  const questionCount = groups.reduce((n, g) => n + g.items.length, 0);
  const paperCount = new Set(groups.flatMap((g) => g.items.map((it) => it.pIdx))).size;
  return { papers: [...(target.papers || []), ...(add.papers || [])], groups, questionCount, paperCount, topicCount: groups.length };
}
