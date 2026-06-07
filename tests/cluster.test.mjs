// Tests for the pure clustering math (no embedding model needed).
import { test } from "node:test";
import assert from "node:assert/strict";
import { clusterVectors, anchorVectors, extractKeywords } from "../src/engine/clusterCore.js";

// Unit vectors so dot product == cosine similarity.
const u = (x, y) => [x, y, 0];

test("strongly-similar questions merge into one cluster", () => {
  const items = [{ id: "a", text: "cache memory mapping" }, { id: "b", text: "cache memory blocks" }];
  const vecs = [u(1, 0), u(0.95, Math.sqrt(1 - 0.95 ** 2))]; // cos ~0.95 >= strong
  const clusters = clusterVectors(items, vecs, { threshold: 0.72, strong: 0.89 });
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].items.length, 2);
});

test("below-threshold questions stay separate", () => {
  const items = [{ id: "a", text: "cache memory" }, { id: "b", text: "booth multiplication" }];
  const vecs = [u(1, 0), u(0.5, Math.sqrt(1 - 0.25))]; // cos 0.5 < threshold
  const clusters = clusterVectors(items, vecs, { threshold: 0.72, strong: 0.89 });
  assert.equal(clusters.length, 2);
});

test("weak-band match without a shared topic word does NOT merge (keyword guard)", () => {
  const items = [{ id: "a", text: "explain photosynthesis process" }, { id: "b", text: "describe cellular respiration" }];
  const vecs = [u(1, 0), u(0.8, 0.6)]; // cos 0.8 in [threshold, strong)
  const clusters = clusterVectors(items, vecs, { threshold: 0.72, strong: 0.89 });
  assert.equal(clusters.length, 2);
});

test("clusters are returned largest-first", () => {
  const items = [{ id: "a", text: "cache one" }, { id: "b", text: "cache two" }, { id: "c", text: "isolated topic xyz" }];
  const vecs = [u(1, 0), u(0.99, Math.sqrt(1 - 0.99 ** 2)), u(0, 1)];
  const clusters = clusterVectors(items, vecs, { threshold: 0.72, strong: 0.89 });
  assert.equal(clusters[0].items.length, 2);
});

test("extractKeywords keeps content words + acronyms, drops stopwords", () => {
  const kw = extractKeywords("Explain the role of the WTO in global trade");
  assert.ok(kw.has("wto"));
  assert.ok(kw.has("global"));
  assert.ok(!kw.has("the"));
  assert.ok(!kw.has("explain")); // generic exam verb
});

test("anchorVectors assigns each question to its nearest topic's deck", () => {
  const items = [{ id: "a", text: "cache" }, { id: "b", text: "booth" }, { id: "c", text: "off syllabus" }];
  const qVecs = [u(1, 0), u(0, 1), [0.5, 0.5, 0.7071]]; // c is far from both topics
  const topics = ["Cache title", "Arithmetic title"];
  const topicVecs = [u(1, 0), u(0, 1)];
  const deckOf = ["Memory", "Arithmetic"];
  const groups = anchorVectors(items, qVecs, topics, topicVecs, { floor: 0.7, deckOf });
  const byTopic = Object.fromEntries(groups.map((g) => [g.topic, g.items.map((it) => it.id)]));
  assert.deepEqual(byTopic["Memory"], ["a"]);
  assert.deepEqual(byTopic["Arithmetic"], ["b"]);
  assert.deepEqual(byTopic["Not on slides"], ["c"]); // below floor
});

test("anchorVectors without deckOf groups by the topic title itself", () => {
  const items = [{ id: "a", text: "cache" }];
  const groups = anchorVectors(items, [u(1, 0)], ["Cache Memory"], [u(1, 0)], { floor: 0.7 });
  assert.equal(groups[0].topic, "Cache Memory");
});
