// The Unit Check: a 20-minute test in two parallel forms, given without feedback.
// Parts climb from Apply to Create: Trace (auto-scored), Explain, Debug, Design
// (rubric-scored by the teacher; Debug's line choice is auto-scored).

import { type Instance, truthTable } from './knapsack';

export interface Form {
  id: 'A' | 'B';
  trace: { inst: Instance; cells: [number, number][] };
  explain: { context: string; code: string[]; q1: string; q2: string };
  debug: { claim: string; lines: string[]; bugLine: number };
  design: string;
}

export const FORMS: Record<'A' | 'B', Form> = {
  A: {
    id: 'A',
    trace: {
      inst: { items: [{ w: 3, v: 5 }, { w: 2, v: 3 }, { w: 4, v: 6 }], W: 7 },
      cells: [
        [2, 5],
        [3, 4],
        [3, 6],
        [3, 7],
      ],
    },
    explain: {
      context: 'This program solves the 0/1 knapsack: each item can be packed at most once.',
      code: ['dp[0..W] = 0', 'for i = 1 to n:', '    for j = W down to w[i]:', '        dp[j] = max(dp[j], dp[j - w[i]] + v[i])', 'print dp[W]'],
      q1: 'After the outer loop finishes item i, what does dp[j] mean? Answer in one sentence.',
      q2: 'Why does j run from W down to w[i], and not upward?',
    },
    debug: {
      claim: 'This program should solve the 0/1 knapsack (each item at most once). For some inputs it prints a wrong answer.',
      lines: ['dp[0..W] = 0', 'for i = 1 to n:', '    for j = w[i] to W:', '        dp[j] = max(dp[j], dp[j - w[i]] + v[i])', 'print dp[W]'],
      bugLine: 3,
    },
    design:
      'You have n coins with values c[1..n]. Each coin can be used at most once. Count how many different sets of coins add up to exactly S. Fill in the five slots of a spec card.',
  },
  B: {
    id: 'B',
    trace: {
      inst: { items: [{ w: 2, v: 4 }, { w: 3, v: 5 }, { w: 1, v: 1 }], W: 7 },
      cells: [
        [2, 4],
        [2, 5],
        [3, 4],
        [3, 7],
      ],
    },
    explain: {
      context: 'This program solves the complete knapsack: each item can be packed any number of times.',
      code: ['dp[0..W] = 0', 'for i = 1 to n:', '    for j = w[i] to W:', '        dp[j] = max(dp[j], dp[j - w[i]] + v[i])', 'print dp[W]'],
      q1: 'After the outer loop finishes item i, what does dp[j] mean? Answer in one sentence.',
      q2: 'Why does j run upward from w[i] to W here?',
    },
    debug: {
      claim: 'This program should solve the complete knapsack (items may repeat). For some inputs it prints a wrong answer.',
      lines: ['dp[0..W] = 0', 'for i = 1 to n:', '    for j = W down to w[i]:', '        dp[j] = max(dp[j], dp[j - w[i]] + v[i])', 'print dp[W]'],
      bugLine: 3,
    },
    design:
      'You have n coin types with values c[1..n], and unlimited coins of each type. Find the smallest number of coins that add up to exactly S, or report that it is impossible. Fill in the five slots of a spec card.',
  },
};

export interface Answers {
  trace: string[];
  explain1: string;
  explain2: string;
  debugLine: number | null;
  debugFix: string;
  design: Record<'state' | 'base' | 'transition' | 'order' | 'answer', string>;
}

export function emptyAnswers(): Answers {
  return { trace: ['', '', '', ''], explain1: '', explain2: '', debugLine: null, debugFix: '', design: { state: '', base: '', transition: '', order: '', answer: '' } };
}

export function scoreAuto(form: Form, a: Answers): { trace: number; debugLine: boolean } {
  const t = truthTable(form.trace.inst, 'zeroOne', 'atMost');
  const trace = form.trace.cells.filter(([i, j], k) => a.trace[k].trim() !== '' && Number(a.trace[k]) === t[i][j]).length;
  return { trace, debugLine: a.debugLine === form.debug.bugLine };
}

/** Analytic rubric with anchor answers, shown to the teacher next to each open answer. */
export const RUBRIC = {
  explain1: {
    A: '2: “the best value using items 1..i with total weight at most j”. 1: right idea but misses “items 1..i” or “at most”. 0: describes the code, not the meaning.',
    B: '2: “the best value using items 1..i, each any number of times, with weight at most j”. 1: misses one qualifier. 0: describes the code, not the meaning.',
  },
  explain2: {
    A: '2: downward, dp[j − w[i]] still holds the value from before item i, so item i is used at most once. 1: “otherwise items are reused” without why. 0: other.',
    B: '2: upward, dp[j − w[i]] may already include item i, which allows reuse. 1: “so items can repeat” without why. 0: other.',
  },
  debugFix: {
    A: '2: “for j = W down to w[i]”. 1: reverses the loop but with a wrong bound. 0: other.',
    B: '2: “for j = w[i] to W”. 1: reverses the loop but with a wrong bound. 0: other.',
  },
  design: {
    A: {
      state: 'dp[i][s] = number of sets of coins 1..i that add up to exactly s (or one array dp[s]).',
      base: 'dp[0][0] = 1 (the empty set), dp[0][s] = 0 for s > 0.',
      transition: 'dp[i][s] = dp[i−1][s] + (s ≥ c[i] ? dp[i−1][s − c[i]] : 0).',
      order: 'i from 1 to n; any s order in 2D. One array: s from S down to c[i].',
      answer: 'dp[n][S].',
    },
    B: {
      state: 'dp[s] = fewest coins that add up to exactly s (∞ if impossible).',
      base: 'dp[0] = 0, dp[s] = ∞ for s > 0.',
      transition: 'dp[s] = min(dp[s], dp[s − c[i]] + 1).',
      order: 'for each coin i: s from c[i] up to S (or s outer, coins inner).',
      answer: 'dp[S]; impossible if it is ∞.',
    },
  },
  scale: 'Each open item: 2 = correct and precise, 1 = right idea with a flawed detail (e.g. an off-by-one bound), 0 = otherwise.',
};
