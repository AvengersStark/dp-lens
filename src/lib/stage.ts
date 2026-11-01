// Which parts of the unit this version opens. The project is presented in stages that
// follow the proposal's timeline: Milestone 1 opens Watch and Predict, Milestone 2 the
// other modes and the learning experience, Milestone 3 the complete knapsack, the
// Unit Check and the teacher view. Raise STAGE at each milestone, then `npm run deploy`.
// `VITE_STAGE=4 npm run dev` opens everything locally.

import type { StepId } from './store';

export const STAGE: number = Number(import.meta.env.VITE_STAGE) || 1;

/** The first stage in which each step is open. */
const OPENS_IN: Record<StepId, number> = {
  pre: 3,
  'p1-watch': 1,
  'p1-predict': 1,
  'p2-predict': 2,
  'p1-build': 2,
  'p1-explain': 2,
  'p1-write': 2,
  'p2-write': 2,
  'p3-build': 3,
  'p3-write': 3,
  reflect: 2,
  post: 3,
};

export const PAGE_OPENS_IN = { lesson: 2, teacher: 3, fruitFeast: 2 } as const;

export function opensIn(id: StepId): number {
  return OPENS_IN[id];
}

export function isReleased(id: StepId, stage = STAGE): boolean {
  return OPENS_IN[id] <= stage;
}

export function pageReleased(page: keyof typeof PAGE_OPENS_IN, stage = STAGE): boolean {
  return PAGE_OPENS_IN[page] <= stage;
}

export function stageLabel(stage = STAGE): string {
  return stage >= 4 ? 'Final version' : `Milestone ${stage} version`;
}
