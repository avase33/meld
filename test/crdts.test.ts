import { test } from "node:test";
import assert from "node:assert/strict";
import { LWWMap } from "../src/lww-map.js";
import { PNCounter } from "../src/counter.js";
import { ORSet } from "../src/or-set.js";

test("LWWMap: latest timestamp wins on conflicting writes", () => {
  let t = 0;
  const now = () => t;
  const a = new LWWMap<string>("A", now);
  const b = new LWWMap<string>("B", now);

  t = 1;
  const opA = a.set("color", "red");
  t = 2;
  const opB = b.set("color", "blue"); // later write

  a.apply(opB);
  b.apply(opA);
  assert.equal(a.get("color"), "blue");
  assert.equal(b.get("color"), "blue");
});

test("LWWMap: delete is timestamped and converges", () => {
  const a = new LWWMap<number>("A");
  const b = new LWWMap<number>("B");
  const set = a.set("x", 1);
  b.apply(set);
  const del = a.delete("x");
  b.apply(del);
  assert.equal(a.has("x"), false);
  assert.equal(b.has("x"), false);
});

test("PNCounter: converges and is idempotent under duplicate ops", () => {
  const a = new PNCounter("A");
  const b = new PNCounter("B");
  const ops: any[] = [];
  a.onLocalOp = (op) => ops.push(op);
  b.onLocalOp = (op) => ops.push(op);

  a.increment(5);
  b.increment(3);
  a.decrement(2);

  // Apply everyone's ops to everyone, some twice.
  for (const op of [...ops, ...ops]) {
    a.apply(op);
    b.apply(op);
  }
  assert.equal(a.value, 6);
  assert.equal(b.value, 6);
});

test("ORSet: add-wins on concurrent add/remove and converges", () => {
  const a = new ORSet<string>("A");
  const b = new ORSet<string>("B");

  const addA = a.add("apple");
  b.apply(addA);
  // A removes 'apple' (observing addA); B concurrently re-adds it.
  const rem = a.remove("apple")!;
  const addB = b.add("apple");

  a.apply(addB);
  b.apply(rem);

  // The concurrent add (addB) was not observed by the remove -> apple survives.
  assert.equal(a.has("apple"), true);
  assert.equal(b.has("apple"), true);
  assert.deepEqual(a.toArray().sort(), b.toArray().sort());
});
