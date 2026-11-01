// Step-level tutoring for one 0/1 cell: the plain-sentence and formula explanations,
// the escalating hints, and the classification of a wrong value or wrong dependency set.
// Predict uses all of it; Write and Build reuse the value classifier on their first
// wrong cell.

import type { Code } from './codes';
import { type Instance, cellKind, formatValue as f, greedyValue } from './knapsack';

/** "2d": dp[i][j] in a table. "1d": dp[j] in one array, j running downward. */
export type View = '2d' | '1d';

export function cellName(view: View, i: number, j: number): string {
  return view === '2d' ? `dp[${i}][${j}]` : `dp[${j}]`;
}

/** The cell that the "skip" and "take" choices read, in this view's coordinates. */
export function sources(inst: Instance, i: number, j: number): { skip: number[]; take: number[] | null } {
  const { w } = inst.items[i - 1];
  return { skip: [i - 1, j], take: w <= j ? [i - 1, j - w] : null };
}

interface Ctx {
  view: View;
  inst: Instance;
  /** The correct 0/1 table (truthTable(inst, 'zeroOne', 'atMost')). */
  t: number[][];
  i: number;
  j: number;
}

function parts(c: Ctx) {
  const { w, v } = c.inst.items[c.i - 1];
  const skipName = c.view === '2d' ? cellName('2d', c.i - 1, c.j) : cellName('1d', c.i, c.j);
  const takeName = c.view === '2d' ? cellName('2d', c.i - 1, c.j - w) : cellName('1d', c.i, c.j - w);
  const skip = c.t[c.i - 1][c.j];
  const take = w <= c.j ? c.t[c.i - 1][c.j - w] + v : null;
  return { w, v, skipName, takeName, skip, take, here: cellName(c.view, c.i, c.j), kind: cellKind(c.inst, c.t, c.i, c.j) };
}

/** One or two plain sentences: what each choice is worth and which one wins. */
export function explainCell(c: Ctx): string {
  const p = parts(c);
  if (p.kind === 'nofit') {
    return c.view === '2d'
      ? `Item ${c.i} weighs ${p.w}, more than capacity ${c.j}, so it cannot go in. ${p.here} copies ${p.skipName} = ${f(p.skip)}.`
      : `Item ${c.i} weighs ${p.w}, more than capacity ${c.j}. The loop stops before ${p.here}, so it keeps ${f(p.skip)}.`;
  }
  const keep = c.view === '2d' ? `keep ${p.skipName} = ${f(p.skip)}` : `keep the old ${p.here} = ${f(p.skip)}`;
  const takeSrc =
    c.view === '2d'
      ? `capacity ${c.j} − ${p.w} = ${c.j - p.w} is left, so ${p.takeName} + ${p.v} = ${f(p.take)}`
      : `${p.takeName} still holds its value from before item ${c.i}, so ${p.takeName} + ${p.v} = ${f(p.take)}`;
  const verdict =
    p.kind === 'take' ? 'Taking wins.' : p.kind === 'skip' ? 'Skipping wins.' : 'Both give the same value.';
  return `Skip item ${c.i}: ${keep}. Take item ${c.i}: ${takeSrc}. ${verdict}`;
}

/** The transition with the numbers filled in. */
export function formulaCell(c: Ctx): string {
  const p = parts(c);
  const result = f(c.t[c.i][c.j]);
  if (p.kind === 'nofit') return `${p.here} = ${p.skipName} = ${result}   (w[${c.i}] = ${p.w} > ${c.j})`;
  return `${p.here} = max(${p.skipName}, ${p.takeName} + ${p.v}) = max(${f(p.skip)}, ${f(p.take! - p.v)} + ${p.v}) = ${result}`;
}

/** Hints escalate: name the slot, then point at the cells, then give the worked step. */
export function hint(c: Ctx, level: 1 | 2 | 3): string {
  const p = parts(c);
  if (level === 1) {
    return `This is a transition step. First ask: does item ${c.i} (weight ${p.w}) fit in capacity ${c.j}? If it does, compare two choices: skip it, or take it.`;
  }
  if (level === 2) {
    if (p.kind === 'nofit') return `It does not fit, so there is only one choice: skip. Read ${p.skipName}.`;
    return c.view === '2d'
      ? `Skip reads ${p.skipName}, straight above. Take reads ${p.takeName}: the row above, ${p.w} columns to the left. Then add v[${c.i}] = ${p.v}.`
      : `Skip keeps the old ${p.here}. Take reads ${p.takeName}, ${p.w} cells to the left, then adds v[${c.i}] = ${p.v}.`;
  }
  return `Worked step: ${formulaCell(c)}.`;
}

export interface Classified {
  code: Code;
  message: string;
}

/** Why might a learner have typed x for this cell? Returns null when x is right. */
export function classifyValue(c: Ctx, x: number): Classified | null {
  const correct = c.t[c.i][c.j];
  if (x === correct) return null;
  const p = parts(c);
  const fits = p.take !== null;
  if (!fits && (x === p.skip + p.v || x === p.v)) {
    return {
      code: 'NEG_CAPACITY',
      message: `It looks like item ${c.i} went in. But it weighs ${p.w} and the capacity is only ${c.j}, so it cannot.`,
    };
  }
  if (fits && p.take! < p.skip && x === p.take) {
    return {
      code: 'ALWAYS_TAKE',
      message: `You took item ${c.i}. It fits, but taking is not always better. Compare it with skipping.`,
    };
  }
  if (fits && p.take! > p.skip && x === p.skip) {
    return {
      code: 'MISSING_TAKE',
      message: `That is the “skip” value. Item ${c.i} fits (${p.w} ≤ ${c.j}). What do you get if you take it?`,
    };
  }
  if (fits && x === p.skip + p.v) {
    return {
      code: 'NO_WEIGHT_SUBTRACT',
      message: `You added v[${c.i}] = ${p.v} to ${p.skipName}. But item ${c.i} needs ${p.w} units of room, so start from capacity ${c.j} − ${p.w}.`,
    };
  }
  if (fits && x === Math.max(p.skip, c.t[c.i][c.j - p.w] + p.v)) {
    return c.view === '2d'
      ? {
          code: 'CURRENT_ROW',
          message: `Your number matches reading ${cellName('2d', c.i, c.j - p.w)} in the current row. That cell may already contain item ${c.i}, so item ${c.i} would be counted twice. Take from the row above.`,
        }
      : {
          code: 'CURRENT_ROW',
          message: `Your number uses the new value of ${p.takeName}. But j runs downward, so ${p.takeName} has not been updated for item ${c.i} yet.`,
        };
  }
  if (c.j >= 1) {
    const left = c.t[c.i][c.j - 1];
    const diag = c.t[c.i - 1][c.j - 1];
    if (x === left || x === diag || x === diag + p.v) {
      return {
        code: 'NEIGHBOR_COPY',
        message: `Your number matches a neighbor cell. In the knapsack, a cell is built from the row above (and ${p.w} columns left), not from its left or diagonal neighbor.`,
      };
    }
  }
  if (x === greedyValue(c.inst, c.i, c.j, 'zeroOne')) {
    return {
      code: 'GREEDY_RATIO',
      message: 'Your number matches a greedy choice by value per weight. Greedy can miss the best packing; compare skip and take instead.',
    };
  }
  return {
    code: 'OTHER',
    message: fits
      ? `Not quite. Work out both choices for item ${c.i}: skip it, and take it. Then keep the larger one.`
      : `Not quite. First check whether item ${c.i} fits in capacity ${c.j}.`,
  };
}

export interface DepVerdict {
  ok: boolean;
  missing: number[][];
  extra: number[][];
  feedback: Classified | null;
}

/**
 * Compare the cells a learner clicked with the cells the value depends on.
 * Coordinates are [row, col] in both views; in the one-array view row is ignored
 * (all reads are in the same array) and only the column matters.
 */
export function classifyDeps(c: Ctx, clicked: number[][]): DepVerdict {
  const p = parts(c);
  const src = sources(c.inst, c.i, c.j);
  const want = [src.skip, ...(src.take ? [src.take] : [])];
  const same = c.view === '2d' ? (a: number[], b: number[]) => a[0] === b[0] && a[1] === b[1] : (a: number[], b: number[]) => a[1] === b[1];
  const missing = want.filter((x) => !clicked.some((y) => same(x, y)));
  const extra = clicked.filter((y) => !want.some((x) => same(x, y)));
  const ok = missing.length === 0 && extra.length === 0;
  if (ok) return { ok, missing, extra, feedback: null };

  const name = (cell: number[]) => (c.view === '2d' ? cellName('2d', cell[0], cell[1]) : cellName('1d', 0, cell[1]));
  if (c.view === '2d') {
    const sameRow = extra.find((y) => y[0] === c.i);
    if (sameRow && p.take !== null && sameRow[1] === c.j - p.w) {
      return {
        ok,
        missing,
        extra,
        feedback: {
          code: 'CURRENT_ROW',
          message: `You marked ${name(sameRow)}, in the current row. It may already contain item ${c.i}, so taking from it could use item ${c.i} twice. Take from the row above: ${p.takeName}.`,
        },
      };
    }
    const neighbor = extra.find((y) => (y[0] === c.i && y[1] === c.j - 1) || (y[0] === c.i - 1 && y[1] === c.j - 1));
    if (neighbor) {
      return {
        ok,
        missing,
        extra,
        feedback: {
          code: 'NEIGHBOR_COPY',
          message: `You marked the neighbor ${name(neighbor)}. Knapsack cells do not depend on their left or diagonal neighbor; they read the row above.`,
        },
      };
    }
  }
  if (missing.length > 0) {
    const takeMissing = src.take && missing.some((x) => same(x, src.take!));
    return {
      ok,
      missing,
      extra,
      feedback: {
        code: 'MISSING_DEP',
        message: takeMissing
          ? `One cell is missing: the “take” choice needs the value at capacity ${c.j} − ${p.w} = ${c.j - p.w} from before item ${c.i}.`
          : `One cell is missing: the “skip” choice reads ${p.skipName}.`,
      },
    };
  }
  return {
    ok,
    missing,
    extra,
    feedback: {
      code: 'EXTRA_DEP',
      message:
        p.kind === 'nofit'
          ? `Item ${c.i} does not fit, so this cell depends on one cell only.`
          : `You marked ${name(extra[0])}, which this cell does not read. It reads exactly two cells: one for skip and one for take.`,
    },
  };
}
