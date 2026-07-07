# Meld design notes

Meld is a set of **CRDTs** (Conflict-free Replicated Data Types) plus a thin
sync layer. Every data type guarantees **strong eventual consistency**: replicas
that have received the same set of operations converge to the same state, no
matter the order operations arrive, whether they're duplicated, and without any
central coordinator or locking.

The single rule every type obeys: `apply(op)` is **idempotent** (applying an op
twice is the same as once) and **commutative** (order doesn't matter). Given
that, convergence follows.

## Sequence (collaborative text)

The sequence is the centerpiece — it's what powers real-time collaborative text.

Each character is an immutable element:

```
element = { id: { site, clock }, pos: Position, value: char }
```

- `id` is globally unique (the replica's `site` plus a local `clock`).
- `pos` is a **dense position identifier**: a list of `{ digit, site }` pairs
  that are totally ordered, and between any two of which a new one can always be
  generated (a Logoot/LSEQ scheme). See [`position.ts`](../src/position.ts).

The visible document is every non-deleted element sorted by `pos` (ties broken
by `id`). Operations are:

- **insert** `{ id, pos, value }` — records the element. Idempotent because the
  `id` is unique: re-applying is a no-op.
- **delete** `{ id }` — adds `id` to a tombstone set. Idempotent, and it works
  even if it arrives *before* the matching insert (the tombstone just masks the
  element whenever it shows up).

Why it converges:

- Inserts commute because each targets a distinct `id` and ordering is decided
  by the deterministic `(pos, id)` key, identical on every replica.
- A delete and an insert of different ids commute trivially.
- A concurrent insert + delete of the *same* id is impossible — only the
  inserting replica ever mints that id.

This was validated with a randomized property test: N replicas apply a common
pool of concurrent operations in shuffled order with duplicates, and always end
up byte-for-byte identical (see [`test/convergence.test.ts`](../test/convergence.test.ts)).

### Position generation

`generatePosition(p, q, site)` returns a position strictly between `p` and `q`:

- If there's numeric room between the digits at the current depth, pick a random
  digit in the gap and tag it with `site`.
- Otherwise descend a level (the digit space grows with depth, LSEQ-style),
  using `site` to disambiguate when digits are equal.

The `site` tag guarantees two replicas inserting into the same gap never produce
identical positions, so their characters get a stable, agreed order.

## LWW-Map

A last-writer-wins map. Each write carries a **Hybrid Logical Clock** timestamp
(`physical`, `logical`, `site`). On conflict the greater timestamp wins; deletes
are timestamped tombstones. `apply` keeps the entry with the max timestamp —
idempotent and commutative.

## PN-Counter

Increment/decrement counter. Each replica tracks its own cumulative positive and
negative totals; an op ships those totals and `apply` takes the per-site
maximum. Value = `sum(positive) - sum(negative)`. Max makes it idempotent, so
duplicated ops never double-count.

## OR-Set

Observed-remove set. Each `add` mints a unique tag; `remove` deletes only the
tags it has observed. An element is present iff it has an add-tag not yet
removed — giving **add-wins** semantics for concurrent add/remove, and
converging because tag sets only grow.

## Sync layer

- [`Transport`](../src/transport.ts) is the pluggable interface for moving ops
  between replicas (WebSocket, WebRTC, a broker…). `InMemoryNetwork` is a
  synchronous star network for tests and demos.
- [`Replica`](../src/replica.ts) wires a CRDT to a transport: local ops are
  broadcast, remote ops are applied. That's the entire real-time loop.
- [`Document`](../src/document.ts) composes a `Sequence` (body) and an `LWWMap`
  (metadata) behind one replica, routing ops by a `crdt` tag.

Because the CRDTs need no causal delivery or acknowledgements, the transport can
be as dumb as "resend everything" and correctness still holds.
