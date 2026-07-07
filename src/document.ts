/**
 * Document — a small collaborative document that composes CRDTs: a
 * {@link Sequence} for the body text and a {@link LWWMap} for metadata (title,
 * tags, ...). Ops from either sub-CRDT are tagged so they can be routed on
 * apply, letting a whole document sync over a single {@link Replica}.
 */

import { LWWMap, LWWOp } from "./lww-map.js";
import { Sequence, SequenceOp } from "./sequence.js";
import { Crdt, Site } from "./types.js";

export type DocOp = SequenceOp | LWWOp<unknown>;

export class Document implements Crdt<DocOp> {
  onLocalOp?: (op: DocOp) => void;

  readonly text: Sequence;
  readonly meta: LWWMap;

  constructor(public readonly site: Site) {
    this.text = new Sequence(site);
    this.meta = new LWWMap(site);
    this.text.onLocalOp = (op) => this.onLocalOp?.(op);
    this.meta.onLocalOp = (op) => this.onLocalOp?.(op as DocOp);
  }

  // -- text convenience ----------------------------------------------------
  insert(index: number, text: string): void {
    this.text.insert(index, text);
  }

  delete(index: number, count = 1): void {
    this.text.delete(index, count);
  }

  getText(): string {
    return this.text.toString();
  }

  // -- metadata convenience ------------------------------------------------
  setMeta(key: string, value: unknown): void {
    this.meta.set(key, value);
  }

  getMeta(key: string): unknown {
    return this.meta.get(key);
  }

  // -- sync ----------------------------------------------------------------
  apply(op: DocOp): void {
    if (op.crdt === "seq") {
      this.text.apply(op);
    } else if (op.crdt === "lww") {
      this.meta.apply(op);
    }
  }

  toJSON(): { site: Site; text: string; meta: Record<string, unknown> } {
    return { site: this.site, text: this.getText(), meta: this.meta.toObject() };
  }
}
