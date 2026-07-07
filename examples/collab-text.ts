/**
 * Two users editing the same document at the same time, over an in-memory
 * network. Run with:  npx tsx examples/collab-text.ts
 */

import { Sequence, SequenceOp, InMemoryNetwork, Replica } from "../src/index.js";

const net = new InMemoryNetwork<SequenceOp>();
const alice = new Sequence("alice");
const bob = new Sequence("bob");
new Replica("alice", alice, net.connect("alice"));
new Replica("bob", bob, net.connect("bob"));

// Alice types a sentence; Bob sees it live.
alice.insert(0, "the quick brown fox");
console.log("bob sees:      ", JSON.stringify(bob.toString()));

// Now both edit concurrently, in different places.
alice.insert(0, "> "); // prepend a quote marker
bob.insert(bob.length, " jumps"); // append a word

console.log("alice's view:  ", JSON.stringify(alice.toString()));
console.log("bob's view:    ", JSON.stringify(bob.toString()));
console.log(
  "converged?     ",
  alice.toString() === bob.toString() ? "YES ✅" : "NO ❌",
);
