import { test } from "node:test";
import assert from "node:assert/strict";
import { Sequence, SequenceOp } from "../src/sequence.js";
import { Document, DocOp } from "../src/document.js";
import { InMemoryNetwork } from "../src/transport.js";
import { Replica } from "../src/replica.js";

test("Replica + InMemoryNetwork: edits propagate live", () => {
  const net = new InMemoryNetwork<SequenceOp>();
  const a = new Sequence("A");
  const b = new Sequence("B");
  new Replica("A", a, net.connect("A"));
  new Replica("B", b, net.connect("B"));

  a.insert(0, "hello");
  assert.equal(b.toString(), "hello"); // arrived synchronously

  b.insert(5, " world");
  assert.equal(a.toString(), "hello world");
});

test("three replicas stay consistent", () => {
  const net = new InMemoryNetwork<SequenceOp>();
  const seqs = ["A", "B", "C"].map((s) => new Sequence(s));
  seqs.forEach((s) => new Replica(s.site, s, net.connect(s.site)));

  seqs[0].insert(0, "abc");
  seqs[1].insert(3, "def");
  seqs[2].insert(0, "XYZ");

  const values = new Set(seqs.map((s) => s.toString()));
  assert.equal(values.size, 1);
});

test("Document syncs text and metadata together", () => {
  const net = new InMemoryNetwork<DocOp>();
  const a = new Document("A");
  const b = new Document("B");
  new Replica("A", a, net.connect("A"));
  new Replica("B", b, net.connect("B"));

  a.insert(0, "Draft");
  a.setMeta("title", "My Doc");
  b.setMeta("tag", "urgent");

  assert.equal(b.getText(), "Draft");
  assert.equal(b.getMeta("title"), "My Doc");
  assert.equal(a.getMeta("tag"), "urgent");
  // Same content on both replicas (ignoring each replica's own site id).
  assert.equal(a.getText(), b.getText());
  assert.deepEqual(a.toJSON().meta, b.toJSON().meta);
});
