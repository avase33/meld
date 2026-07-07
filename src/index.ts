/**
 * Meld — a tiny, dependency-free CRDT toolkit for real-time collaboration.
 *
 * @example
 * ```ts
 * import { Sequence, InMemoryNetwork, Replica } from "meld-crdt";
 *
 * const net = new InMemoryNetwork();
 * const a = new Sequence("A");
 * const b = new Sequence("B");
 * new Replica("A", a, net.connect("A"));
 * new Replica("B", b, net.connect("B"));
 *
 * a.insert(0, "hello");      // b instantly sees "hello"
 * b.insert(5, " world");     // a instantly sees "hello world"
 * ```
 */

export {
  comparePosition,
  generatePosition,
  positionToString,
  START,
  type Boundary,
  type Identifier,
  type Position,
} from "./position.js";
export {
  compareTimestamp,
  HybridLogicalClock,
  LamportClock,
  type Timestamp,
} from "./clock.js";
export { Sequence, type ElemId, type SequenceOp } from "./sequence.js";
export { LWWMap, type LWWOp } from "./lww-map.js";
export { PNCounter, type CounterOp } from "./counter.js";
export { ORSet, type ORSetOp } from "./or-set.js";
export { InMemoryNetwork, type Transport } from "./transport.js";
export { Replica } from "./replica.js";
export { Document, type DocOp } from "./document.js";
export { type Crdt, type Site } from "./types.js";
