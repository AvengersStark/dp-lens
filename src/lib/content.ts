// Fixed lesson content: the reference spec cards, the curated instances, the Watch
// self-explanation questions, and the choice of which cells Predict pauses on.

import type { Code, Slot } from './codes';
import { type Instance, cellKind } from './knapsack';
import { type Rng, shuffle } from './rng';

export const SPEC_TEXT: Record<'table' | 'array' | 'complete', Record<Slot, string>> = {
  table: {
    state: '`dp[i][j]` = the best total value using only items 1..i, with total weight at most j',
    base: '`dp[0][j] = 0` for every j: with no items, the value is 0',
    transition: 'if `w[i] > j`: `dp[i][j] = dp[i−1][j]` (skip). Otherwise `dp[i][j] = max(dp[i−1][j], dp[i−1][j−w[i]] + v[i])` (skip or take)',
    order: 'row by row, i = 1..n. Within a row any j order works, because row i reads only row i − 1',
    answer: '`dp[n][W]`',
  },
  array: {
    state: 'after item i, `dp[j]` = the best total value using items 1..i, with total weight at most j',
    base: '`dp[j] = 0` for every j',
    transition: '`dp[j] = max(dp[j], dp[j − w[i]] + v[i])`',
    order: 'for each item i: j from W down to w[i]',
    answer: '`dp[W]`',
  },
  complete: {
    state: '`dp[j]` = the best total value with total weight at most j, where items may repeat',
    base: '`dp[j] = 0` for every j',
    transition: '`dp[j] = max(dp[j], dp[j − w[i]] + v[i])`',
    order: 'for each item i: j from w[i] up to W',
    answer: '`dp[W]`',
  },
};

/** The worked example from the proposal's Figure 1. */
export const WATCH_INSTANCE: Instance = { items: [{ w: 2, v: 3 }, { w: 3, v: 4 }, { w: 4, v: 5 }, { w: 5, v: 6 }], W: 5 };

/** The first Predict table everyone sees; later tables are generated per learner. */
export const PREDICT_TABLE_FIRST: Instance = { items: [{ w: 2, v: 3 }, { w: 1, v: 2 }, { w: 3, v: 5 }, { w: 4, v: 6 }], W: 6 };

/** The one-array instance; item 1 has weight 2, so a forward loop reuses it at dp[4]. */
export const PREDICT_ARRAY_FIRST: Instance = { items: [{ w: 2, v: 3 }, { w: 3, v: 4 }, { w: 1, v: 2 }], W: 6 };

export interface Option {
  text: string;
  correct: boolean;
  code?: Code;
  why: string;
}

export interface Question {
  id: string;
  slot: Slot;
  prompt: string;
  options: Option[];
}

export const WATCH_QUESTIONS: Record<string, Question> = {
  base: {
    id: 'watch-base',
    slot: 'base',
    prompt: 'Why is every dp[0][j] equal to 0?',
    options: [
      { text: 'With no items, nothing can be packed, so the best value is 0 for every capacity.', correct: true, why: 'Right. Row 0 means “items 1..0”: no items at all.' },
      {
        text: 'Because a capacity of 0 holds nothing.',
        correct: false,
        code: 'STATE_VAGUE',
        why: 'That explains column 0, dp[i][0]. Row 0 is about having no items, for every capacity j.',
      },
      {
        text: 'Because arrays start at index 0.',
        correct: false,
        code: 'TEMPLATE_RECALL',
        why: 'The 0 in dp[0] is an index. The values in row 0 are 0 for another reason: no items, no value.',
      },
    ],
  },
  nofit: {
    id: 'watch-nofit',
    slot: 'transition',
    prompt: 'dp[1][1] simply copied dp[0][1]. Why?',
    options: [
      { text: 'Item 1 weighs 2 but the capacity is 1. It cannot be taken, so the only choice is to skip it.', correct: true, why: 'Right. When an item does not fit, skip is the only choice.' },
      {
        text: 'Every cell copies the cell above it.',
        correct: false,
        code: 'MISSING_TAKE',
        why: 'Copying is only the skip choice. When the item fits, the cell also tries taking it.',
      },
      {
        text: 'Taking item 1 reads dp[0][−1], which is 0, so the max is the same.',
        correct: false,
        code: 'NEG_CAPACITY',
        why: 'dp[0][−1] does not exist. A negative capacity is not 0; it means the item does not fit.',
      },
    ],
  },
  rowAbove: {
    id: 'watch-row-above',
    slot: 'transition',
    prompt: 'To take item 2, dp[2][5] read dp[1][2] in the row above, not dp[2][2] in its own row. Why?',
    options: [
      { text: 'Row 1 uses only item 1. Adding item 2 to it uses item 2 exactly once.', correct: true, why: 'Right. The row above is the only place that is guaranteed to be “without item 2”.' },
      {
        text: 'It does not matter: dp[2][2] + 4 is also 7.',
        correct: false,
        code: 'CURRENT_ROW',
        why: 'Here the numbers match by luck. dp[2][2] may already contain item 2, and then item 2 would be packed twice. In other tables the numbers differ.',
      },
      {
        text: 'dp[2][2] has not been computed yet.',
        correct: false,
        code: 'READ_BEFORE_WRITE',
        why: 'It has: dp[2][2] = 3 is already filled. The reason is about what the cell means, not about the order.',
      },
    ],
  },
  skipWins: {
    id: 'watch-skip-wins',
    slot: 'transition',
    prompt: 'Item 3 fits (weight 4 ≤ 5), but dp[3][5] stayed 7. Why?',
    options: [
      { text: 'Taking item 3 leaves capacity 1, which is worth 0. So taking gives 0 + 5 = 5, less than 7.', correct: true, why: 'Right. The cell compares the two real totals and keeps the larger one.' },
      {
        text: 'Item 3 has the worst value per weight, so it is never taken.',
        correct: false,
        code: 'GREEDY_RATIO',
        why: 'The table never compares ratios. Look at dp[3][4] = 5: there, taking item 3 wins.',
      },
      {
        text: 'A cell can never be bigger than the cell above it.',
        correct: false,
        code: 'MISSING_TAKE',
        why: 'It can: dp[3][4] = 5 is bigger than dp[2][4] = 4, because taking item 3 won there.',
      },
    ],
  },
  order: {
    id: 'watch-order',
    slot: 'order',
    prompt: 'We filled each row from left to right. Would right to left also work?',
    options: [
      { text: 'Yes. A cell in row i only reads row i − 1, and that row is already complete.', correct: true, why: 'Right. This fact is what makes the one-array version possible later.' },
      {
        text: 'No. DP tables always fill from the top left to the bottom right.',
        correct: false,
        code: 'ORDER_TOP_LEFT',
        why: 'Many tables do, but this one only needs row i − 1 to be done. Right to left works too.',
      },
      {
        text: 'No. dp[i][j] needs dp[i][j − 1] first.',
        correct: false,
        code: 'NEIGHBOR_COPY',
        why: 'No knapsack cell reads its left neighbor. It reads the row above.',
      },
    ],
  },
  answer: {
    id: 'watch-answer',
    slot: 'answer',
    prompt: 'Why is the answer dp[4][5]?',
    options: [
      { text: 'It means: using all 4 items, with weight at most 5. That is exactly the whole problem.', correct: true, why: 'Right. The answer is the cell whose meaning matches the question.' },
      {
        text: 'In DP, the answer is always the bottom-right cell.',
        correct: false,
        code: 'TEMPLATE_RECALL',
        why: 'Right cell, wrong reason. With an “exactly j” state, the answer would be the largest cell in the last row instead.',
      },
      {
        text: 'It is the largest number in the table.',
        correct: false,
        code: 'ANSWER_LOCATION',
        why: 'Here it is, but that is a side effect. The reason is what the cell means.',
      },
    ],
  },
};

export const FORWARD_QUESTION: Question = {
  id: 'array-why-down',
  slot: 'order',
  prompt: 'Why does running j downward prevent the double count?',
  options: [
    {
      text: 'Going down, dp[j − w[i]] is read before it is overwritten, so it still means “without item i”. Item i is added at most once.',
      correct: true,
      why: 'Right. Downward, the cells to the left still hold the row above.',
    },
    { text: 'Going down is faster.', correct: false, code: 'OTHER', why: 'Both directions visit the same cells. The difference is which version of dp[j − w[i]] is read.' },
    {
      text: 'It does not; both directions give the same answer.',
      correct: false,
      code: 'LOOP_FORWARD_01',
      why: 'The forward loop just built dp[4] from item 1 twice. In the 0/1 knapsack that packing is not allowed.',
    },
  ],
};

export interface Target {
  i: number;
  j: number;
  kind: 'nofit' | 'skip' | 'take' | 'tie';
}

function pickOne<T>(rng: Rng, xs: T[]): T | undefined {
  return xs.length ? xs[Math.floor(rng() * xs.length)] : undefined;
}

/**
 * The cells Predict pauses on: one warm-up cell in row 1, then per row one cell where
 * taking wins and one where skipping wins (or the item does not fit). The other cells
 * fill in by themselves.
 */
export function chooseTargets(view: '2d' | '1d', inst: Instance, t: number[][], rng: Rng): Target[] {
  const out: Target[] = [];
  for (let i = 1; i <= inst.items.length; i++) {
    const lo = view === '1d' ? inst.items[i - 1].w : 1;
    const cells: Target[] = [];
    for (let j = lo; j <= inst.W; j++) cells.push({ i, j, kind: cellKind(inst, t, i, j) });
    const take = cells.filter((c) => c.kind === 'take');
    const other = shuffle(rng, cells.filter((c) => c.kind === 'skip' || c.kind === 'tie'));
    const nofit = cells.filter((c) => c.kind === 'nofit');
    const row: Target[] = [];
    if (i === 1) {
      const c = pickOne(rng, take);
      if (c) row.push(c);
    } else {
      const a = pickOne(rng, take);
      if (a) row.push(a);
      const b = other[0] ?? pickOne(rng, nofit);
      if (b) row.push(b);
    }
    // 2D fills left to right; the one-array loop runs j downward.
    row.sort((a, b) => (view === '2d' ? a.j - b.j : b.j - a.j));
    out.push(...row);
  }
  return out;
}

export interface Attempt {
  clean: boolean;
  kind: Target['kind'];
}

/** Mastery: the last three cells were right on the first try, and one of them was a take. */
export function isMastered(history: Attempt[]): boolean {
  const last = history.slice(-3);
  return last.length === 3 && last.every((a) => a.clean) && last.some((a) => a.kind === 'take');
}

/** Which items the best packing uses, by walking the table back from dp[n][W]. */
export function bestPacking(inst: Instance, t: number[][]): number[] {
  const out: number[] = [];
  let j = inst.W;
  for (let i = inst.items.length; i >= 1; i--) {
    if (t[i][j] !== t[i - 1][j]) {
      out.unshift(i);
      j -= inst.items[i - 1].w;
    }
  }
  return out;
}
