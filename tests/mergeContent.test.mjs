// Tests for pooling one analysis into another (contribution approval merge).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeContent } from "../src/engine/mergeContent.js";

test("mergeContent re-bases pIdx so pooled papers don't collide", () => {
  const target = {
    papers: [{ name: "A" }, { name: "B" }],
    groups: [
      { id: "g0", topic: "Cache", items: [
        { id: "q1", pIdx: 0, uid: "0__q1", text: "x" },
        { id: "q1", pIdx: 1, uid: "1__q1", text: "y" },
      ] },
    ],
  };
  const add = {
    papers: [{ name: "C" }],
    groups: [{ id: "g0", topic: "Booth", items: [{ id: "q2", pIdx: 0, uid: "0__q2", text: "z" }] }],
  };
  const merged = mergeContent(target, add);
  const moved = merged.groups.flatMap((g) => g.items).find((it) => it.id === "q2");
  assert.equal(moved.pIdx, 2);          // shifted past target's max pIdx (1)
  assert.equal(moved.uid, "2__q2");     // uid re-based to match
  assert.equal(merged.paperCount, 3);   // distinct pIdx 0,1,2
  assert.equal(merged.questionCount, 3);
  assert.equal(merged.papers.length, 3);
  assert.deepEqual(merged.groups.map((g) => g.id), ["g0", "g1"]); // renumbered
});

test("mergeContent into an empty target keeps pIdx at 0", () => {
  const merged = mergeContent(
    { groups: [], papers: [] },
    { groups: [{ id: "g0", topic: "X", items: [{ id: "q1", pIdx: 0, uid: "0__q1", text: "t" }] }], papers: [{ name: "P" }] }
  );
  const it = merged.groups[0].items[0];
  assert.equal(it.pIdx, 0); // maxP = -1 => offset 0
  assert.equal(it.uid, "0__q1");
  assert.equal(merged.paperCount, 1);
});
