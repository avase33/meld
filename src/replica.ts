/**
 * A Replica binds a CRDT to a transport: local ops are broadcast, and remote
 * ops are applied. That's the whole real-time sync loop.
 */

import { Crdt } from "./types.js";
import { Transport } from "./transport.js";

export class Replica<Op> {
  constructor(
    public readonly site: string,
    public readonly crdt: Crdt<Op>,
    public readonly transport: Transport<Op>,
  ) {
    crdt.onLocalOp = (op) => transport.broadcast(op);
    transport.onReceive((op) => crdt.apply(op));
  }
}
