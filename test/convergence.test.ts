import { test } from "node:test";
import assert from "node:assert/strict";
import { Sequence, SequenceOp } from "../src/sequence.js";

/** Deterministic PRNG so failures are reproducible from the seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALPHABET = "abcdefghijklmnopqrstuvwxyz";

function runTrial(seed: number, replicaCount = 4, opCount = 150): number {
  const rng = mulberry32(seed);
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const int = (n: number) => Math.floor(rng() * n);

  const reps = Array.from(
    { length: replicaCount },
    (_, i) => new Sequence(String.fromCharCode(65 + i)),
  );
  const log: { src: string; op: SequenceOp }[] = [];
  for (const r of reps) r.onLocalOp = (op) => log.push({ src: r.site, op });

  // Every edit is applied only locally — maximal concurrency from a common
  // empty start — then all ops are delivered afterwards.
  for (let i = 0; i < opCount; i++) {
    const r = pick(reps);
    const len = r.length;
    if (len === 0 || rng() < 0.65) {
      r.insert(int(len + 1), pick([...ALPHABET]));
    } else {
      r.delete(int(len), 1);
    }
  }

  for (const target of reps) {
    const delivery = log.filter((e) => e.src !== target.site).map((e) => e.op);
    // Add duplicates, then shuffle (Fisher–Yates with the same PRNG).
    for (let i = 0; i < delivery.length / 5; i++) {
      delivery.push(delivery[int(delivery.length)]);
    }
    for (let i = delivery.length - 1; i > 0; i--) {
      const j = int(i + 1);
      [delivery[i], delivery[j]] = [delivery[j], delivery[i]];
    }
    for (const op of delivery) target.apply(op);
  }

  return new Set(reps.map((r) => r.toString())).size;
}

test("random concurrent edits converge across 30 seeds", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const distinct = runTrial(seed);
    assert.equal(distinct, 1, `seed ${seed} did not converge (${distinct} states)`);
  }
});

test("converges with many replicas and heavy op load", () => {
  assert.equal(runTrial(12345, 6, 400), 1);
});
