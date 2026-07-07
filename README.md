<div align="center">

# 🧬 Meld

### A tiny, dependency-free CRDT toolkit for real-time collaboration.

Concurrent edits from anyone, in any order, with no server and no conflicts — they just **meld**.

[![CI](https://github.com/akhil/meld/actions/workflows/ci.yml/badge.svg)](https://github.com/akhil/meld/actions)
[![npm](https://img.shields.io/badge/npm-meld--crdt-red)](https://www.npmjs.com/package/meld-crdt)
[![Types](https://img.shields.io/badge/types-included-blue)](src/index.ts)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![deps](https://img.shields.io/badge/runtime%20deps-0-brightgreen)](package.json)

</div>

---

**Meld** implements the data structures behind tools like Google Docs and Figma —
[CRDTs](https://crdt.tech/) — in a small, readable, strongly-typed TypeScript
package with **zero runtime dependencies**. Replicas exchange operations over any
transport and always converge to the same state, regardless of order, duplication,
or network partitions. No server. No locks. No merge conflicts.

```ts
import { Sequence, InMemoryNetwork, Replica } from "meld-crdt";

const net = new InMemoryNetwork();
const alice = new Sequence("alice");
const bob = new Sequence("bob");
new Replica("alice", alice, net.connect("alice"));
new Replica("bob", bob, net.connect("bob"));

alice.insert(0, "the quick brown fox");
bob.insert(bob.length, " jumps");   // concurrent edit, different place
alice.insert(0, "> ");              // concurrent edit, different place

alice.toString() === bob.toString(); // true — "> the quick brown fox jumps"
```

## ✨ What's inside

| CRDT | Use for | Semantics |
|---|---|---|
| **`Sequence`** | collaborative **text** & lists | Logoot/RGA dense positions; insert/delete converge in any order |
| **`LWWMap`** | records, settings, presence | last-writer-wins via hybrid logical clocks |
| **`PNCounter`** | likes, votes, quantities | increment/decrement, idempotent under retries |
| **`ORSet`** | tags, members, collections | observed-remove, **add-wins** on conflict |

Plus a pluggable **`Transport`**, a **`Replica`** that wires a CRDT to a network,
and a **`Document`** that composes text + metadata behind one replica.

## 🚀 Install

```bash
npm install meld-crdt
```

Requires Node 18+ (or any modern browser bundler). Ships ESM + full `.d.ts` types.

## 🧩 Core ideas

Every Meld type guarantees **strong eventual consistency**: replicas that have
seen the same operations converge to the same state. The one invariant behind it:
`apply(op)` is **idempotent** and **commutative**. That means the transport can be
dumb — resend, reorder, and duplicate freely; correctness holds.

### Collaborative text

```ts
const doc = new Sequence("A");
doc.insert(0, "hello");
doc.insert(5, " world");
doc.delete(0, 1);          // "ello world"
doc.toString();
```

A character keeps a stable identity and a **dense position** between its
neighbours, so two people inserting at "the same spot" simultaneously get a
stable, agreed order instead of a conflict.

### A whole document

```ts
import { Document, InMemoryNetwork, Replica } from "meld-crdt";

const net = new InMemoryNetwork();
const a = new Document("A");
const b = new Document("B");
new Replica("A", a, net.connect("A"));
new Replica("B", b, net.connect("B"));

a.insert(0, "Draft");
a.setMeta("title", "Q3 Plan");
b.setMeta("tag", "urgent");
// a and b now agree on both the text and the metadata.
```

### Bring your own transport

`InMemoryNetwork` is included for demos and tests. For production, implement the
one-method `Transport` interface over WebSocket, WebRTC, or a message broker:

```ts
interface Transport<Op> {
  broadcast(op: Op): void;
  onReceive(handler: (op: Op) => void): void;
}
```

## 🔬 Correctness

Convergence isn't asserted, it's **tested**. A randomized property test spins up
several replicas, applies a shared pool of concurrent operations in shuffled
order **with duplicates**, and checks that every replica ends up byte-for-byte
identical — across many seeds and replica counts. The position algorithm is
separately fuzzed to guarantee `p < generate(p, q) < q` every time.

```bash
npm test          # unit + convergence property tests (node:test)
npm run typecheck # strict TypeScript, no emit
npm run build     # emit dist/ (ESM + .d.ts)
```

CI runs all of the above on Node 18/20/22.

## 📐 Design

See [`docs/design.md`](docs/design.md) for the convergence arguments behind each
CRDT and how dense position identifiers are generated.

## 🗺️ Roadmap

- [ ] Undo/redo history
- [ ] Causal-stability–based tombstone garbage collection
- [ ] Binary op encoding for the wire
- [ ] WebSocket + WebRTC transports
- [ ] Rich-text (formatting spans) on top of `Sequence`

## 📄 License

MIT © Akhil — see [LICENSE](LICENSE).
