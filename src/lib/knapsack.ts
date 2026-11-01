// Knapsack instances and the reference answers every mode checks against.
//
// The truth tables are built by enumerating packings directly, not by running the
// recurrence the learner is studying, so a bug in a learner's (or our own) DP cannot
// hide inside the answer key.

import { type Rng, mulberry32, randInt } from './rng';

export interface Item {
  w: number;
  v: number;
}

/** Item k (1-based, as learners see it) is items[k - 1]. */
export interface Instance {
  items: Item[];
  W: number;
}

/** zeroOne: each item at most once. complete: any number of copies. */
export type Kind = 'zeroOne' | 'complete';

/** What capacity j means in a state: weight at most j, or weight exactly j. */
export type Sem = 'atMost' | 'exactly';

export const NEG_INF = -Infinity;

/** best[wt] = best value of a packing of `items` that weighs exactly wt (NEG_INF if none). */
function bestByExactWeight(items: Item[], kind: Kind, W: number): number[] {
  let best: number[] = Array(W + 1).fill(NEG_INF);
  best[0] = 0;
  for (const { w, v } of items) {
    const next = best.slice();
    for (let wt = 0; wt <= W; wt++) {
      if (best[wt] === NEG_INF) continue;
      const maxCopies = kind === 'zeroOne' ? 1 : Infinity;
      for (let c = 1; c <= maxCopies && wt + c * w <= W; c++) {
        next[wt + c * w] = Math.max(next[wt + c * w], best[wt] + c * v);
      }
    }
    best = next;
  }
  return best;
}

/**
 * truth[i][j] = best value using only items 1..i, with total weight at most j
 * (or exactly j, NEG_INF when no packing weighs exactly j).
 */
export function truthTable(inst: Instance, kind: Kind, sem: Sem): number[][] {
  const rows: number[][] = [];
  for (let i = 0; i <= inst.items.length; i++) {
    const exact = bestByExactWeight(inst.items.slice(0, i), kind, inst.W);
    if (sem === 'exactly') {
      rows.push(exact);
    } else {
      let m = NEG_INF;
      rows.push(exact.map((x) => (m = Math.max(m, x))));
    }
  }
  return rows;
}

/** The best total value for the whole problem. */
export function optimum(inst: Instance, kind: Kind): number {
  const t = truthTable(inst, kind, 'atMost');
  return t[inst.items.length][inst.W];
}

/**
 * The value a value-per-weight greedy rule reaches with items 1..i and capacity j:
 * best ratio first (lighter item breaks ties), taking each item if it still fits.
 */
export function greedyValue(inst: Instance, i: number, j: number, kind: Kind): number {
  const order = inst.items
    .slice(0, i)
    .map((it, k) => ({ ...it, k }))
    .sort((a, b) => b.v / b.w - a.v / a.w || a.w - b.w || a.k - b.k);
  let room = j;
  let value = 0;
  for (const it of order) {
    const copies = kind === 'zeroOne' ? (it.w <= room ? 1 : 0) : Math.floor(room / it.w);
    room -= copies * it.w;
    value += copies * it.v;
  }
  return value;
}

export function formatValue(x: number | null | undefined): string {
  if (x === null || x === undefined) return '';
  if (x === NEG_INF) return '−∞';
  if (x === Infinity) return '∞';
  return String(x);
}

/** Item multiset as text: counts [1,0,2] -> "1, 3×2". Empty -> "∅". */
export function formatItems(counts: number[] | null | undefined): string {
  if (!counts) return '∅';
  const parts: string[] = [];
  counts.forEach((c, k) => {
    if (c === 1) parts.push(String(k + 1));
    else if (c > 1) parts.push(`${k + 1}×${c}`);
  });
  return parts.length ? parts.join(', ') : '∅';
}

export function maxCount(counts: number[] | null | undefined): number {
  return counts ? Math.max(0, ...counts) : 0;
}

export interface GenOptions {
  n: [number, number];
  W: [number, number];
  w: [number, number];
  v: [number, number];
}

export function randomInstance(rng: Rng, o: GenOptions): Instance {
  const n = randInt(rng, o.n[0], o.n[1]);
  const W = randInt(rng, o.W[0], o.W[1]);
  const items: Item[] = [];
  for (let k = 0; k < n; k++) items.push({ w: randInt(rng, o.w[0], o.w[1]), v: randInt(rng, o.v[0], o.v[1]) });
  return { items, W };
}

/** Cell classes for a 0/1 table: does item i fit, and if so, does taking it win? */
export function cellKind(inst: Instance, t: number[][], i: number, j: number): 'nofit' | 'skip' | 'take' | 'tie' {
  const { w, v } = inst.items[i - 1];
  if (w > j) return 'nofit';
  const skip = t[i - 1][j];
  const take = t[i - 1][j - w] + v;
  return take > skip ? 'take' : take < skip ? 'skip' : 'tie';
}

/**
 * A 0/1 instance worth predicting on: several cells where taking wins, several where
 * skipping wins although the item fits, and at least one cell where reading the current
 * row (the classic reuse bug) gives a different number.
 */
export function predictInstance(seed: number): Instance {
  const rng = mulberry32(seed);
  for (;;) {
    const inst = randomInstance(rng, { n: [4, 4], W: [6, 7], w: [1, 5], v: [1, 9] });
    const t = truthTable(inst, 'zeroOne', 'atMost');
    const reuse = truthTable(inst, 'complete', 'atMost');
    let take = 0;
    let skip = 0;
    for (let i = 2; i <= 4; i++) {
      for (let j = 1; j <= inst.W; j++) {
        const k = cellKind(inst, t, i, j);
        if (k === 'take') take++;
        if (k === 'skip') skip++;
      }
    }
    const reuseDiffers = reuse[4][inst.W] !== t[4][inst.W];
    if (take >= 4 && skip >= 3 && reuseDiffers) return inst;
  }
}

/**
 * Instances for checking a learner's recurrence: hand-picked edge cases first, then
 * random ones sorted small-to-large, so the first failure shown is a small one.
 */
export function checkInstances(count: number, seed = 20261101): Instance[] {
  const edge: Instance[] = [
    { items: [{ w: 1, v: 1 }], W: 0 },
    { items: [{ w: 3, v: 5 }], W: 2 },
    { items: [{ w: 2, v: 3 }], W: 4 },
    { items: [{ w: 1, v: 2 }, { w: 1, v: 3 }], W: 2 },
    { items: [{ w: 2, v: 3 }, { w: 3, v: 4 }], W: 5 },
    { items: [{ w: 2, v: 3 }, { w: 3, v: 4 }, { w: 4, v: 5 }, { w: 5, v: 6 }], W: 5 },
  ];
  const rng = mulberry32(seed);
  const random: Instance[] = [];
  for (let k = 0; k < count; k++) random.push(randomInstance(rng, { n: [1, 5], W: [1, 10], w: [1, 6], v: [1, 9] }));
  random.sort((a, b) => a.items.length + a.W - (b.items.length + b.W));
  return [...edge, ...random];
}
