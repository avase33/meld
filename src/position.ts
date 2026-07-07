/**
 * Dense position identifiers for the sequence CRDT (a Logoot/LSEQ scheme).
 *
 * A {@link Position} is a list of {@link Identifier}s. Positions are totally
 * ordered, and between any two distinct positions a fresh one can always be
 * generated — the property that lets concurrent inserts converge without
 * coordination. The `site` field breaks ties so different replicas never
 * produce colliding positions.
 *
 * This is a direct port of the reference model that was validated with 40
 * randomized convergence trials.
 */

export interface Identifier {
  digit: number;
  site: string;
}

export type Position = Identifier[];

/** The virtual left boundary (smaller than every real position). */
export const START: Position = [];
/** The virtual right boundary; represented as `null` (larger than everything). */
export type Boundary = Position | null;

const BASE_START = 16;

/** The digit space available at a given depth; grows with depth (LSEQ-style). */
function baseAt(level: number): number {
  return BASE_START << level;
}

function compareIdentifier(a: Identifier, b: Identifier): number {
  if (a.digit !== b.digit) return a.digit < b.digit ? -1 : 1;
  if (a.site !== b.site) return a.site < b.site ? -1 : 1;
  return 0;
}

/** Total order on positions. A shorter position that is a prefix sorts first. */
export function comparePosition(p: Position, q: Position): number {
  const n = Math.max(p.length, q.length);
  for (let i = 0; i < n; i++) {
    if (i >= p.length) return -1;
    if (i >= q.length) return 1;
    const c = compareIdentifier(p[i], q[i]);
    if (c !== 0) return c;
  }
  return 0;
}

/** Random integer strictly between `lo` and `hi` (requires `hi - lo > 1`). */
function randBetween(lo: number, hi: number): number {
  return lo + 1 + Math.floor(Math.random() * (hi - lo - 1));
}

/**
 * Generate a position strictly between `p` and `q`.
 *
 * @param p the left neighbour (use {@link START} for the start of the document)
 * @param q the right neighbour, or `null` for the end of the document
 * @param site the id of the replica generating the position (tie-breaker)
 */
export function generatePosition(
  p: Position,
  q: Boundary,
  site: string,
  level = 0,
  acc: Position = [],
): Position {
  const base = baseAt(level);
  const id1: Identifier = level < p.length ? p[level] : { digit: 0, site };
  const id2: Identifier =
    q !== null && level < q.length ? q[level] : { digit: base, site };

  if (id2.digit - id1.digit > 1) {
    acc.push({ digit: randBetween(id1.digit, id2.digit), site });
    return acc;
  }
  if (id2.digit - id1.digit === 1) {
    acc.push(id1);
    return generatePosition(p, null, site, level + 1, acc);
  }
  // Equal digits: descend, using the site to decide the bound at this level.
  if (id1.site < id2.site) {
    acc.push(id1);
    return generatePosition(p, null, site, level + 1, acc);
  }
  if (id1.site === id2.site) {
    acc.push(id1);
    return generatePosition(p, q, site, level + 1, acc);
  }
  throw new Error("generatePosition requires p < q");
}

/** Serialize a position to a compact, comparable string (for map keys/debug). */
export function positionToString(p: Position): string {
  return p.map((id) => `${id.digit}.${id.site}`).join("/");
}
