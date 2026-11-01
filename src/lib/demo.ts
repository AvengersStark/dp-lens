// Synthetic demo logs for the error board, so reviewers can see it with data in it.
// Every file is marked demo: true and every learner is named "Demo learner N".
// The numbers are invented and are not results.

import type { Code } from './codes';
import { WATCH_QUESTIONS } from './content';
import type { LogEvent, LogFile } from './log';
import { mulberry32, type Rng, randInt } from './rng';

function weighted<T>(rng: Rng, pairs: [T, number][]): T {
  const total = pairs.reduce((a, [, w]) => a + w, 0);
  let x = rng() * total;
  for (const [v, w] of pairs) {
    x -= w;
    if (x <= 0) return v;
  }
  return pairs[pairs.length - 1][0];
}

const PREDICT_ERRORS: [Code, number][] = [
  ['CURRENT_ROW', 9],
  ['MISSING_TAKE', 6],
  ['MISSING_DEP', 5],
  ['NO_WEIGHT_SUBTRACT', 4],
  ['NEG_CAPACITY', 4],
  ['ALWAYS_TAKE', 3],
  ['NEIGHBOR_COPY', 2],
  ['EXTRA_DEP', 2],
  ['OTHER', 3],
];
const BUILD_ERRORS: [Code, number][] = [
  ['BASE_MISFIT', 5],
  ['CURRENT_ROW', 4],
  ['READ_BEFORE_WRITE', 2],
  ['GREEDY_RATIO', 3],
  ['STATE_KIND', 3],
  ['ANSWER_LOCATION', 2],
  ['WRONG_SLOT', 2],
];
const WRITE_ERRORS: [Code, number][] = [
  ['NEG_CAPACITY', 5],
  ['CURRENT_ROW', 4],
  ['LOOP_FORWARD_01', 6],
  ['LOOP_BACKWARD_COMPLETE', 4],
  ['ALWAYS_TAKE', 1],
];

const OPEN = {
  explain1: ['the best value with items 1..i and weight at most j', 'max value for capacity j', 'the answer for j', 'best value using the first i items, total weight ≤ j'],
  explain2: [
    'so dp[j-w[i]] is still the old value and item i is used once',
    'otherwise item i is counted again',
    'because that is how the template goes',
    'going down keeps the previous row in the left part of the array',
  ],
};

export function demoLogs(count = 10): LogFile[] {
  const files: LogFile[] = [];
  for (let k = 1; k <= count; k++) {
    const rng = mulberry32(9000 + k);
    const skill = rng(); // 0 = struggling, 1 = strong
    let t = Date.UTC(2026, 10, 2, 1, 0, 0) + k * 60000;
    const events: LogEvent[] = [];
    const push = (type: LogEvent['type'], step: string, data: Record<string, unknown>, codes: Code[] = []) => {
      t += randInt(rng, 10, 90) * 1000;
      events.push({ t, type, step, codes, data });
    };
    const preForm = k % 2 ? 'A' : 'B';
    push('test_submit', 'pre', {
      phase: 'pre',
      form: preForm,
      auto: { trace: Math.min(4, Math.floor(skill * 4.5)), debugLine: rng() < skill },
      answers: { explain1: OPEN.explain1[randInt(rng, 0, 3)], explain2: OPEN.explain2[randInt(rng, 0, 3)] },
    });
    for (const q of Object.values(WATCH_QUESTIONS)) {
      const right = rng() < 0.45 + 0.5 * skill;
      const wrongs = q.options.map((o, i) => ({ o, i })).filter((x) => !x.o.correct);
      const pick = right ? q.options.findIndex((o) => o.correct) : wrongs[randInt(rng, 0, wrongs.length - 1)].i;
      push('self_explain', 'p1-watch', { qid: q.id, choice: pick, correct: right, firstTry: true }, right ? [] : [q.options[pick].code!]);
    }
    const submits = randInt(rng, 6, 12);
    for (let s = 0; s < submits; s++) {
      const correct = rng() < 0.4 + 0.5 * skill;
      push('predict_submit', 'p1-predict', { view: '2d', cell: [randInt(rng, 1, 4), randInt(rng, 1, 6)], correct, try: 1 }, correct ? [] : [weighted(rng, PREDICT_ERRORS)]);
    }
    push('predict_mastery', 'p1-predict', {});
    for (let r = randInt(rng, 1, 4); r > 0; r--) push('build_run', 'p1-build', { status: 'checked', pass: r === 1 }, r === 1 ? [] : [weighted(rng, BUILD_ERRORS)]);
    for (let r = randInt(rng, 1, 3); r > 0; r--) push('write_run', 'p1-write', { pass: r === 1 }, r === 1 ? [] : [weighted(rng, WRITE_ERRORS)]);
    const guessRight = rng() < 0.3 + 0.4 * skill;
    push('forward_predict', 'p2-predict', { guess: guessRight ? 4 : randInt(rng, 5, 6), answer: 4, correct: guessRight }, guessRight ? [] : ['LOOP_FORWARD_01']);
    for (let r = randInt(rng, 1, 3); r > 0; r--) push('write_run', 'p2-write', { pass: r === 1 }, r === 1 ? [] : [weighted(rng, WRITE_ERRORS)]);
    for (let r = randInt(rng, 1, 3); r > 0; r--) push('write_run', 'p3-write', { pass: r === 1 }, r === 1 ? [] : ['LOOP_BACKWARD_COMPLETE']);
    for (const step of ['p1-watch', 'p1-predict', 'p1-build', 'p1-write']) {
      const base = { 'p1-watch': 3, 'p1-predict': 5, 'p1-build': 6, 'p1-write': 7 }[step]!;
      push('effort', step, { rating: Math.max(1, Math.min(9, base + Math.round((0.5 - skill) * 3) + randInt(rng, -1, 1))) });
    }
    const slots = ['state', 'base', 'transition', 'order', 'answer'];
    push('articulate', 'p1-explain', {
      rating: Object.fromEntries(slots.map((s) => [s, rng() < 0.35 + 0.5 * skill ? 'same' : rng() < 0.6 ? 'partly' : 'missed'])),
    });
    push('reflection', 'reflect', { slot: weighted(rng, [['transition', 5], ['order', 4], ['state', 3], ['base', 1], ['answer', 1]]) });
    push('test_submit', 'post', {
      phase: 'post',
      form: preForm === 'A' ? 'B' : 'A',
      auto: { trace: Math.min(4, Math.floor(1 + skill * 3.6)), debugLine: rng() < 0.4 + 0.5 * skill },
      answers: { explain1: OPEN.explain1[randInt(rng, 0, 3)], explain2: OPEN.explain2[randInt(rng, 0, 3)] },
    });
    files.push({ app: 'dp-lens', version: 1, nickname: `Demo learner ${k}`, sessionId: `demo-${k}`, exportedAt: new Date(t).toISOString(), demo: true, events });
  }
  return files;
}
