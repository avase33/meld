import { test } from "node:test";
import assert from "node:assert/strict";
import { comparePosition, generatePosition, START } from "../src/position.js";

test("comparePosition orders by digit then site, prefix first", () => {
  assert.ok(comparePosition([], [{ digit: 1, site: "A" }]) < 0);
  assert.ok(
    comparePosition([{ digit: 1, site: "A" }], [{ digit: 2, site: "A" }]) < 0,
  );
  assert.ok(
    comparePosition([{ digit: 1, site: "A" }], [{ digit: 1, site: "B" }]) < 0,
  );
  assert.equal(
    comparePosition([{ digit: 1, site: "A" }], [{ digit: 1, site: "A" }]),
    0,
  );
});

test("generatePosition always yields p < new < q (fuzz)", () => {
  let p = START;
  const positions = [p];
  // Repeatedly insert between the two tightest neighbours to force deep ids.
  for (let i = 0; i < 500; i++) {
    const left = positions[positions.length - 1];
    const created = generatePosition(left, null, "S");
    assert.ok(comparePosition(left, created) < 0, "must be greater than left");
    positions.push(created);
  }
  // And between adjacent pairs.
  for (let i = 0; i < 200; i++) {
    const q = generatePosition(START, positions[1], "T");
    assert.ok(comparePosition(START, q) < 0 && comparePosition(q, positions[1]) < 0);
  }
});

test("concurrent inserts at the same gap get distinct, ordered positions", () => {
  const a = generatePosition(START, null, "A");
  const b = generatePosition(START, null, "B");
  assert.notEqual(comparePosition(a, b), 0);
});
