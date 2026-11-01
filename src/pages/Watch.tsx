// Watch: an animated worked example. The table fills one learner-paced cell at a time
// (segmenting), the cells each step reads are highlighted with arrows (signaling), each
// step is labeled with its spec-card slot (subgoal labels), and the animation pauses for
// self-explanation questions.

import { useEffect, useState } from 'preact/hooks';
import { DesignNote } from '../components/DesignNote';
import { DPTable, type Arrow, type Tone } from '../components/DPTable';
import { EffortRating } from '../components/EffortRating';
import { QuestionCard } from '../components/QuestionCard';
import { ItemList, SpecCard, type SlotStatus } from '../components/SpecCard';
import { Badge, Callout, PageHead, Rich } from '../components/ui';
import { SLOT_LABEL, type Slot } from '../lib/codes';
import { type Question, SPEC_TEXT, WATCH_INSTANCE, WATCH_QUESTIONS, bestPacking } from '../lib/content';
import { truthTable } from '../lib/knapsack';
import { logEvent } from '../lib/log';
import { getState, markDone, nextStep, setState, useAppState } from '../lib/store';
import { explainCell, formulaCell } from '../lib/tutor';

type WStep = { kind: 'intro' } | { kind: 'base' } | { kind: 'cell'; i: number; j: number } | { kind: 'answer' } | { kind: 'prompt'; q: Question };

const inst = WATCH_INSTANCE;
const t = truthTable(inst, 'zeroOne', 'atMost');
const n = inst.items.length;
const W = inst.W;

function buildSteps(): WStep[] {
  const out: WStep[] = [{ kind: 'intro' }, { kind: 'base' }, { kind: 'prompt', q: WATCH_QUESTIONS.base }];
  for (let i = 1; i <= n; i++) {
    for (let j = 0; j <= W; j++) {
      out.push({ kind: 'cell', i, j });
      if (i === 1 && j === 1) out.push({ kind: 'prompt', q: WATCH_QUESTIONS.nofit });
      if (i === 2 && j === 5) out.push({ kind: 'prompt', q: WATCH_QUESTIONS.rowAbove });
      if (i === 3 && j === 5) out.push({ kind: 'prompt', q: WATCH_QUESTIONS.skipWins });
    }
  }
  out.push({ kind: 'prompt', q: WATCH_QUESTIONS.order }, { kind: 'answer' }, { kind: 'prompt', q: WATCH_QUESTIONS.answer });
  return out;
}

const STEPS = buildSteps();
const CELL_STEP = new Map<string, number>();
STEPS.forEach((s, k) => s.kind === 'cell' && CELL_STEP.set(`${s.i},${s.j}`, k));
const BASE_STEP = 1;
const SPEEDS = { slow: 2600, normal: 1700, fast: 900 };

function slotsOf(s: WStep): Slot[] {
  if (s.kind === 'intro') return ['state'];
  if (s.kind === 'base') return ['base'];
  if (s.kind === 'cell') return s.j === 0 ? ['transition', 'order'] : ['transition'];
  if (s.kind === 'answer') return ['answer'];
  return [s.q.slot];
}

export function Watch() {
  const app = useAppState();
  const [k, setK] = useState(0);
  const [answered, setAnswered] = useState<Set<number>>(() => new Set());
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<keyof typeof SPEEDS>('normal');
  const [startedAt] = useState(() => Date.now());

  const step = STEPS[k];
  const blocked = step.kind === 'prompt' && !answered.has(k);
  const last = k === STEPS.length - 1;
  let vk = k;
  while (STEPS[vk].kind === 'prompt') vk--;
  const vis = STEPS[vk];

  const next = () => setK((x) => Math.min(x + 1, STEPS.length - 1));
  const back = () => setK((x) => Math.max(x - 1, 0));

  useEffect(() => {
    if (!playing) return;
    if (blocked || last) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(next, SPEEDS[speed]);
    return () => clearTimeout(id);
  }, [playing, k, blocked, last, speed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight' && !blocked) next();
      if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [blocked]);

  const filled = (i: number, j: number) => (i === 0 ? vk >= BASE_STEP : (CELL_STEP.get(`${i},${j}`) ?? Infinity) <= vk);

  const tones = (i: number, j: number): Tone[] => {
    if (vis.kind === 'base' && i === 0) return ['new'];
    if (vis.kind === 'answer' && i === n && j === W) return ['answer'];
    if (vis.kind !== 'cell') return [];
    if (i === vis.i && j === vis.j) return ['target', 'new'];
    const { w } = inst.items[vis.i - 1];
    if (i === vis.i - 1 && j === vis.j) return ['skip'];
    if (i === vis.i - 1 && j === vis.j - w) return ['take'];
    return [];
  };

  const arrows: Arrow[] = [];
  if (vis.kind === 'cell') {
    const { w, v } = inst.items[vis.i - 1];
    arrows.push({ from: [vis.i - 1, vis.j], to: [vis.i, vis.j], kind: 'skip', label: 'skip' });
    if (w <= vis.j) arrows.push({ from: [vis.i - 1, vis.j - w], to: [vis.i, vis.j], kind: 'take', label: `take +${v}` });
  }

  const status: Partial<Record<Slot, SlotStatus>> = {};
  for (const s of slotsOf(step)) status[s] = 'active';

  const finish = () => {
    markDone('p1-watch');
    logEvent('step_done', 'p1-watch', { seconds: Math.round((Date.now() - startedAt) / 1000) });
    location.hash = nextStep('p1-watch')!.route;
  };

  const placement = app.tests.pre && app.tests.pre.traceScore >= 3 && !app.done['p1-watch'];
  const packing = bestPacking(inst, t);

  return (
    <div class="page">
      <PageHead kicker="0/1 knapsack · table · Watch" title="Watch a worked example">
        The table fills one cell at a time. Each step is labeled with the slot of the spec card it uses. Go at your own pace.
      </PageHead>
      <DesignNote id="watch" />
      {placement && (
        <Callout tone="info" title="Your pretest says you may skip this.">
          <p>You traced the pretest table well. You can go straight to Predict, or watch anyway.</p>
          <button
            class="btn"
            onClick={() => {
              setState({ watchSkipped: true });
              markDone('p1-watch');
              logEvent('step_done', 'p1-watch', { skipped: true });
              location.hash = '#/predict/table';
            }}
          >
            Skip to Predict
          </button>
        </Callout>
      )}
      <div class="mode-grid">
        <aside class="side">
          <SpecCard content={Object.fromEntries(Object.entries(SPEC_TEXT.table).map(([s, x]) => [s, <Rich text={x} />]))} status={status} />
          <ItemList inst={inst} active={vis.kind === 'cell' ? vis.i : null} />
        </aside>
        <section class="main">
          <div class="card">
            <DPTable
              inst={inst}
              title="Knapsack table for the worked example"
              value={(i, j) => (filled(i, j) ? String(t[i][j]) : null)}
              tones={tones}
              arrows={arrows}
              activeRow={vis.kind === 'cell' ? vis.i : null}
            />
          </div>
          <div class="card panel" aria-live="polite">
            <div class="panel-head">
              <div class="badges">
                {slotsOf(step).map((s) => (
                  <Badge key={s} tone="accent">
                    {SLOT_LABEL[s]}
                  </Badge>
                ))}
              </div>
              <span class="muted small">
                Step {k + 1} of {STEPS.length}
              </span>
            </div>
            {step.kind === 'intro' && (
              <div class="step-text">
                <p>
                  Four items and a knapsack of capacity W = 5. Each item can be packed at most once. Goal: the largest total value with total weight at most 5.
                </p>
                <p>
                  We fill a table <code>dp[i][j]</code>. What one cell means is the <b>state</b> on the spec card: the best value using only items 1..i, with weight at most j.
                </p>
                <p class="muted small">Use Next (or the → key), or press Play. The animation stops at each question.</p>
              </div>
            )}
            {step.kind === 'base' && (
              <div class="step-text">
                <p>
                  Row 0 means “no items”. With no items the best value is 0, whatever the capacity. So the whole row is 0.
                </p>
              </div>
            )}
            {step.kind === 'cell' && (
              <div class="step-text">
                {step.j === 0 && (
                  <p class="note">
                    New row: item {step.i}. Row {step.i} reads only row {step.i - 1}, which is complete. That is why we fill row by row.
                  </p>
                )}
                <p>{explainCell({ view: '2d', inst, t, i: step.i, j: step.j })}</p>
                <p class="formula">{formulaCell({ view: '2d', inst, t, i: step.i, j: step.j })}</p>
              </div>
            )}
            {step.kind === 'answer' && (
              <div class="step-text">
                <p>
                  <code>
                    dp[{n}][{W}] = {t[n][W]}
                  </code>{' '}
                  means: all {n} items allowed, weight at most {W}. That is the whole problem, so it is the answer.
                </p>
                <p>
                  The best packing is item{packing.length > 1 ? 's' : ''} {packing.join(' and ')}: weight {packing.reduce((a, i) => a + inst.items[i - 1].w, 0)}, value {t[n][W]}.
                </p>
              </div>
            )}
            {step.kind === 'prompt' && (
              <QuestionCard
                key={k}
                q={step.q}
                step="p1-watch"
                onDone={() => {
                  setAnswered((a) => new Set(a).add(k));
                  if (!last) next();
                }}
              />
            )}
            <div class="controls">
              <button class="btn" onClick={back} disabled={k === 0}>
                ← Back
              </button>
              <button class="btn btn-primary" onClick={next} disabled={blocked || last}>
                Next →
              </button>
              <button class="btn" onClick={() => setPlaying((p) => !p)} disabled={blocked || last} aria-pressed={playing}>
                {playing ? 'Pause' : 'Play'}
              </button>
              <label class="inline-field">
                <span>Speed</span>
                <select value={speed} onChange={(e) => setSpeed((e.target as HTMLSelectElement).value as keyof typeof SPEEDS)}>
                  <option value="slow">slow</option>
                  <option value="normal">normal</option>
                  <option value="fast">fast</option>
                </select>
              </label>
              {last && !blocked && <EffortRating step="p1-watch" />}
              {last && !blocked && (
                <button class="btn btn-primary push-right" onClick={finish}>
                  {getState().done['p1-watch'] ? 'Go to Predict →' : 'Finish Watch → Predict'}
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
