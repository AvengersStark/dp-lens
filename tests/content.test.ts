import { describe, expect, it } from 'vitest';
import { PREDICT_ARRAY_FIRST, PREDICT_TABLE_FIRST, WATCH_INSTANCE, WATCH_QUESTIONS, bestPacking, chooseTargets, isMastered } from '../src/lib/content';
import { maxCount, predictInstance, truthTable } from '../src/lib/knapsack';
import { parse } from '../src/lib/notation';
import { mulberry32 } from '../src/lib/rng';
import { run } from '../src/lib/runner';
import { FORMS, emptyAnswers, scoreAuto } from '../src/lib/unitcheck';

describe('lesson content', () => {
  it('every Predict table offers a take cell, so mastery is reachable', () => {
    for (let s = 0; s < 30; s++) {
      for (const [view, inst] of [
        ['2d', s === 0 ? PREDICT_TABLE_FIRST : predictInstance(s)],
        ['1d', s === 0 ? PREDICT_ARRAY_FIRST : predictInstance(s + 100)],
      ] as const) {
        const t = truthTable(inst, 'zeroOne', 'atMost');
        const targets = chooseTargets(view, inst, t, mulberry32(s));
        expect(targets.filter((x) => x.kind === 'take').length).toBeGreaterThanOrEqual(2);
        expect(targets.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('mastery needs three clean cells in a row, one of them a take', () => {
    expect(isMastered([{ clean: true, kind: 'skip' }, { clean: true, kind: 'take' }, { clean: true, kind: 'nofit' }])).toBe(true);
    expect(isMastered([{ clean: true, kind: 'skip' }, { clean: true, kind: 'skip' }, { clean: true, kind: 'tie' }])).toBe(false);
    expect(isMastered([{ clean: true, kind: 'take' }, { clean: false, kind: 'take' }, { clean: true, kind: 'take' }])).toBe(false);
  });

  it('the Watch questions match the worked example they describe', () => {
    const t = truthTable(WATCH_INSTANCE, 'zeroOne', 'atMost');
    expect(t[3][5]).toBe(7); // "dp[3][5] stayed 7"
    expect(t[3][4]).toBe(5); // "dp[3][4] = 5 ... taking item 3 won"
    expect(t[2][2] + 4).toBe(7); // "dp[2][2] + 4 is also 7"
    expect(bestPacking(WATCH_INSTANCE, t)).toEqual([1, 2]);
    for (const q of Object.values(WATCH_QUESTIONS)) expect(q.options.filter((o) => o.correct)).toHaveLength(1);
  });

  it('the forward-loop experiment double counts first at dp[4]', () => {
    const t = truthTable(PREDICT_ARRAY_FIRST, 'zeroOne', 'atMost');
    const spec = { dims: 1 as const, base: 'zeros' as const, transition: { kind: 'formula' as const, node: parse('max(dp[j], dp[j-w[i]] + v[i])', 1) }, order: { dims: 1 as const, jDir: 'up' as const, jFrom: 'w' as const } };
    const first = run(PREDICT_ARRAY_FIRST, spec, 'zeroOne', t).writes.find((w) => !w.base && maxCount(w.items) > 1);
    expect(first?.j).toBe(4);
  });

  it('scores the Unit Check trace part', () => {
    for (const form of Object.values(FORMS)) {
      const t = truthTable(form.trace.inst, 'zeroOne', 'atMost');
      const a = emptyAnswers();
      a.trace = form.trace.cells.map(([i, j]) => String(t[i][j]));
      a.debugLine = form.debug.bugLine;
      expect(scoreAuto(form, a)).toEqual({ trace: 4, debugLine: true });
      expect(scoreAuto(form, emptyAnswers()).trace).toBe(0);
    }
  });
});
