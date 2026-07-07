/**
 * Transport abstraction for propagating ops between replicas.
 *
 * Meld is transport-agnostic: plug in WebSockets, WebRTC, or a message broker by
 * implementing {@link Transport}. {@link InMemoryNetwork} is a synchronous
 * star network used in tests and examples.
 */

export interface Transport<Op> {
  /** Send an op to every other participant. */
  broadcast(op: Op): void;
  /** Register the handler invoked when an op arrives from someone else. */
  onReceive(handler: (op: Op) => void): void;
}

export class InMemoryNetwork<Op> {
  private channels = new Map<string, (op: Op) => void>();

  /** Connect a site and get its transport. */
  connect(site: string): Transport<Op> {
    let handler: (op: Op) => void = () => {};
    this.channels.set(site, (op) => handler(op));
    return {
      broadcast: (op: Op) => {
        for (const [other, deliver] of this.channels) {
          if (other !== site) deliver(op);
        }
      },
      onReceive: (h: (op: Op) => void) => {
        handler = h;
      },
    };
  }

  get size(): number {
    return this.channels.size;
  }
}
