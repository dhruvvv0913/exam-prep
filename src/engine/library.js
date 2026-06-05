// Subject library: pre-computed analysis results bundled as static JSON under
// public/library/. index.json lists the subjects; <id>.json is a full result
// (same shape pipeline.analyze returns), so students open one instantly.

export async function loadLibraryIndex() {
  try {
    const r = await fetch("/library/index.json");
    if (!r.ok) return [];
    return (await r.json()).subjects || [];
  } catch {
    return [];
  }
}

export async function loadLibrarySubject(id) {
  const r = await fetch(`/library/${encodeURIComponent(id)}.json`);
  if (!r.ok) throw new Error("Could not load this subject.");
  return await r.json();
}
