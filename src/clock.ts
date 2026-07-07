/**
 * Logical clocks.
 *
 * - {@link LamportClock} — a scalar counter for causal ordering of events.
 * - {@link HybridLogicalClock} — a Lamport clock fused with wall-clock time, so
 *   timestamps are close to physical time yet still produce a strict, causal
 *   total order. Used by the LWW map/register to decide the "last" writer.
 */

export class LamportClock {
  constructor(private value = 0) {}

  /** Advance for a local event and return the new time. */
  tick(): number {
    return ++this.value;
  }

  /** Merge a received time, keeping causal order. */
  receive(remote: number): number {
    this.value = Math.max(this.value, remote) + 1;
    return this.value;
  }

  get time(): number {
    return this.value;
  }
}

export interface Timestamp {
  /** Physical time in milliseconds. */
  physical: number;
  /** Logical counter used to break ties within the same millisecond. */
  logical: number;
  /** Originating replica id — the final tie-breaker. */
  site: string;
}

/** Strict total order over timestamps: physical, then logical, then site. */
export function compareTimestamp(a: Timestamp, b: Timestamp): number {
  if (a.physical !== b.physical) return a.physical < b.physical ? -1 : 1;
  if (a.logical !== b.logical) return a.logical < b.logical ? -1 : 1;
  if (a.site !== b.site) return a.site < b.site ? -1 : 1;
  return 0;
}

export class HybridLogicalClock {
  private physical = 0;
  private logical = 0;

  constructor(
    private site: string,
    private now: () => number = () => Date.now(),
  ) {}

  /** Produce a timestamp for a local event. */
  send(): Timestamp {
    const wall = this.now();
    if (wall > this.physical) {
      this.physical = wall;
      this.logical = 0;
    } else {
      this.logical += 1;
    }
    return { physical: this.physical, logical: this.logical, site: this.site };
  }

  /** Update the clock on receiving a remote timestamp, then stamp locally. */
  receive(remote: Timestamp): Timestamp {
    const wall = this.now();
    const maxPhysical = Math.max(this.physical, remote.physical, wall);
    if (maxPhysical === this.physical && maxPhysical === remote.physical) {
      this.logical = Math.max(this.logical, remote.logical) + 1;
    } else if (maxPhysical === this.physical) {
      this.logical += 1;
    } else if (maxPhysical === remote.physical) {
      this.logical = remote.logical + 1;
    } else {
      this.logical = 0;
    }
    this.physical = maxPhysical;
    return { physical: this.physical, logical: this.logical, site: this.site };
  }
}
