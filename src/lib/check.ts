// Checking a whole specification on many instances: used by Write (the learner types the
// transition) and Build (the learner assembles all five slots from blocks).

import type { Slot } from './codes';
import { type Instance, type Kind, type Sem, NEG_INF, formatValue as f, optimum, truthTable } from './knapsack';
import type { Dims } from './notation';
import { type Diagnosis, type Run, type Spec, cellKey, diagnose, diagnoseError, grid, run, traceBack } from './runner';

/** Where the final answer is read from. */
export type AnswerRule = 'nW' | 'maxLast' | 'swap' | 'W' | 'max' | 'n';

export interface Failure {
  /** Index into the instance list. */
  index: number;
  run: Run;
  diag: Diagnosis;
  /** Write ids from the answer back to the diagnosed cell (empty for errors and answer-slot failures). */
  chain: number[];
  /** The cell the diagnosis is about, if any. */
  focus: number | null;
}

export interface CheckResult {
  total: number;
  passed: number;
  first: Failure | null;
}

export function readAnswer(r: Run, rule: AnswerRule): { value: number; cells: number[][] } | { error: string } {
  const n = r.inst.items.length;
  const W = r.inst.W;
  const at = (i: number, j: number) => {
    const id = r.latest.get(cellKey(r.spec.dims, i, j));
    return id === undefined ? NEG_INF : r.writes[id].value;
  };
  switch (rule) {
    case 'nW':
      return { value: at(n, W), cells: [[n, W]] };
    case 'W':
      return { value: at(0, W), cells: [[0, W]] };
    case 'maxLast':
    case 'max': {
      const row = rule === 'maxLast' ? n : 0;
      let best = NEG_INF;
      const cells: number[][] = [];
      for (let j = 0; j <= W; j++) {
        best = Math.max(best, at(row, j));
        cells.push([row, j]);
      }
      return { value: best, cells };
    }
    case 'swap':
      if (W > n) return { error: `dp[W][n] = dp[${W}][${n}] does not exist: there are only rows 0 to n = ${n}. Rows are items and columns are capacities.` };
      if (n > W) return { error: `dp[W][n] = dp[${W}][${n}] does not exist: there are only columns 0 to W = ${W}. Rows are items and columns are capacities.` };
      return { value: at(W, n), cells: [[W, n]] };
    case 'n':
      if (n > W) return { error: `dp[n] = dp[${n}] does not exist: the array only goes up to capacity W = ${W}.` };
      return { value: at(0, n), cells: [[0, n]] };
  }
}

function answerCell(r: Run, rule: AnswerRule): number | null {
  const cell = rule === 'nW' ? [r.inst.items.length, r.inst.W] : rule === 'W' ? [0, r.inst.W] : null;
  if (!cell) return null;
  return r.latest.get(cellKey(r.spec.dims, cell[0], cell[1])) ?? null;
}

/** Diagnose the first problem in a run whose table is wrong, tracing from the answer when possible. */
function tableFailure(index: number, r: Run, rule: AnswerRule): Failure | null {
  if (r.error) return { index, run: r, diag: diagnoseError(r), chain: [], focus: null };
  const ans = answerCell(r, rule);
  if (ans !== null && !r.writes[ans].ok) {
    const chain = traceBack(r, ans);
    const focus = chain[chain.length - 1];
    return { index, run: r, diag: diagnose(r, focus), chain, focus };
  }
  if (r.rootId !== null) return { index, run: r, diag: diagnose(r, r.rootId), chain: [r.rootId], focus: r.rootId };
  const unset = grid(r)
    .flatMap((row, i) => row.map((wr, j) => (wr ? null : r.spec.dims === 2 ? `dp[${i}][${j}]` : `dp[${j}]`)))
    .filter((x): x is string => x !== null);
  if (unset.length) {
    const shown = unset.length > 3 ? `${unset.slice(0, 3).join(', ')} and ${unset.length - 3} more` : unset.join(', ');
    return {
      index,
      run: r,
      diag: { slot: 'base', code: 'UNSET_BASE', message: `${shown} never get a value. The base case has to give every cell a starting value.` },
      chain: [],
      focus: null,
    };
  }
  return null;
}

export interface WriteProblem {
  kind: Kind;
  dims: Dims;
  answer: AnswerRule;
}

/** Write mode: the state, base case and answer are fixed; only transition and order vary. */
export function checkWrite(p: WriteProblem, spec: Spec, instances: Instance[]): CheckResult {
  let passed = 0;
  let first: Failure | null = null;
  instances.forEach((inst, index) => {
    const r = run(inst, spec, p.kind, truthTable(inst, p.kind, 'atMost'));
    const fail = tableFailure(index, r, p.answer);
    if (fail) first ??= fail;
    else passed++;
  });
  return { total: instances.length, passed, first };
}

export interface StateMeaning {
  kind: Kind;
  sem: Sem;
}

/**
 * Build mode: everything comes from the learner's card. Cells are checked against the
 * learner's own state, and the answer against the real problem, so a card can be
 * internally consistent and still solve the wrong problem.
 */
export function checkCard(problemKind: Kind, state: StateMeaning, spec: Spec, answer: AnswerRule, instances: Instance[]): CheckResult {
  let passed = 0;
  let first: Failure | null = null;
  instances.forEach((inst, index) => {
    const truth = truthTable(inst, state.kind, state.sem);
    const r = run(inst, spec, state.kind, truth);
    let fail = tableFailure(index, r, answer);
    if (fail && state.kind !== problemKind) fail = stateKindFailure(index, inst, spec, problemKind, state) ?? fail;
    if (!fail) fail = answerFailure(index, r, problemKind, state, answer);
    if (fail) first ??= fail;
    else passed++;
  });
  return { total: instances.length, passed, first };
}

/**
 * The table disagrees with the learner's state, but it is exactly right for the real
 * problem: the rest of the card is fine and the state is the slot to fix.
 */
function stateKindFailure(index: number, inst: Instance, spec: Spec, problemKind: Kind, state: StateMeaning): Failure | null {
  const r = run(inst, spec, problemKind, truthTable(inst, problemKind, state.sem));
  if (r.error || r.rootId !== null) return null;
  return {
    index,
    run: r,
    diag: {
      slot: 'state',
      code: 'STATE_KIND',
      message:
        state.kind === 'complete'
          ? 'Your base case, transition and order compute the 0/1 knapsack correctly, but your state says items may be used many times. The state has to describe what the table really holds: each item at most once.'
          : 'Your base case, transition and order compute the complete knapsack correctly, but your state says each item at most once. The state has to describe what the table really holds: items may repeat.',
    },
    chain: [],
    focus: null,
  };
}

function answerFailure(index: number, r: Run, problemKind: Kind, state: StateMeaning, rule: AnswerRule): Failure | null {
  const got = readAnswer(r, rule);
  const best = optimum(r.inst, problemKind);
  const fail = (slot: Slot, code: Failure['diag']['code'], message: string): Failure => ({ index, run: r, diag: { slot, code, message }, chain: [], focus: null });
  if ('error' in got) return fail('answer', 'INDEX_RANGE', got.error);
  if (got.value === best) return null;
  if (state.kind !== problemKind) {
    return fail(
      'state',
      'STATE_KIND',
      state.kind === 'complete'
        ? `Your table is right for your state, but your state lets an item be used many times. In this problem each item can be used once, so the best value is ${f(best)}, not ${f(got.value)}.`
        : `Your table is right for your state, but your state uses each item at most once. In this problem items can repeat, so the best value is ${f(best)}, not ${f(got.value)}.`,
    );
  }
  if (rule === 'nW' && state.sem === 'exactly') {
    return fail(
      'answer',
      'ANSWER_LOCATION',
      `With an “exactly j” state, dp[n][W] only counts packings that weigh exactly W = ${r.inst.W}. Here that gives ${f(got.value)}, but a lighter packing is worth ${f(best)}. Take the largest dp[n][j] instead.`,
    );
  }
  if (rule === 'n') {
    return fail(
      'answer',
      'ANSWER_LOCATION',
      `dp[n] is the best value for capacity n = ${r.inst.items.length}, the number of items. The question asks about capacity W = ${r.inst.W}.`,
    );
  }
  return fail('answer', 'ANSWER_LOCATION', `The answer cell holds ${f(got.value)}, but the best value for the whole problem is ${f(best)}.`);
}
