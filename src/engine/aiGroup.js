// Browser: AI grouping via the same-origin /api/group proxy. Only works for
// SIGNED-IN users (the proxy holds the key and requires a Supabase token). The
// heavy PDF parsing already happened locally — we send only the question text.
// Returns clusters in the shape rank.groupsFromClusters() expects, or THROWS so
// pipeline.analyze can fall back to the in-browser embedding grouping.
import { supabase } from "../lib/supabase.js";
import { NOT_ON_SLIDES } from "./clusterCore.js"; // pure import — does NOT pull the embedder
import { chapterToDeck } from "./aiPrompt.js";

// Cheap check used by the UI: is AI grouping reachable for this visitor?
export async function aiGroupAvailable() {
  if (!supabase) return false;
  const { data: { session } } = await supabase.auth.getSession();
  return Boolean(session);
}

export async function groupViaApi(items, topics = []) {
  if (!supabase) throw new Error("auth unavailable");
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("not signed in");

  const res = await fetch("/api/group", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ questions: items.map((q) => ({ text: q.text })), topics }),
  });
  if (!res.ok) throw new Error(`group api ${res.status}`);
  const { groups } = await res.json();
  if (!Array.isArray(groups)) throw new Error("bad response");

  // With slides, each type is tagged with its chapter (-> deck, powers "By PPT").
  // Without slides, deck stays null and only the "By importance" view shows.
  const hasChapters = topics.length > 0;
  // Map the model's 1-based question ids back to our items -> clusters.
  const used = new Set();
  const clusters = groups
    .map((g) => ({
      topic: String(g.topic || "Topic"),
      deck: chapterToDeck(g.chapter, hasChapters),
      items: (g.ids || [])
        .map((n) => items[n - 1])
        .filter((q) => q && !used.has(q))
        .map((q) => { used.add(q); return q; }),
    }))
    .filter((c) => c.items.length);
  const missed = items.filter((q) => !used.has(q));
  if (missed.length) clusters.push({ topic: "Ungrouped", deck: hasChapters ? NOT_ON_SLIDES : null, items: missed });
  return clusters;
}
