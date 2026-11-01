import { describe, expect, it } from 'vitest';
import { BUILD_PROBLEMS, type Placement, evaluateCard } from '../src/lib/build';
import { checkWrite } from '../src/lib/check';
import { type Instance, type Kind, checkInstances, greedyValue, mulberry32Instance, optimum, predictInstance, truthTable } from './helpers';
import { NotationError, evaluate, parse } from '../src/lib/notation';
import type { Order, Spec } from '../src/lib/runner';
import { classifyDeps, classifyValue } from '../src/lib/tutor';

/** Exhaustive search over copy counts: the slowest, most obviously correct answer. */
function exhaustive(inst: Instance, kind: Kind, i: number, j: number, exact: boolean): number {
  let best = -Infinity;
  const rec = (k: number, wt: number, val: number) => {
    if (k === i) {
      if (exact ? wt === j : wt <= j) best = Math.max(best, val);
      return;
    }
    const { w, v } = inst.items[k];
    const cap = kind === 'zeroOne' ? 1 : Math.floor(j / w);
    for (let c = 0; c <= cap && wt + c * w <= j; c++) rec(k + 1, wt + c * w, val + c * v);
  };
  rec(0, 0, 0);
  return best;
}

describe('truth tables', () => {
  it('match exhaustive search', () => {
    for (let s = 1; s <= 40; s++) {
      const inst = mulberry32Instance(s);
      for (const kind of ['zeroOne', 'complete'] as Kind[]) {
        const at = truthTable(inst, kind, 'atMost');
        const ex = truthTable(inst, kind, 'exactly');
        for (let i = 0; i <= inst.items.length; i++) {
          for (let j = 0; j <= inst.W; j++) {
            expect(at[i][j]).toBe(exhaustive(inst, kind, i, j, false));
            expect(ex[i][j]).toBe(exhaustive(inst, kind, i, j, true));
          }
        }
      }
    }
  });

  it('reproduces the proposal figure', () => {
    const inst = { items: [{ w: 2, v: 3 }, { w: 3, v: 4 }, { w: 4, v: 5 }, { w: 5, v: 6 }], W: 5 };
    const t = truthTable(inst, 'zeroOne', 'atMost');
    expect(t[1]).toEqual([0, 0, 3, 3, 3, 3]);
    expect(t[2]).toEqual([0, 0, 3, 4, 4, 7]);
    expect(optimum(inst, 'zeroOne')).toBe(7);
  });

  it('greedy differs from optimum somewhere', () => {
    const inst = { items: [{ w: 3, v: 5 }, { w: 2, v: 3 }, { w: 2, v: 3 }], W: 4 };
    expect(greedyValue(inst, 3, 4, 'zeroOne')).toBe(5);
    expect(optimum(inst, 'zeroOne')).toBe(6);
  });

  it('predict instances satisfy their constraints and are reproducible', () => {
    expect(predictInstance(5)).toEqual(predictInstance(5));
    expect(predictInstance(5).items).toHaveLength(4);
  });
});

describe('notation', () => {
  const env = (dp: number[][]) => ({
    i: 2,
    j: 5,
    n: 2,
    W: 5,
    w: [2, 3],
    v: [3, 4],
    read: (idx: number[]) => ({ v: dp[idx[0]][idx[1]], items: null }),
  });
  const table = [
    [0, 0, 0, 0, 0, 0],
    [0, 0, 3, 3, 3, 3],
  ];

  it('evaluates the 0/1 transition', () => {
    const node = parse('dp[i][j] = max(dp[i-1][j], dp[i-1][j-w[i]] + v[i])', 2);
    expect(evaluate(node, env(table)).v).toBe(7);
  });

  it('supports if/then/else, ternaries and unicode operators', () => {
    expect(evaluate(parse('if j ≥ w[i] then 1 else 2', 2), env(table)).v).toBe(1);
    expect(evaluate(parse('j < w[i] ? 1 : 2', 2), env(table)).v).toBe(2);
    expect(evaluate(parse('-INF + 3', 2), env(table)).v).toBe(-Infinity);
  });

  it('tracks which items built a value', () => {
    const node = parse('dp[i-1][j-w[i]] + v[i]', 2);
    const e = { ...env(table), read: () => ({ v: 3, items: [1, 0] }) };
    expect(evaluate(node, e).items).toEqual([1, 1]);
  });

  it('gives readable parse errors', () => {
    const msg = (src: string, dims: 1 | 2 = 2) => {
      try {
        parse(src, dims);
      } catch (e) {
        return (e as NotationError).message;
      }
      return 'no error';
    };
    expect(msg('max(dp[i-1][j], dp[i-1][j-w[i]] + v[i]')).toMatch(/Expected “\)”/);
    expect(msg('dp[j]')).toMatch(/two indices/);
    expect(msg('dp[i][j]', 1)).toMatch(/one index/);
    expect(msg('max(cap, 1)')).toMatch(/capacity is W/);
    expect(msg('j = w[i] ? 1 : 0')).toMatch(/==/);
    expect(msg('max(dp[i-1][j])')).toMatch(/at least two/);
    expect(msg('')).toMatch(/empty/);
  });
});

const instances = checkInstances(120);
const order2: Order = { dims: 2, outer: 'i', iDir: 'up', jDir: 'up' };
const spec = (src: string, dims: 1 | 2, order: Order): Spec => ({ dims, base: 'zeros', transition: { kind: 'formula', node: parse(src, dims) }, order });

describe('Write checking', () => {
  const zo2d = { kind: 'zeroOne' as Kind, dims: 2 as const, answer: 'nW' as const };
  const zo1d = { kind: 'zeroOne' as Kind, dims: 1 as const, answer: 'W' as const };
  const comp = { kind: 'complete' as Kind, dims: 1 as const, answer: 'W' as const };
  const ok2d = 'if j >= w[i] then max(dp[i-1][j], dp[i-1][j-w[i]] + v[i]) else dp[i-1][j]';

  it('accepts the correct 2D transition in several valid orders', () => {
    for (const order of [order2, { ...order2, jDir: 'down' }, { ...order2, outer: 'j' }] as Order[]) {
      const r = checkWrite(zo2d, spec(ok2d, 2, order), instances);
      expect(r.first).toBeNull();
      expect(r.passed).toBe(r.total);
    }
  });

  it('rejects reading the current row and traces it', () => {
    const r = checkWrite(zo2d, spec('if j >= w[i] then max(dp[i-1][j], dp[i][j-w[i]] + v[i]) else dp[i-1][j]', 2, order2), instances);
    expect(r.first?.diag.code).toBe('CURRENT_ROW');
    expect(r.first!.chain.length).toBeGreaterThan(0);
  });

  it('blames the current-row read, not the order, when a right-to-left row hits an empty cell', () => {
    const r = checkWrite(zo2d, spec('if j >= w[i] then max(dp[i-1][j], dp[i][j-w[i]] + v[i]) else dp[i-1][j]', 2, { ...order2, jDir: 'down' }), instances);
    expect(r.first?.diag.code).toBe('CURRENT_ROW');
    expect(r.first?.diag.slot).toBe('transition');
  });

  it('reports a missing guard as a negative capacity', () => {
    const r = checkWrite(zo2d, spec('max(dp[i-1][j], dp[i-1][j-w[i]] + v[i])', 2, order2), instances);
    expect(r.first?.diag.code).toBe('NEG_CAPACITY');
  });

  it('reports a backward row order as read-before-write', () => {
    const r = checkWrite(zo2d, spec(ok2d, 2, { ...order2, iDir: 'down' }), instances);
    expect(r.first?.diag.code).toBe('READ_BEFORE_WRITE');
  });

  it('flags always-take and no-subtract transitions', () => {
    expect(checkWrite(zo2d, spec('if j >= w[i] then dp[i-1][j-w[i]] + v[i] else dp[i-1][j]', 2, order2), instances).first?.diag.code).toBe('ALWAYS_TAKE');
    expect(checkWrite(zo2d, spec('if j >= w[i] then max(dp[i-1][j], dp[i-1][j] + v[i]) else dp[i-1][j]', 2, order2), instances).first?.diag.code).toBe(
      'NO_WEIGHT_SUBTRACT',
    );
  });

  it('one array: backward passes, forward reuses an item', () => {
    const f = 'max(dp[j], dp[j-w[i]] + v[i])';
    expect(checkWrite(zo1d, spec(f, 1, { dims: 1, jDir: 'down', jFrom: 'w' }), instances).first).toBeNull();
    const fwd = checkWrite(zo1d, spec(f, 1, { dims: 1, jDir: 'up', jFrom: 'w' }), instances);
    expect(fwd.first?.diag.code).toBe('LOOP_FORWARD_01');
    expect(fwd.first?.diag.message).toMatch(/used twice/);
    const zero = checkWrite(zo1d, spec(f, 1, { dims: 1, jDir: 'down', jFrom: 'zero' }), instances);
    expect(zero.first?.diag.code).toBe('NEG_CAPACITY');
    const guarded = 'if j >= w[i] then max(dp[j], dp[j-w[i]] + v[i]) else dp[j]';
    expect(checkWrite(zo1d, spec(guarded, 1, { dims: 1, jDir: 'down', jFrom: 'zero' }), instances).first).toBeNull();
  });

  it('complete knapsack: forward passes, backward cannot reuse', () => {
    const f = 'max(dp[j], dp[j-w[i]] + v[i])';
    expect(checkWrite(comp, spec(f, 1, { dims: 1, jDir: 'up', jFrom: 'w' }), instances).first).toBeNull();
    expect(checkWrite(comp, spec(f, 1, { dims: 1, jDir: 'down', jFrom: 'w' }), instances).first?.diag.code).toBe('LOOP_BACKWARD_COMPLETE');
  });

  it('shows a small counterexample first', () => {
    const r = checkWrite(zo1d, spec('max(dp[j], dp[j-w[i]] + v[i])', 1, { dims: 1, jDir: 'up', jFrom: 'w' }), instances);
    const inst = r.first!.run.inst;
    expect(inst.items.length + inst.W).toBeLessThanOrEqual(6);
  });
});

describe('Build cards', () => {
  const zo = BUILD_PROBLEMS.zo2d;
  const good: Placement = { state: 's-atmost', base: 'b-zeros', transition: 't-ok', order: 'o-iup-jup', answer: 'a-nW' };
  const verdict = (p: Placement, prob = zo) => {
    const r = evaluateCard(prob, p);
    if (r.status !== 'checked') return r.status;
    return r.verdict ? `${r.verdict.slot}:${r.verdict.code}` : 'pass';
  };

  it('passes the standard card and its valid alternatives', () => {
    expect(verdict(good)).toBe('pass');
    expect(verdict({ ...good, order: 'o-iup-jdown' })).toBe('pass');
    expect(verdict({ ...good, order: 'o-jouter' })).toBe('pass');
    expect(verdict({ ...good, answer: 'a-max' })).toBe('pass');
    expect(verdict({ ...good, state: 's-exact', base: 'b-exact', answer: 'a-max' })).toBe('pass');
  });

  it('names the faulty slot for each distractor', () => {
    expect(verdict({ ...good, state: 's-vague' })).toBe('state:STATE_VAGUE');
    expect(verdict({ ...good, state: 's-exact' })).toBe('base:BASE_MISFIT');
    expect(verdict({ ...good, base: 'b-exact' })).toBe('base:BASE_MISFIT');
    expect(verdict({ ...good, base: 'b-col0' })).toBe('base:UNSET_BASE');
    expect(verdict({ ...good, transition: 't-cur' })).toBe('transition:CURRENT_ROW');
    // The video script's card: current-row transition with a right-to-left order.
    expect(verdict({ ...good, transition: 't-cur', order: 'o-iup-jdown' })).toBe('transition:CURRENT_ROW');
    expect(verdict({ ...good, transition: 't-noguard' })).toBe('transition:NEG_CAPACITY');
    expect(verdict({ ...good, transition: 't-greedy' })).toBe('transition:GREEDY_RATIO');
    expect(verdict({ ...good, order: 'o-idown' })).toBe('order:READ_BEFORE_WRITE');
    expect(verdict({ ...good, answer: 'a-swap' })).toBe('answer:INDEX_RANGE');
    expect(verdict({ ...good, state: 's-exact', base: 'b-exact' })).toBe('answer:ANSWER_LOCATION');
    expect(verdict({ ...good, state: 's-repeat', transition: 't-cur' })).toBe('state:STATE_KIND');
    expect(verdict({ ...good, state: 's-repeat' })).toBe('state:STATE_KIND');
  });

  it('checks slot types and completeness first', () => {
    expect(verdict({ ...good, answer: undefined })).toBe('incomplete');
    expect(verdict({ ...good, base: 't-ok', transition: 'b-zeros' })).toBe('misplaced');
  });

  it('complete knapsack card', () => {
    const c = BUILD_PROBLEMS.complete;
    const ok: Placement = { state: 'c-s-ok', base: 'c-b-zeros', transition: 'c-t-ok', order: 'c-o-up', answer: 'c-a-W' };
    expect(verdict(ok, c)).toBe('pass');
    expect(verdict({ ...ok, answer: 'c-a-max' }, c)).toBe('pass');
    expect(verdict({ ...ok, order: 'c-o-down' }, c)).toBe('order:LOOP_BACKWARD_COMPLETE');
    expect(verdict({ ...ok, order: 'c-o-zero' }, c)).toBe('order:NEG_CAPACITY');
    expect(verdict({ ...ok, state: 'c-s-once', order: 'c-o-down' }, c)).toBe('state:STATE_KIND');
    expect(verdict({ ...ok, state: 'c-s-once' }, c)).toBe('state:STATE_KIND');
    expect(verdict({ ...ok, base: 'c-b-dp0' }, c)).toBe('base:UNSET_BASE');
    expect(verdict({ ...ok, base: 'c-b-exact' }, c)).toBe('base:BASE_MISFIT');
    expect(verdict({ ...ok, transition: 'c-t-take' }, c)).toBe('transition:ALWAYS_TAKE');
    expect(verdict({ ...ok, transition: 'c-t-left' }, c)).toBe('transition:NEIGHBOR_COPY');
    expect(verdict({ ...ok, answer: 'c-a-n' }, c)).toMatch(/^answer:/);
  });
});

describe('Predict feedback', () => {
  const inst = { items: [{ w: 2, v: 3 }, { w: 3, v: 4 }, { w: 4, v: 5 }, { w: 5, v: 6 }], W: 5 };
  const t = truthTable(inst, 'zeroOne', 'atMost');
  const ctx = (i: number, j: number) => ({ view: '2d' as const, inst, t, i, j });

  it('classifies common wrong values', () => {
    expect(classifyValue(ctx(2, 5), 7)).toBeNull();
    expect(classifyValue(ctx(2, 5), 3)?.code).toBe('MISSING_TAKE');
    expect(classifyValue(ctx(2, 4), 7)?.code).toBe("NO_WEIGHT_SUBTRACT");
    expect(classifyValue(ctx(2, 2), 7)?.code).toBe('NEG_CAPACITY');
    expect(classifyValue(ctx(3, 5), 5)?.code).toBe('ALWAYS_TAKE');
  });

  it('explains a current-row click even when the value happens to match', () => {
    // The proposal's Figure 1 caption: dp[2][2] + 4 = 7 too, but the reasoning is wrong.
    const v = classifyDeps(ctx(2, 5), [
      [1, 5],
      [2, 2],
    ]);
    expect(v.ok).toBe(false);
    expect(v.feedback?.code).toBe('CURRENT_ROW');
    expect(
      classifyDeps(ctx(2, 5), [
        [1, 5],
        [1, 2],
      ]).ok,
    ).toBe(true);
  });
});
