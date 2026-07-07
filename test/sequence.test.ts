import { test } from "node:test";
import assert from "node:assert/strict";
import { Sequence, SequenceOp } from "../src/sequence.js";

test("local insert and delete build the expected string", () => {
  const s = new Sequence("A");
  s.insert(0, "helo");
  s.insert(2, "l"); // he-l-lo
  assert.equal(s.toString(), "hello");
  s.delete(0, 1);
  assert.equal(s.toString(), "ello");
  assert.equal(s.length, 4);
});

test("two replicas converge regardless of op arrival order", () => {
  const a = new Sequence("A");
  const b = new Sequence("B");
  const aOps: SequenceOp[] = [];
  const bOps: SequenceOp[] = [];
  a.onLocalOp = (op) => aOps.push(op);
  b.onLocalOp = (op) => bOps.push(op);

  a.insert(0, "cat");
  b.insert(0, "dog");

  // Deliver each other's ops in REVERSE order (and twice, to test idempotency).
  for (const op of [...bOps].reverse()) a.apply(op);
  for (const op of [...bOps].reverse()) a.apply(op);
  for (const op of [...aOps].reverse()) b.apply(op);

  assert.equal(a.toString(), b.toString());
});

test("delete that arrives before its insert still masks the char", () => {
  const a = new Sequence("A");
  const b = new Sequence("B");
  const ops: SequenceOp[] = [];
  a.onLocalOp = (op) => ops.push(op);

  a.insert(0, "x");
  a.delete(0, 1);

  // Apply the delete FIRST, then the insert.
  const del = ops.find((o) => o.type === "delete")!;
  const ins = ops.find((o) => o.type === "insert")!;
  b.apply(del);
  b.apply(ins);
  assert.equal(b.toString(), "");
});
