/**
 * Sequence — a text/list CRDT for real-time collaborative editing.
 *
 * Each character is an immutable element with a unique id `{site, clock}` and a
 * dense {@link Position}. The visible document is every non-tombstoned element
 * sorted by position (ties broken by id). Because element ids are globally
 * unique and delete only ever sets a tombstone, `apply` is idempotent and
 * commutative — inserts and deletes converge under any delivery order.
 */

import {
  comparePosition,
  generatePosition,
  Position,
  START,
} from "./position.js";
import { Crdt, Site } from "./types.js";

export interface ElemId {
  site: Site;
  clock: number;
}

export type SequenceOp =
  | { crdt: "seq"; type: "insert"; id: ElemId; pos: Position; value: string }
  | { crdt: "seq"; type: "delete"; id: ElemId };

interface Element {
  id: ElemId;
  pos: Position;
  value: string;
}

function idKey(id: ElemId): string {
  return `${id.site}:${id.clock}`;
}

function compareElemId(a: ElemId, b: ElemId): number {
  if (a.site !== b.site) return a.site < b.site ? -1 : 1;
  return a.clock - b.clock;
}

export class Sequence implements Crdt<SequenceOp> {
  onLocalOp?: (op: SequenceOp) => void;

  private clock = 0;
  private elements = new Map<string, Element>();
  private tombstones = new Set<string>();

  constructor(public readonly site: Site) {}

  // -- reads ---------------------------------------------------------------
  private visible(): Element[] {
    const out: Element[] = [];
    for (const [key, el] of this.elements) {
      if (!this.tombstones.has(key)) out.push(el);
    }
    out.sort((a, b) => {
      const c = comparePosition(a.pos, b.pos);
      return c !== 0 ? c : compareElemId(a.id, b.id);
    });
    return out;
  }

  toString(): string {
    return this.visible()
      .map((e) => e.value)
      .join("");
  }

  toArray(): string[] {
    return this.visible().map((e) => e.value);
  }

  get length(): number {
    return this.visible().length;
  }

  // -- local edits ---------------------------------------------------------
  /** Insert `text` so its first character lands at `index`. */
  insert(index: number, text: string): SequenceOp[] {
    const ops: SequenceOp[] = [];
    for (const ch of text) {
      ops.push(this.insertChar(index, ch));
      index += 1;
    }
    return ops;
  }

  private insertChar(index: number, value: string): SequenceOp {
    const vis = this.visible();
    if (index < 0 || index > vis.length) {
      throw new RangeError(`insert index ${index} out of range 0..${vis.length}`);
    }
    const left: Position = index > 0 ? vis[index - 1].pos : START;
    const right: Position | null = index < vis.length ? vis[index].pos : null;
    const pos = generatePosition(left, right, this.site);
    const id: ElemId = { site: this.site, clock: ++this.clock };
    const op: SequenceOp = { crdt: "seq", type: "insert", id, pos, value };
    this.apply(op);
    this.onLocalOp?.(op);
    return op;
  }

  /** Delete `count` characters starting at `index`. */
  delete(index: number, count = 1): SequenceOp[] {
    const ops: SequenceOp[] = [];
    for (let i = 0; i < count; i++) {
      const vis = this.visible();
      if (index < 0 || index >= vis.length) break;
      const id = vis[index].id;
      const op: SequenceOp = { crdt: "seq", type: "delete", id };
      this.apply(op);
      this.onLocalOp?.(op);
      ops.push(op);
    }
    return ops;
  }

  // -- convergence core ----------------------------------------------------
  apply(op: SequenceOp): void {
    const key = idKey(op.id);
    if (op.type === "insert") {
      // Idempotent: re-applying the same insert is a no-op.
      if (!this.elements.has(key)) {
        this.elements.set(key, { id: op.id, pos: op.pos, value: op.value });
        // Keep our local clock ahead of ids we have observed.
        if (op.id.site === this.site) this.clock = Math.max(this.clock, op.id.clock);
      }
    } else {
      // Delete is a tombstone; works even if the insert hasn't arrived yet.
      this.tombstones.add(key);
    }
  }
}
