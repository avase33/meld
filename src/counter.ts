/**
 * PNCounter — an increment/decrement counter CRDT.
 *
 * Each replica keeps its own monotonically growing positive and negative
 * totals. An op carries the emitting site's *cumulative* totals, and `apply`
 * takes the per-site maximum — which makes it idempotent (safe under
 * duplication) and commutative (order-independent). The value is
 * `sum(positive) - sum(negative)`.
 */

import { Crdt, Site } from "./types.js";

export interface CounterOp {
  crdt: "counter";
  site: Site;
  p: number;
  n: number;
}

export class PNCounter implements Crdt<CounterOp> {
  onLocalOp?: (op: CounterOp) => void;

  private positive = new Map<Site, number>();
  private negative = new Map<Site, number>();

  constructor(public readonly site: Site) {}

  increment(amount = 1): CounterOp {
    if (amount < 0) return this.decrement(-amount);
    this.positive.set(this.site, (this.positive.get(this.site) ?? 0) + amount);
    return this.emit();
  }

  decrement(amount = 1): CounterOp {
    if (amount < 0) return this.increment(-amount);
    this.negative.set(this.site, (this.negative.get(this.site) ?? 0) + amount);
    return this.emit();
  }

  private emit(): CounterOp {
    const op: CounterOp = {
      crdt: "counter",
      site: this.site,
      p: this.positive.get(this.site) ?? 0,
      n: this.negative.get(this.site) ?? 0,
    };
    this.onLocalOp?.(op);
    return op;
  }

  get value(): number {
    let total = 0;
    for (const v of this.positive.values()) total += v;
    for (const v of this.negative.values()) total -= v;
    return total;
  }

  apply(op: CounterOp): void {
    this.positive.set(op.site, Math.max(this.positive.get(op.site) ?? 0, op.p));
    this.negative.set(op.site, Math.max(this.negative.get(op.site) ?? 0, op.n));
  }
}
