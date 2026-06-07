// Concept clustering: group questions about the same topic, even when worded
// differently, using sentence-embeddings from a small AI model that runs
// locally (transformers.js — free, no API, no key).
//
// This module owns the EMBEDDER (the model). The pure clustering math lives in
// clusterCore.js (Node-safe, unit-tested) and is re-exported here so existing
// importers (pipeline, scripts) keep working unchanged.
import { pipeline, env } from "@xenova/transformers";
import { clusterVectors, anchorVectors } from "./clusterCore.js";

export { clusterVectors, anchorVectors, extractKeywords, dot } from "./clusterCore.js";

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

// items: [{ id, text, paperId, year, examType, marks }]
export async function clusterQuestions(items, opts = {}) {
  const vecs = await embed(items.map((q) => q.text), opts);
  return clusterVectors(items, vecs, opts);
}

// topics: [string]   items: [{ id, text, ... }]   opts.deckOf: parallel labels
export async function anchorQuestions(items, topics, opts = {}) {
  const qVecs = await embed(items.map((q) => q.text), opts);
  const topicVecs = await embed(topics, opts);
  return anchorVectors(items, qVecs, topics, topicVecs, opts);
}
