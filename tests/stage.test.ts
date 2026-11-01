import { describe, expect, it } from 'vitest';
import { isReleased } from '../src/lib/stage';
import { type AppState, STEPS, isUnlocked, nextStep } from '../src/lib/store';

const learner = (done: AppState['done'] = {}, reviewer = false): AppState => ({
  nickname: 'demo',
  sessionId: 'test',
  reviewer,
  theme: 'auto',
  done,
  watchSkipped: false,
  tests: {},
});

describe('staged releases', () => {
  it('Milestone 1 opens Watch and Predict only', () => {
    expect(STEPS.filter((s) => isReleased(s.id, 1)).map((s) => s.id)).toEqual(['p1-watch', 'p1-predict']);
  });

  it('an unreleased step never blocks the steps after it', () => {
    // The pretest opens in Milestone 3, so in Milestone 1 Watch is the first open step.
    expect(isUnlocked(learner(), 'p1-watch', 1)).toBe(true);
    expect(isUnlocked(learner(), 'p1-predict', 1)).toBe(false);
    expect(isUnlocked(learner({ 'p1-watch': true }), 'p1-predict', 1)).toBe(true);
  });

  it('the reviewer pass opens released steps but not later ones', () => {
    expect(isUnlocked(learner({}, true), 'p1-predict', 1)).toBe(true);
    expect(isUnlocked(learner({}, true), 'p1-build', 1)).toBe(false);
    expect(isUnlocked(learner({}, true), 'p1-build', 2)).toBe(true);
  });

  it('the next step skips what is not released yet', () => {
    expect(nextStep('p1-predict', 1)).toBeNull();
    expect(nextStep('p1-predict', 2)?.id).toBe('p2-predict');
    expect(nextStep('p2-write', 2)?.id).toBe('reflect');
    expect(nextStep('p2-write', 3)?.id).toBe('p3-build');
  });

  it('the final version opens everything in path order', () => {
    expect(STEPS.every((s) => isReleased(s.id, 4))).toBe(true);
    for (let k = 0; k + 1 < STEPS.length; k++) expect(nextStep(STEPS[k].id, 4)?.id).toBe(STEPS[k + 1].id);
  });
});
