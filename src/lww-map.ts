/**
 * LWWMap — a last-writer-wins map / register.
 *
 * Every write carries a hybrid-logical-clock {@link Timestamp}. On conflict the
 * larger timestamp wins, so the map converges regardless of delivery order.
 * Deletes are tombstones with their own timestamp, so a concurrent delete and
 * set are resolved by time like any other write.
 */

import {
  compareTimestamp,
  HybridLogicalClock,
  Timestamp,
} from "./clock.js";
import { Crdt, Site } from "./types.js";

export type LWWOp<V> =
  | { crdt: "lww"; type: "set"; key: string; value: V; ts: Timestamp }
  | { crdt: "lww"; type: "delete"; key: string; ts: Timestamp };

interface Entry<V> {
  value: V | undefined;
  ts: Timestamp;
  deleted: boolean;
}

export class LWWMap<V = unknown> implements Crdt<LWWOp<V>> {
  onLocalOp?: (op: LWWOp<V>) => void;

  private entries = new Map<string, Entry<V>>();
  private clock: HybridLogicalClock;

  constructor(
    public readonly site: Site,
    now?: () => number,
  ) {
    this.clock = new HybridLogicalClock(site, now);
  }

  set(key: string, value: V): LWWOp<V> {
    const op: LWWOp<V> = { crdt: "lww", type: "set", key, value, ts: this.clock.send() };
    this.apply(op);
    this.onLocalOp?.(op);
    return op;
  }

  delete(key: string): LWWOp<V> {
    const op: LWWOp<V> = { crdt: "lww", type: "delete", key, ts: this.clock.send() };
    this.apply(op);
    this.onLocalOp?.(op);
    return op;
  }

  get(key: string): V | undefined {
    const e = this.entries.get(key);
    return e && !e.deleted ? e.value : undefined;
  }

  has(key: string): boolean {
    const e = this.entries.get(key);
    return !!e && !e.deleted;
  }

  keys(): string[] {
    return [...this.entries.entries()]
      .filter(([, e]) => !e.deleted)
      .map(([k]) => k);
  }

  toObject(): Record<string, V> {
    const out: Record<string, V> = {};
    for (const [k, e] of this.entries) {
      if (!e.deleted && e.value !== undefined) out[k] = e.value;
    }
    return out;
  }

  apply(op: LWWOp<V>): void {
    this.clock.receive(op.ts);
    const current = this.entries.get(op.key);
    if (current && compareTimestamp(op.ts, current.ts) <= 0) return; // older write loses
    this.entries.set(op.key, {
      value: op.type === "set" ? op.value : undefined,
      ts: op.ts,
      deleted: op.type === "delete",
    });
  }
}
