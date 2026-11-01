// Build mode: a Parsons problem over the five-slot spec card. Each block maps to
// something the runner can execute, so the card is judged by running it, not by an
// answer key: any combination that produces the right table and answer passes.

import { type Code, type Slot, SLOT_LABEL } from './codes';
import { type AnswerRule, type CheckResult, type StateMeaning, checkCard } from './check';
import { type Instance, type Kind, checkInstances } from './knapsack';
import { type Dims, parse } from './notation';
import type { BaseRule, Order, Spec, Transition } from './runner';

export interface Block {
  id: string;
  slot: Slot;
  /** Display text; `code` spans are written in backticks. */
  text: string;
  state?: StateMeaning | 'vague';
  base?: BaseRule;
  transition?: string | 'greedy';
  order?: Order;
  answer?: AnswerRule;
  /** Shown after success when the learner used this block, for valid alternatives. */
  note?: string;
}

export interface BuildProblem {
  id: 'zo2d' | 'complete';
  kind: Kind;
  dims: Dims;
  title: string;
  task: string;
  blocks: Block[];
}

const T_OK_2D = 'if j >= w[i] then max(dp[i-1][j], dp[i-1][j-w[i]] + v[i]) else dp[i-1][j]';

export const BUILD_PROBLEMS: Record<BuildProblem['id'], BuildProblem> = {
  zo2d: {
    id: 'zo2d',
    kind: 'zeroOne',
    dims: 2,
    title: '0/1 knapsack, table version',
    task: 'Each item can be packed at most once. Find the largest total value with total weight at most W.',
    blocks: [
      { id: 's-atmost', slot: 'state', state: { kind: 'zeroOne', sem: 'atMost' }, text: '`dp[i][j]` = the best total value using only items 1..i, with total weight at most j' },
      {
        id: 's-exact',
        slot: 'state',
        state: { kind: 'zeroOne', sem: 'exactly' },
        text: '`dp[i][j]` = the best total value using only items 1..i, with total weight exactly j (−∞ if impossible)',
        note: 'An “exactly j” state works too, as long as the base case and the answer match it.',
      },
      { id: 's-repeat', slot: 'state', state: { kind: 'complete', sem: 'atMost' }, text: '`dp[i][j]` = the best total value using items 1..i, each as many times as you like, with total weight at most j' },
      { id: 's-vague', slot: 'state', state: 'vague', text: '`dp[i][j]` = the answer at row i and column j' },

      { id: 'b-zeros', slot: 'base', base: 'zeros', text: '`dp[0][j] = 0` for every j (no items, no value)' },
      { id: 'b-exact', slot: 'base', base: 'exactRow0', text: '`dp[0][0] = 0`, and `dp[0][j] = −∞` for every j > 0' },
      { id: 'b-col0', slot: 'base', base: 'col0Only', text: '`dp[i][0] = 0` for every i (capacity 0, no value)' },

      { id: 't-ok', slot: 'transition', transition: T_OK_2D, text: 'if j ≥ w[i]: `dp[i][j] = max(dp[i−1][j], dp[i−1][j−w[i]] + v[i])`; otherwise `dp[i][j] = dp[i−1][j]`' },
      {
        id: 't-cur',
        slot: 'transition',
        transition: 'if j >= w[i] then max(dp[i-1][j], dp[i][j-w[i]] + v[i]) else dp[i-1][j]',
        text: 'if j ≥ w[i]: `dp[i][j] = max(dp[i−1][j], dp[i][j−w[i]] + v[i])`; otherwise `dp[i][j] = dp[i−1][j]`',
      },
      { id: 't-noguard', slot: 'transition', transition: 'max(dp[i-1][j], dp[i-1][j-w[i]] + v[i])', text: '`dp[i][j] = max(dp[i−1][j], dp[i−1][j−w[i]] + v[i])` for every j' },
      { id: 't-greedy', slot: 'transition', transition: 'greedy', text: '`dp[i][j]` = fill capacity j with items 1..i, best value-per-weight first, while they fit' },

      { id: 'o-iup-jup', slot: 'order', order: { dims: 2, outer: 'i', iDir: 'up', jDir: 'up' }, text: 'for i = 1 to n, then for j = 0 to W' },
      {
        id: 'o-iup-jdown',
        slot: 'order',
        order: { dims: 2, outer: 'i', iDir: 'up', jDir: 'down' },
        text: 'for i = 1 to n, then for j = W down to 0',
        note: 'Right to left works too: row i only reads row i − 1, which is already complete. A DP table does not have to fill from the top left.',
      },
      {
        id: 'o-jouter',
        slot: 'order',
        order: { dims: 2, outer: 'j', iDir: 'up', jDir: 'up' },
        text: 'for j = 0 to W, then for i = 1 to n (column by column)',
        note: 'Column by column works too: every cell it reads is in an earlier column or in the row above.',
      },
      { id: 'o-idown', slot: 'order', order: { dims: 2, outer: 'i', iDir: 'down', jDir: 'up' }, text: 'for i = n down to 1, then for j = 0 to W' },

      { id: 'a-nW', slot: 'answer', answer: 'nW', text: '`dp[n][W]`' },
      {
        id: 'a-max',
        slot: 'answer',
        answer: 'maxLast',
        text: 'the largest `dp[n][j]` over all j',
        note: 'Taking the largest dp[n][j] is needed for an “exactly j” state. With “at most j” it also works, but dp[n][W] is already the largest.',
      },
      { id: 'a-swap', slot: 'answer', answer: 'swap', text: '`dp[W][n]`' },
    ],
  },
  complete: {
    id: 'complete',
    kind: 'complete',
    dims: 1,
    title: 'Complete knapsack, one array',
    task: 'Now every item can be packed as many times as you like. Find the largest total value with total weight at most W, using one array dp[0..W].',
    blocks: [
      { id: 'c-s-ok', slot: 'state', state: { kind: 'complete', sem: 'atMost' }, text: '`dp[j]` = the best total value with total weight at most j, using each item as many times as you like' },
      { id: 'c-s-once', slot: 'state', state: { kind: 'zeroOne', sem: 'atMost' }, text: '`dp[j]` = the best total value with total weight at most j, using each item at most once' },
      { id: 'c-s-vague', slot: 'state', state: 'vague', text: '`dp[j]` = the value of the item whose weight is j' },

      { id: 'c-b-zeros', slot: 'base', base: 'zeros', text: '`dp[j] = 0` for every j' },
      { id: 'c-b-dp0', slot: 'base', base: 'dp0Only', text: '`dp[0] = 0`, and nothing else' },
      { id: 'c-b-exact', slot: 'base', base: 'exactRow0', text: '`dp[0] = 0`, and `dp[j] = −∞` for every j > 0' },

      { id: 'c-t-ok', slot: 'transition', transition: 'max(dp[j], dp[j-w[i]] + v[i])', text: '`dp[j] = max(dp[j], dp[j − w[i]] + v[i])`' },
      { id: 'c-t-take', slot: 'transition', transition: 'dp[j-w[i]] + v[i]', text: '`dp[j] = dp[j − w[i]] + v[i]`' },
      { id: 'c-t-left', slot: 'transition', transition: 'max(dp[j], dp[j-1] + v[i])', text: '`dp[j] = max(dp[j], dp[j − 1] + v[i])`' },

      { id: 'c-o-up', slot: 'order', order: { dims: 1, jDir: 'up', jFrom: 'w' }, text: 'for each item i: j = w[i] up to W' },
      { id: 'c-o-down', slot: 'order', order: { dims: 1, jDir: 'down', jFrom: 'w' }, text: 'for each item i: j = W down to w[i]' },
      { id: 'c-o-zero', slot: 'order', order: { dims: 1, jDir: 'up', jFrom: 'zero' }, text: 'for each item i: j = 0 up to W' },

      { id: 'c-a-W', slot: 'answer', answer: 'W', text: '`dp[W]`' },
      { id: 'c-a-max', slot: 'answer', answer: 'max', text: 'the largest `dp[j]` over all j', note: 'The largest dp[j] works, but with “at most j” dp[W] is already the largest.' },
      { id: 'c-a-n', slot: 'answer', answer: 'n', text: '`dp[n]`' },
    ],
  },
};

/** A fixed set of instances for Build: the same for everyone, small ones first. */
export const BUILD_INSTANCES: Instance[] = checkInstances(60, 777);

export type Placement = Partial<Record<Slot, string>>;

export interface SlotVerdict {
  slot: Slot;
  code: Code;
  message: string;
}

export type CardResult =
  | { status: 'incomplete'; missing: Slot[] }
  | { status: 'misplaced'; verdicts: SlotVerdict[] }
  | { status: 'checked'; check: CheckResult; badSlot: Slot | null; verdict: SlotVerdict | null; notes: string[] };

export function blockById(p: BuildProblem, id: string): Block {
  const b = p.blocks.find((x) => x.id === id);
  if (!b) throw new Error(`no block ${id}`);
  return b;
}

const SLOT_ORDER: Slot[] = ['state', 'base', 'transition', 'order', 'answer'];

export function evaluateCard(p: BuildProblem, placement: Placement, instances = BUILD_INSTANCES): CardResult {
  const missing = SLOT_ORDER.filter((s) => !placement[s]);
  if (missing.length) return { status: 'incomplete', missing };

  const blocks = Object.fromEntries(SLOT_ORDER.map((s) => [s, blockById(p, placement[s]!)])) as Record<Slot, Block>;
  const misplaced = SLOT_ORDER.filter((s) => blocks[s].slot !== s).map((s) => ({
    slot: s,
    code: 'WRONG_SLOT' as Code,
    message: `This block describes the ${SLOT_LABEL[blocks[s].slot].toLowerCase()}, not the ${SLOT_LABEL[s].toLowerCase()}.`,
  }));
  if (misplaced.length) return { status: 'misplaced', verdicts: misplaced };

  const state = blocks.state.state!;
  if (state === 'vague') {
    const verdict: SlotVerdict = {
      slot: 'state',
      code: 'STATE_VAGUE',
      message: 'This state does not say which items are allowed or what j measures, so no cell can be checked against it. A good state answers: using which items, with what capacity, best what?',
    };
    return { status: 'checked', check: { total: 0, passed: 0, first: null }, badSlot: 'state', verdict, notes: [] };
  }

  const tr = blocks.transition.transition!;
  const transition: Transition = tr === 'greedy' ? { kind: 'greedy' } : { kind: 'formula', node: parse(tr, p.dims) };
  const spec: Spec = { dims: p.dims, base: blocks.base.base!, transition, order: blocks.order.order! };
  const check = checkCard(p.kind, state, spec, blocks.answer.answer!, instances);
  if (check.first) {
    const d = check.first.diag;
    return { status: 'checked', check, badSlot: d.slot, verdict: { slot: d.slot, code: d.code, message: d.message }, notes: [] };
  }
  const notes = SLOT_ORDER.map((s) => blocks[s].note).filter((x): x is string => !!x);
  return { status: 'checked', check, badSlot: null, verdict: null, notes };
}
