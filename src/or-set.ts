/**
 * ORSet — an observed-remove set.
 *
 * Each `add` attaches a unique tag to the element. `remove` records only the
 * tags it has *observed*. An element is present iff it has at least one add-tag
 * that has not been removed. This gives "add-wins" semantics for a concurrent
 * add/remove of the same element, and converges because tag sets only grow.
 */

import { Crdt, Site } from "./types.js";

interface Tag {
  site: Site;
  clock: number;
}

function tagKey(t: Tag): string {
  return `${t.site}:${t.clock}`;
}

export type ORSetOp<T> =
  | { crdt: "orset"; type: "add"; element: T; tag: Tag }
  | { crdt: "orset"; type: "remove"; element: T; tags: string[] };

export class ORSet<T = string> implements Crdt<ORSetOp<T>> {
  onLocalOp?: (op: ORSetOp<T>) => void;

  private clock = 0;
  private adds = new Map<string, Set<string>>();
  private removes = new Map<string, Set<string>>();
  private values = new Map<string, T>();

  constructor(public readonly site: Site) {}

  private key(element: T): string {
    return typeof element === "string" ? element : JSON.stringify(element);
  }

  add(element: T): ORSetOp<T> {
    const tag: Tag = { site: this.site, clock: ++this.clock };
    const op: ORSetOp<T> = { crdt: "orset", type: "add", element, tag };
    this.apply(op);
    this.onLocalOp?.(op);
    return op;
  }

  remove(element: T): ORSetOp<T> | null {
    const k = this.key(element);
    const present = this.adds.get(k);
    const removed = this.removes.get(k) ?? new Set<string>();
    const observed = [...(present ?? [])].filter((t) => !removed.has(t));
    if (observed.length === 0) return null; // nothing to remove
    const op: ORSetOp<T> = { crdt: "orset", type: "remove", element, tags: observed };
    this.apply(op);
    this.onLocalOp?.(op);
    return op;
  }

  has(element: T): boolean {
    const k = this.key(element);
    const added = this.adds.get(k);
    if (!added || added.size === 0) return false;
    const removed = this.removes.get(k);
    if (!removed) return true;
    for (const t of added) if (!removed.has(t)) return true;
    return false;
  }

  toArray(): T[] {
    const out: T[] = [];
    for (const [k, tags] of this.adds) {
      const removed = this.removes.get(k);
      const live = removed ? [...tags].some((t) => !removed.has(t)) : tags.size > 0;
      if (live) out.push(this.values.get(k) as T);
    }
    return out;
  }

  apply(op: ORSetOp<T>): void {
    const k = this.key(op.element);
    this.values.set(k, op.element);
    if (op.type === "add") {
      let set = this.adds.get(k);
      if (!set) this.adds.set(k, (set = new Set()));
      set.add(tagKey(op.tag));
    } else {
      let set = this.removes.get(k);
      if (!set) this.removes.set(k, (set = new Set()));
      for (const t of op.tags) set.add(t);
    }
  }
}
