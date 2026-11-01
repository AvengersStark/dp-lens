// Runs a DP specification (base case, transition, loop order) on an instance, the way a
// program would, while recording every write and every read. Write mode and Build mode
// both use it: compare each write with the truth table, find the first wrong write, and
// trace backward from a wrong answer to the cell where things first went wrong.

import type { Code, Slot } from './codes';
import { type Instance, type Kind, NEG_INF, formatItems, formatValue as f, greedyValue, maxCount } from './knapsack';
import { type Dims, type Node, EvalError, type Env, type Val, evaluate } from './notation';
import { classifyValue } from './tutor';

export interface Order2D {
  dims: 2;
  outer: 'i' | 'j';
  iDir: 'up' | 'down';
  jDir: 'up' | 'down';
}

/** One array: for each item i, j runs over [w[i], W] or [0, W], up or down. */
export interface Order1D {
  dims: 1;
  jDir: 'up' | 'down';
  jFrom: 'w' | 'zero';
}

export type Order = Order2D | Order1D;

/**
 * zeros:     dp[0][j] = 0 (or dp[j] = 0) for every j
 * exactRow0: dp[0][0] = 0, every other starting cell −∞
 * col0Only:  dp[i][0] = 0 for every i, and nothing else (2D)
 * dp0Only:   dp[0] = 0, and nothing else (1D)
 */
export type BaseRule = 'zeros' | 'exactRow0' | 'col0Only' | 'dp0Only';

export type Transition = { kind: 'formula'; node: Node } | { kind: 'greedy' };

export interface Spec {
  dims: Dims;
  base: BaseRule;
  transition: Transition;
  order: Order;
}

export interface Read {
  /** [i, j] in 2D, [j] in 1D. */
  cell: number[];
  /** Id of the write that produced the value read. */
  src: number;
}

export interface WriteRec {
  id: number;
  /** 2D: the row i. 1D: the item being processed (0 for the base case). */
  pass: number;
  /** The column j. In 2D the row is `pass`. */
  j: number;
  value: number;
  items: number[] | null;
  reads: Read[];
  base: boolean;
  expected: number;
  ok: boolean;
}

export interface RunError {
  kind: EvalError['kind'];
  message: string;
  pass: number;
  j: number;
  /** The cell the failing read asked for, if the error came from a read. */
  read: number[] | null;
}

export interface Run {
  inst: Instance;
  spec: Spec;
  kind: Kind;
  /** truth[pass][j]: what each write should produce under the state being checked. */
  truth: number[][];
  writes: WriteRec[];
  /** Latest write id per cell key. */
  latest: Map<string, number>;
  error: RunError | null;
  /** The first write, in execution order, whose value disagrees with the truth table. */
  rootId: number | null;
}

export function cellKey(dims: Dims, pass: number, j: number): string {
  return dims === 2 ? `${pass},${j}` : `${j}`;
}

function range(from: number, to: number, dir: 'up' | 'down'): number[] {
  const out: number[] = [];
  if (dir === 'up') for (let x = from; x <= to; x++) out.push(x);
  else for (let x = to; x >= from; x--) out.push(x);
  return out;
}

/** The (pass, j) steps the loops visit, in order. */
export function steps(inst: Instance, order: Order): [number, number][] {
  const n = inst.items.length;
  const W = inst.W;
  const out: [number, number][] = [];
  if (order.dims === 2) {
    if (order.outer === 'i') {
      for (const i of range(1, n, order.iDir)) for (const j of range(0, W, order.jDir)) out.push([i, j]);
    } else {
      for (const j of range(0, W, order.jDir)) for (const i of range(1, n, order.iDir)) out.push([i, j]);
    }
  } else {
    for (let i = 1; i <= n; i++) {
      const lo = order.jFrom === 'w' ? inst.items[i - 1].w : 0;
      for (const j of range(lo, W, order.jDir)) out.push([i, j]);
    }
  }
  return out;
}

function baseCells(dims: Dims, rule: BaseRule, n: number, W: number): [number, number, number][] {
  // [pass, j, value]
  const out: [number, number, number][] = [];
  if (rule === 'zeros') for (let j = 0; j <= W; j++) out.push([0, j, 0]);
  if (rule === 'exactRow0') for (let j = 0; j <= W; j++) out.push([0, j, j === 0 ? 0 : NEG_INF]);
  if (rule === 'col0Only') for (let i = 0; i <= (dims === 2 ? n : 0); i++) out.push([i, 0, 0]);
  if (rule === 'dp0Only') out.push([0, 0, 0]);
  return out;
}

/**
 * Execute `spec` on `inst`. `truth[pass][j]` is what each write should produce under
 * the state being checked. Stops at the first runtime error.
 */
export function run(inst: Instance, spec: Spec, kind: Kind, truth: number[][]): Run {
  const n = inst.items.length;
  const W = inst.W;
  const dims = spec.dims;
  const writes: WriteRec[] = [];
  const latest = new Map<string, number>();
  let rootId: number | null = null;

  const record = (pass: number, j: number, val: Val, reads: Read[], base: boolean) => {
    const expected = truth[pass][j];
    const rec: WriteRec = { id: writes.length, pass, j, value: val.v, items: val.items, reads, base, expected, ok: val.v === expected };
    writes.push(rec);
    latest.set(cellKey(dims, pass, j), rec.id);
    if (!rec.ok && rootId === null) rootId = rec.id;
  };

  for (const [pass, j, value] of baseCells(dims, spec.base, n, W)) record(pass, j, { v: value, items: null }, [], true);

  for (const [i, j] of steps(inst, spec.order)) {
    const reads: Read[] = [];
    const env: Env = {
      i,
      j,
      n,
      W,
      w: inst.items.map((it) => it.w),
      v: inst.items.map((it) => it.v),
      read(idx) {
        const shown = dims === 2 ? `dp[${idx[0]}][${idx[1]}]` : `dp[${idx[0]}]`;
        const [r, c] = dims === 2 ? idx : [0, idx[0]];
        if (c < 0) throw new EvalError('oob', `${shown} does not exist: a capacity cannot be negative.`, idx);
        if (c > W) throw new EvalError('oob', `${shown} does not exist: the largest capacity is W = ${W}.`, idx);
        if (dims === 2 && (r < 0 || r > n)) throw new EvalError('oob', `${shown} does not exist: rows go from 0 to n = ${n}.`, idx);
        const id = latest.get(dims === 2 ? `${r},${c}` : `${c}`);
        if (id === undefined) throw new EvalError('unset', `${shown} was read before anything was stored in it.`, idx);
        reads.push({ cell: idx, src: id });
        return { v: writes[id].value, items: writes[id].items };
      },
    };
    try {
      const val: Val =
        spec.transition.kind === 'greedy' ? { v: greedyValue(inst, i, j, kind), items: null } : evaluate(spec.transition.node, env);
      record(i, j, val, reads, false);
    } catch (e) {
      if (!(e instanceof EvalError)) throw e;
      return { inst, spec, kind, truth, writes, latest, error: { kind: e.kind, message: e.message, pass: i, j, read: e.idx.length ? e.idx : null }, rootId };
    }
  }
  return { inst, spec, kind, truth, writes, latest, error: null, rootId };
}

/** Current value per cell for display: 2D rows 0..n, or a single row for 1D. */
export function grid(r: Run): (WriteRec | null)[][] {
  const n = r.inst.items.length;
  const W = r.inst.W;
  const rows = r.spec.dims === 2 ? n + 1 : 1;
  return Array.from({ length: rows }, (_, i) =>
    Array.from({ length: W + 1 }, (_, j) => {
      const id = r.latest.get(r.spec.dims === 2 ? `${i},${j}` : `${j}`);
      return id === undefined ? null : r.writes[id];
    }),
  );
}

/**
 * From a wrong write, follow reads whose source was also wrong until reaching a write
 * whose inputs were all right. Returns ids from `start` back to that cell.
 */
export function traceBack(r: Run, start: number): number[] {
  const chain = [start];
  let cur = r.writes[start];
  for (;;) {
    const bad = cur.reads.find((rd) => !r.writes[rd.src].ok);
    if (!bad) return chain;
    cur = r.writes[bad.src];
    chain.push(cur.id);
  }
}

export interface Diagnosis {
  slot: Slot;
  code: Code;
  message: string;
}

function nameOf(r: Run, pass: number, j: number): string {
  return r.spec.dims === 2 ? `dp[${pass}][${j}]` : `dp[${j}]`;
}

/** Explain why one wrong write is wrong, and which slot of the spec card to look at. */
export function diagnose(r: Run, id: number): Diagnosis {
  const wr = r.writes[id];
  const here = nameOf(r, wr.pass, wr.j);
  if (wr.base) {
    return {
      slot: 'base',
      code: 'BASE_MISFIT',
      message: `The base case sets ${here} = ${f(wr.value)}, but by the state it should be ${f(wr.expected)}.`,
    };
  }
  const i = wr.pass;
  const { w, v } = r.inst.items[i - 1];
  const dims = r.spec.dims;

  if (dims === 1 && r.spec.transition.kind === 'formula') {
    // If the value is exactly max(old dp[j], dp[j - w] + v) with the values actually read,
    // the transition is fine and the problem is which version of dp[j - w] was read.
    const self = wr.reads.find((rd) => rd.cell[0] === wr.j);
    const take = wr.reads.find((rd) => rd.cell[0] === wr.j - w);
    const standard = self && take && wr.value === Math.max(r.writes[self.src].value, r.writes[take.src].value + v);
    const src = take && r.writes[take.src];
    if (standard && src && r.kind === 'zeroOne' && src.pass === i) {
      return {
        slot: 'order',
        code: 'LOOP_FORWARD_01',
        message:
          `While processing item ${i}, ${here} read dp[${src.j}] = ${f(src.value)}, but dp[${src.j}] had already been updated for item ${i} ` +
          `(it now contains items {${formatItems(src.items)}}). So ${here} = ${f(wr.value)} is built from items {${formatItems(wr.items)}}` +
          `${maxCount(wr.items) > 1 ? `: item ${i} is used twice` : ''}. In the 0/1 knapsack, run j downward so dp[j − w[i]] still means “before item ${i}”.`,
      };
    }
    if (standard && src && r.kind === 'complete' && src.pass < i && wr.value < wr.expected) {
      return {
        slot: 'order',
        code: 'LOOP_BACKWARD_COMPLETE',
        message:
          `${here} read dp[${src.j}] = ${f(src.value)}, which did not include item ${i} yet, so item ${i} could not be used again. ` +
          `In the complete knapsack each item may repeat: run j upward so dp[j − w[i]] already includes item ${i}.`,
      };
    }
  }
  if (r.spec.transition.kind === 'greedy') {
    return {
      slot: 'transition',
      code: 'GREEDY_RATIO',
      message: `Greedy by value per weight gives ${here} = ${f(wr.value)}, but the best packing is worth ${f(wr.expected)}. Items cannot be split, so the best ratio first is not always best.`,
    };
  }
  if (r.kind === 'zeroOne' && dims === 2) {
    const cur = wr.reads.find((rd) => rd.cell[0] === i);
    if (cur) {
      return {
        slot: 'transition',
        code: 'CURRENT_ROW',
        message: `${here} read ${nameOf(r, cur.cell[0], cur.cell[1])} in its own row. That cell may already contain item ${i}, so item ${i} can be counted twice (here the value is built from items {${formatItems(wr.items)}}). Read row i − 1 instead.`,
      };
    }
  }
  const readsCol = (col: number) => wr.reads.some((rd) => (dims === 2 ? rd.cell[1] : rd.cell[0]) === col);
  if (w !== 1 && wr.j >= 1 && readsCol(wr.j - 1)) {
    return {
      slot: 'transition',
      code: 'NEIGHBOR_COPY',
      message: `${here} = ${f(wr.value)}, but it should be ${f(wr.expected)}. It reads capacity ${wr.j - 1}, the left neighbor. Taking item ${i} frees w[${i}] = ${w} units, so read capacity j − w[i] = ${wr.j - w}.`,
    };
  }
  const readsSkip = wr.reads.some((rd) => (dims === 2 ? rd.cell[0] === i - 1 && rd.cell[1] === wr.j : rd.cell[0] === wr.j));
  if (w <= wr.j && !readsSkip && wr.value < wr.expected) {
    return {
      slot: 'transition',
      code: 'ALWAYS_TAKE',
      message: `${here} = ${f(wr.value)}, but it should be ${f(wr.expected)}. The transition always takes item ${i}; it never compares with skipping it.`,
    };
  }
  if (r.kind === 'zeroOne') {
    // Reuse Predict's classifier: it knows the common wrong numbers for a 0/1 cell.
    const view = dims === 2 ? '2d' : '1d';
    const c = classifyValue({ view, inst: r.inst, t: r.truth, i, j: wr.j }, wr.value);
    if (c && c.code !== 'OTHER') return { slot: 'transition', code: c.code, message: `${here} = ${f(wr.value)}, but it should be ${f(wr.expected)}. ${c.message}` };
  }
  if (w <= wr.j && wr.value === wr.expected - v) {
    return {
      slot: 'transition',
      code: 'MISSING_TAKE',
      message: `${here} = ${f(wr.value)}, but taking item ${i} gives ${f(wr.expected)}. The transition is missing the “take” choice.`,
    };
  }
  return {
    slot: 'transition',
    code: 'OTHER',
    message: `${here} = ${f(wr.value)}, but it should be ${f(wr.expected)}. Its inputs were all correct, so the transition itself computes the wrong value here.`,
  };
}

/** Explain a runtime error and name the slot to look at. */
export function diagnoseError(r: Run): Diagnosis {
  const e = r.error!;
  const here = nameOf(r, e.pass, e.j);
  const dims = r.spec.dims;
  if (e.kind === 'oob' && e.read) {
    const col = dims === 2 ? e.read[1] : e.read[0];
    if (col < 0) {
      const { w } = r.inst.items[e.pass - 1];
      return {
        slot: dims === 2 ? 'transition' : 'order',
        code: 'NEG_CAPACITY',
        message:
          `While computing ${here}: ${e.message} Item ${e.pass} weighs ${w} and does not fit in capacity ${e.j}. ` +
          (dims === 2 ? 'Guard the take choice: if j >= w[i] then … else dp[i-1][j].' : 'Start the loop at j = w[i], or guard the take choice.'),
      };
    }
    return { slot: 'transition', code: 'INDEX_RANGE', message: `While computing ${here}: ${e.message}` };
  }
  if (e.kind === 'unset' && e.read) {
    const inBase = dims === 2 ? e.read[0] === 0 : true;
    if (inBase && dims === 2) {
      return { slot: 'base', code: 'UNSET_BASE', message: `While computing ${here}: ${e.message} Row 0 has to be set by the base case.` };
    }
    if (dims === 1) {
      return { slot: 'base', code: 'UNSET_BASE', message: `While computing ${here}: ${e.message} The base case has to give every dp[j] a starting value.` };
    }
    return {
      slot: 'order',
      code: 'READ_BEFORE_WRITE',
      message: `While computing ${here}: ${e.message} The loop order must fill every cell before any cell that reads it.`,
    };
  }
  if (e.kind === 'item') return { slot: 'transition', code: 'INDEX_RANGE', message: `While computing ${here}: ${e.message}` };
  return { slot: 'transition', code: 'OTHER', message: `While computing ${here}: ${e.message}` };
}

export function describeWrite(r: Run, id: number): string {
  const wr = r.writes[id];
  return `${nameOf(r, wr.pass, wr.j)} = ${f(wr.value)}${wr.ok ? '' : ` (should be ${f(wr.expected)})`}`;
}

