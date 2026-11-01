// Learner progress, kept in this browser only. No account, no server.

import { useEffect, useState } from 'preact/hooks';
import { hashString } from './rng';

export type StepId =
  | 'pre'
  | 'p1-watch'
  | 'p1-predict'
  | 'p2-predict'
  | 'p1-build'
  | 'p1-explain'
  | 'p1-write'
  | 'p2-write'
  | 'p3-build'
  | 'p3-write'
  | 'reflect'
  | 'post';

export type Mode = 'Test' | 'Watch' | 'Predict' | 'Build' | 'Write' | 'Explain' | 'Reflect';

export interface StepInfo {
  id: StepId;
  phase: 'before' | 'in' | 'after' | 'later';
  mode: Mode;
  problem: string;
  title: string;
  minutes: number;
  route: string;
  blurb: string;
}

export const PROBLEM_NAMES = {
  p1: '0/1 knapsack · table',
  p2: '0/1 knapsack · one array',
  p3: 'Complete knapsack · one array',
};

export const STEPS: StepInfo[] = [
  { id: 'pre', phase: 'before', mode: 'Test', problem: 'Unit Check', title: 'Pretest', minutes: 20, route: '#/check/pre', blurb: 'A short test before the unit. No feedback. A high Trace score lets you skip Watch.' },
  { id: 'p1-watch', phase: 'before', mode: 'Watch', problem: PROBLEM_NAMES.p1, title: 'Watch a worked example', minutes: 10, route: '#/watch', blurb: 'The table fills one cell at a time. Pause and explain each kind of step.' },
  { id: 'p1-predict', phase: 'in', mode: 'Predict', problem: PROBLEM_NAMES.p1, title: 'Predict cells', minutes: 25, route: '#/predict/table', blurb: 'Type the value of a paused cell and click the cells it depends on. In class: in pairs.' },
  { id: 'p2-predict', phase: 'in', mode: 'Predict', problem: PROBLEM_NAMES.p2, title: 'Predict in one array', minutes: 15, route: '#/predict/array', blurb: 'Same problem, one array. Then run the loop forward and catch the double count.' },
  { id: 'p1-build', phase: 'in', mode: 'Build', problem: PROBLEM_NAMES.p1, title: 'Build the spec card', minutes: 25, route: '#/build/table', blurb: 'Assemble the five slots from shuffled blocks. Some blocks are traps.' },
  { id: 'p1-explain', phase: 'in', mode: 'Explain', problem: PROBLEM_NAMES.p1, title: 'Explain your spec card', minutes: 10, route: '#/explain', blurb: 'One sentence per slot, in your own words. Then compare with the reference card.' },
  { id: 'p1-write', phase: 'after', mode: 'Write', problem: PROBLEM_NAMES.p1, title: 'Write the transition', minutes: 10, route: '#/write/table', blurb: 'Type the recurrence and pick the loop order. It runs on 206 tables.' },
  { id: 'p2-write', phase: 'after', mode: 'Write', problem: PROBLEM_NAMES.p2, title: 'Write the one-array version', minutes: 8, route: '#/write/array', blurb: 'Type dp[j] = … and choose the direction of the loop.' },
  { id: 'p3-build', phase: 'after', mode: 'Build', problem: PROBLEM_NAMES.p3, title: 'Build the complete knapsack', minutes: 8, route: '#/build/complete', blurb: 'Now items can repeat. Which slots change?' },
  { id: 'p3-write', phase: 'after', mode: 'Write', problem: PROBLEM_NAMES.p3, title: 'Write the complete knapsack', minutes: 8, route: '#/write/complete', blurb: 'One array, items can repeat. Pick the loop direction.' },
  { id: 'reflect', phase: 'after', mode: 'Reflect', problem: 'Whole unit', title: 'Reflect on your hardest slot', minutes: 5, route: '#/reflect', blurb: 'See your own error record, then write three sentences about the slot you missed most.' },
  { id: 'post', phase: 'later', mode: 'Test', problem: 'Unit Check', title: 'Posttest', minutes: 20, route: '#/check/post', blurb: 'The parallel form of the Unit Check. No feedback.' },
];

/** How much support each mode gives, for the fading display (4 = most). */
export const SUPPORT: Partial<Record<Mode, number>> = { Watch: 4, Predict: 3, Build: 2, Write: 1 };

export const PHASES: { id: StepInfo['phase']; title: string; note: string }[] = [
  { id: 'before', title: 'Before class', note: 'About 30 minutes at home.' },
  { id: 'in', title: 'In class', note: 'The live 90-minute session. Reviewers: work through these alone; the explanations stand in for your partner.' },
  { id: 'after', title: 'After class', note: 'About 60 minutes of homework.' },
  { id: 'later', title: 'Later', note: 'After the unit, without feedback.' },
];

export interface TestRecord {
  form: 'A' | 'B';
  traceScore: number;
  debugLine: boolean;
  submittedAt: number;
}

export interface AppState {
  nickname: string;
  sessionId: string;
  /** Reviewers (classmates, TAs) can open every step without the mastery gates. */
  reviewer: boolean;
  theme: 'auto' | 'light' | 'dark';
  done: Partial<Record<StepId, boolean>>;
  watchSkipped: boolean;
  tests: { pre?: TestRecord; post?: TestRecord };
}

const KEY = 'dplens.state.v1';

function fresh(): AppState {
  return {
    nickname: '',
    sessionId: Math.random().toString(36).slice(2, 10),
    reviewer: false,
    theme: 'auto',
    done: {},
    watchSkipped: false,
    tests: {},
  };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...JSON.parse(raw) };
  } catch {
    // Private windows can block storage; the app still works for this visit.
  }
  return fresh();
}

let state = load();
const listeners = new Set<() => void>();

export function getState(): AppState {
  return state;
}

export function setState(patch: Partial<AppState>): void {
  state = { ...state, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // See load().
  }
  listeners.forEach((l) => l());
}

export function markDone(id: StepId): void {
  if (!state.done[id]) setState({ done: { ...state.done, [id]: true } });
}

/** Clears progress only; the nickname, theme and reviewer pass are viewing settings and stay. */
export function resetProgress(): void {
  setState({ ...fresh(), nickname: state.nickname, theme: state.theme, reviewer: state.reviewer });
}

export function useAppState(): AppState {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return state;
}

export function isUnlocked(s: AppState, id: StepId): boolean {
  if (s.reviewer) return true;
  const k = STEPS.findIndex((x) => x.id === id);
  return k <= 0 || !!s.done[STEPS[k - 1].id];
}

export function nextStep(id: StepId): StepInfo | null {
  const k = STEPS.findIndex((x) => x.id === id);
  return STEPS[k + 1] ?? null;
}

/** Pretest and posttest use opposite forms, counterbalanced by nickname. */
export function formFor(s: AppState, phase: 'pre' | 'post'): 'A' | 'B' {
  const preForm = hashString(s.nickname.toLowerCase() || s.sessionId) % 2 === 0 ? 'A' : 'B';
  if (phase === 'pre') return preForm;
  return preForm === 'A' ? 'B' : 'A';
}

/** A stable seed per learner, so the same nickname sees the same generated tables. */
export function learnerSeed(s: AppState, salt: string): number {
  return hashString(`${s.nickname.toLowerCase() || s.sessionId}:${salt}`);
}
