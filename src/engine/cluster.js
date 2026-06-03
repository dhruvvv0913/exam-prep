// Concept clustering: group questions about the same topic, even when worded
// differently, using sentence-embeddings from a small AI model that runs
// locally (transformers.js — free, no API, no key).
import { pipeline, env } from "@xenova/transformers";

// Fully self-hosted: load the model and the ONNX-runtime WASM from our OWN
// origin (files live in public/models and public/ort), never an external CDN.
// Essential on locked-down networks (e.g. college Wi-Fi) where requests to
// huggingface.co / jsdelivr get intercepted and return an HTML page — which
// then fails to parse as JSON ("Unexpected token '<', "<!doctype"...").
env.allowRemoteModels = false;     // never reach out to HF
env.allowLocalModels = true;
env.localModelPath = "/models/";   // -> public/models/<model>
env.backends.onnx.wasm.wasmPaths = "/ort/"; // -> public/ort/ort-wasm-*.wasm
env.backends.onnx.wasm.numThreads = 1; // single-thread: no COOP/COEP headers needed
// Don't use the browser Cache Storage: a failed run can cache an HTML error
// page under the model URL and replay it forever (a hard refresh won't clear
// it). Always fetch fresh from our own server.
env.useBrowserCache = false;

// bge-small-en-v1.5 (CLS pooling) was the most accurate in A/B testing on real
// papers: it groups paraphrased repeats (e.g. AI/ML/DL across years) that the
// smaller all-MiniLM model misses. Threshold 0.72 is calibrated to its scale.
export const MODEL = "Xenova/bge-small-en-v1.5";
export const POOLING = "cls";

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
function extractKeywords(text) {
  const words = (text.toLowerCase().match(/[a-z]{4,}/g) || []).filter((w) => !STOP.has(w));
  const acronyms = (text.match(/\b[A-Z]{2,5}\b/g) || []).map((a) => a.toLowerCase());
  return new Set([...words, ...acronyms]);
}

// Load each embedding model once and reuse it.
const _embedders = new Map();
async function getEmbedder(modelId = MODEL) {
  if (!_embedders.has(modelId)) _embedders.set(modelId, await pipeline("feature-extraction", modelId));
  return _embedders.get(modelId);
}

// Embed strings -> normalized vectors (Float32Array). `pooling` is per-model.
export async function embed(texts, { modelId = MODEL, pooling = POOLING } = {}) {
  const embedder = await getEmbedder(modelId);
  const out = [];
  for (const t of texts) {
    const res = await embedder(t, { pooling, normalize: true });
    out.push(Float32Array.from(res.data));
  }
  return out;
}

// Cosine similarity of two already-normalized vectors == dot product.
function dot(a, b) {
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

// items: [{ id, text, paperId, year, examType, marks }]
export async function clusterQuestions(items, opts = {}) {
  const vecs = await embed(items.map((q) => q.text), opts);
  return clusterVectors(items, vecs, opts);
}
