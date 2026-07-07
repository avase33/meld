/** Shared types for Meld CRDTs. */

export type Site = string;

/**
 * A state-based/op-based CRDT. `apply` must be **idempotent** and
 * **commutative** so replicas converge regardless of delivery order or
 * duplication. Local mutating methods additionally emit their op through
 * {@link Crdt.onLocalOp} so a {@link Replica} can broadcast it.
 */
export interface Crdt<Op> {
  apply(op: Op): void;
  onLocalOp?: (op: Op) => void;
}
