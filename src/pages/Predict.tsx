// Predict: the table pauses on a cell. The learner types its value and clicks the cells
// it depends on, then gets feedback keyed to the specific error. Hints escalate from
// naming the slot to a worked step. Mastery: three cells in a row right on the first
// try, one of them a cell where taking the item wins.

import type { VNode } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { DesignNote } from '../components/DesignNote';
import { DPArray, type ArcArrow } from '../components/DPArray';
import { EffortRating } from '../components/EffortRating';
import { DPTable, type Arrow, type Tone } from '../components/DPTable';
import { QuestionCard } from '../components/QuestionCard';
import { ItemList, SpecCard } from '../components/SpecCard';
import { Callout, NextLink, PageHead, Rich, Term } from '../components/ui';
import {
  type Attempt,
  FORWARD_QUESTION,
  PREDICT_ARRAY_FIRST,
  PREDICT_TABLE_FIRST,
  SPEC_TEXT,
  type Target,
  chooseTargets,
  isMastered,
} from '../lib/content';
import { type Instance, formatItems, maxCount, predictInstance, truthTable } from '../lib/knapsack';
import { logEvent } from '../lib/log';
import { parse } from '../lib/notation';
import { mulberry32 } from '../lib/rng';
import { type Run, type Spec, run } from '../lib/runner';
import { learnerSeed, markDone, nextStep, useAppState } from '../lib/store';
import { type View, cellName, classifyDeps, classifyValue, explainCell, formulaCell, hint, sources } from '../lib/tutor';

type ViewKind = View;

const ONE_ARRAY = parse('max(dp[j], dp[j-w[i]] + v[i])', 1);
const arraySpec = (jDir: 'up' | 'down'): Spec => ({ dims: 1, base: 'zeros', transition: { kind: 'formula', node: ONE_ARRAY }, order: { dims: 1, jDir, jFrom: 'w' } });

/** The one-array state just before write `upto` (exclusive). */
function snapshot(r: Run, upto: number) {
  const W = r.inst.W;
  const val: (number | null)[] = Array(W + 1).fill(null);
  const items: (number[] | null)[] = Array(W + 1).fill(null);
  const pass: number[] = Array(W + 1).fill(-1);
  for (const wr of r.writes.slice(0, upto)) {
    val[wr.j] = wr.value;
    items[wr.j] = wr.items;
    pass[wr.j] = wr.pass;
  }
  return { val, items, pass };
}

export function Predict({ view }: { view: ViewKind }) {
  const app = useAppState();
  const stepId = view === '2d' ? 'p1-predict' : 'p2-predict';
  const [round, setRound] = useState(0);
  const [history, setHistory] = useState<Attempt[]>([]);
  const [mastered, setMastered] = useState(false);
  const [experimentDone, setExperimentDone] = useState(false);
  const alreadyDone = !!app.done[stepId];

  const inst = useMemo(
    () => (round === 0 ? (view === '2d' ? PREDICT_TABLE_FIRST : PREDICT_ARRAY_FIRST) : predictInstance(learnerSeed(app, `${stepId}-${round}`))),
    [round, view],
  );

  const record = (a: Attempt) => {
    const h = [...history, a];
    setHistory(h);
    if (!mastered && isMastered(h)) {
      setMastered(true);
      logEvent('predict_mastery', stepId, { cells: h.length });
      if (view === '2d') {
        markDone(stepId);
        logEvent('step_done', stepId, { cells: h.length });
      }
    }
  };

  const last3 = history.slice(-3);
  const next = nextStep(stepId);

  return (
    <div class="page">
      <PageHead kicker={`${view === '2d' ? '0/1 knapsack · table' : '0/1 knapsack · one array'} · Predict`} title={view === '2d' ? 'Predict cells' : 'Predict in one array'}>
        {view === '2d'
          ? 'The table stops at a cell. Type its value, then click the cells it depends on.'
          : 'The same 0/1 knapsack, stored in one array dp[0..W]. For each item, j runs from W down to w[i]. Predict the new dp[j].'}
      </PageHead>
      <p class="pair-rule">
        <b>In class:</b> work in pairs. One partner predicts; the other explains the reason before every Check; switch each cell. <b>Alone:</b> say your reason out loud before you
        click Check.
      </p>
      <DesignNote id={view === '2d' ? 'predict' : 'predictArray'} />


      {mastered && view === '2d' && (
        <Callout tone="good" title={next ? 'Mastery reached. The next step is unlocked.' : 'Mastery reached.'}>
          <p>You can keep practicing on new tables, or move on.</p>
          <EffortRating step={stepId} />
          <NextLink next={next} />
        </Callout>
      )}

      {view === '1d' && (mastered || alreadyDone) && (
        <ForwardExperiment
          done={experimentDone || alreadyDone}
          onDone={() => {
            setExperimentDone(true);
            markDone(stepId);
            logEvent('step_done', stepId, { cells: history.length });
          }}
        />
      )}
      {view === '1d' && (experimentDone || alreadyDone) && (
        <Callout tone="good" title="Step complete.">
          <EffortRating step={stepId} />
          <NextLink next={next} />
        </Callout>
      )}

      <PredictRound
        key={`${view}-${round}`}
        view={view}
        inst={inst}
        seed={learnerSeed(app, `${stepId}-targets-${round}`)}
        stepId={stepId}
        onResult={record}
        onNewTable={() => setRound((r) => r + 1)}
        streak={<Streak last3={last3} mastered={mastered || alreadyDone} />}
      />
    </div>
  );
}

function Streak({ last3, mastered }: { last3: Attempt[]; mastered: boolean }) {
  return (
    <div class="streak" aria-label="Mastery progress">
      <span class="streak-label">Last three cells</span>
      <span class="streak-dots">
        {[0, 1, 2].map((x) => {
          const a = last3[x];
          return <span key={x} class={`dot${a ? (a.clean ? ' dot-ok' : ' dot-miss') : ''}`} title={a ? (a.clean ? 'right on the first try' : 'needed help') : 'not yet'} />;
        })}
      </span>
      {mastered ? <span class="badge badge-good">Mastery reached</span> : <span class="small muted">Goal: three in a row right on the first try, one of them a “take” cell.</span>}
    </div>
  );
}

function PredictRound({
  view,
  inst,
  seed,
  stepId,
  onResult,
  onNewTable,
  streak,
}: {
  view: ViewKind;
  inst: Instance;
  seed: number;
  stepId: string;
  onResult: (a: Attempt) => void;
  onNewTable: () => void;
  streak: VNode;
}) {
  const t = useMemo(() => truthTable(inst, 'zeroOne', 'atMost'), [inst]);
  const targets = useMemo(() => chooseTargets(view, inst, t, mulberry32(seed)), [inst, t, view, seed]);
  const back = useMemo(() => (view === '1d' ? run(inst, arraySpec('down'), 'zeroOne', t) : null), [inst, t, view]);

  const [k, setK] = useState(0);
  const [value, setValue] = useState('');
  const [deps, setDeps] = useState<number[][]>([]);
  const [wrongTries, setWrongTries] = useState(0);
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2 | 3>(0);
  const [feedback, setFeedback] = useState<{ title: string; lines: string[] } | null>(null);
  const [solved, setSolved] = useState<null | { clean: boolean }>(null);

  const done = k >= targets.length;
  const target: Target | undefined = targets[k];
  const ctx = target ? { view, inst, t, i: target.i, j: target.j } : null;

  // Reset everything in the same update that moves on, so no render shows the new cell
  // with the previous cell's answer.
  const advance = () => {
    setK((x) => x + 1);
    setValue('');
    setDeps([]);
    setWrongTries(0);
    setHintLevel(0);
    setFeedback(null);
    setSolved(null);
  };

  const toggle = (cell: number[]) => {
    if (solved) return;
    setDeps((d) => (d.some((x) => x[0] === cell[0] && x[1] === cell[1]) ? d.filter((x) => !(x[0] === cell[0] && x[1] === cell[1])) : [...d, cell]));
  };
  const isSel = (cell: number[]) => deps.some((x) => x[0] === cell[0] && x[1] === cell[1]);

  const submit = () => {
    if (!ctx || !target || solved) return;
    const x = Number(value.trim());
    if (value.trim() === '' || !Number.isInteger(x)) {
      setFeedback({ title: 'Type a whole number first.', lines: [] });
      return;
    }
    if (deps.length === 0) {
      setFeedback({ title: 'Click the cells this value depends on.', lines: ['They light up when selected. Click again to unselect.'] });
      return;
    }
    const v = classifyValue(ctx, x);
    const d = classifyDeps(ctx, deps);
    const correct = !v && d.ok;
    const codes = [v?.code, d.feedback?.code].filter((c): c is NonNullable<typeof c> => !!c);
    logEvent(
      'predict_submit',
      stepId,
      { view, inst, cell: [target.i, target.j], kind: target.kind, value: x, expected: t[target.i][target.j], deps, correct, try: wrongTries + 1, hintLevel },
      codes,
    );
    if (correct) {
      const clean = wrongTries === 0 && hintLevel < 3;
      setSolved({ clean });
      setFeedback(null);
      onResult({ clean, kind: target.kind });
      return;
    }
    setWrongTries((w) => w + 1);
    if (v && d.feedback && v.code === d.feedback.code) {
      // The number and the clicks show the same misconception: say it once.
      setFeedback({ title: 'The value and the cells point to the same mistake.', lines: [d.feedback.message] });
      return;
    }
    const title = v && !d.ok ? 'Both the value and the cells need another look.' : v ? 'The cells are right, but the value is not.' : 'The value is right, but the cells are not.';
    setFeedback({ title, lines: [v?.message, d.feedback?.message].filter((s): s is string => !!s) });
  };

  const showHint = () => {
    if (!ctx || hintLevel >= 3) return;
    const lvl = (hintLevel + 1) as 1 | 2 | 3;
    setHintLevel(lvl);
    logEvent('predict_hint', stepId, { cell: [target!.i, target!.j], level: lvl });
  };

  // ---- what the table shows
  const before = (i: number, j: number) => !!target && (i < target.i || (i === target.i && j < target.j));
  let display: VNode;
  if (view === '2d') {
    const filled = (i: number, j: number) => i === 0 || done || before(i, j) || (!!solved && target!.i === i && target!.j === j);
    const src = target ? sources(inst, target.i, target.j) : null;
    const arrows: Arrow[] = [];
    if (solved && target && src) {
      arrows.push({ from: src.skip, to: [target.i, target.j], kind: 'skip', label: 'skip' });
      if (src.take) arrows.push({ from: src.take, to: [target.i, target.j], kind: 'take', label: `take +${inst.items[target.i - 1].v}` });
    }
    const tones = (i: number, j: number): Tone[] => {
      const out: Tone[] = [];
      if (target && i === target.i && j === target.j) out.push(solved ? 'new' : 'target');
      if (isSel([i, j])) out.push('selected');
      if (solved && src) {
        if (src.skip[0] === i && src.skip[1] === j) out.push('skip');
        if (src.take && src.take[0] === i && src.take[1] === j) out.push('take');
      }
      return out;
    };
    display = (
      <DPTable
        inst={inst}
        title="Knapsack table. Filled cells can be clicked to mark them as dependencies."
        value={(i, j) => (target && i === target.i && j === target.j && !solved ? '?' : filled(i, j) ? String(t[i][j]) : null)}
        tones={tones}
        arrows={arrows}
        activeRow={target?.i ?? null}
        onCell={(i, j) => toggle([i, j])}
        clickable={(i, j) => !solved && !done && filled(i, j) && !(target && i === target.i && j === target.j)}
      />
    );
  } else {
    const id = target ? back!.writes.findIndex((wr) => !wr.base && wr.pass === target.i && wr.j === target.j) : back!.writes.length;
    const snap = snapshot(back!, solved ? id + 1 : id);
    const i = target?.i ?? inst.items.length;
    const { w, v } = inst.items[i - 1];
    const arrows: ArcArrow[] = [];
    if (solved && target) {
      arrows.push({ from: target.j, to: target.j, kind: 'skip', label: 'keep' });
      arrows.push({ from: target.j - w, to: target.j, kind: 'take', label: `+${v}` });
    }
    display = (
      <>
        {target && (
          <p class="pass-line">
            Processing <b>item {i}</b> (w = {w}, v = {v}): j runs from W = {inst.W} down to w[{i}] = {w}. Shaded cells are already updated for item {i}.
          </p>
        )}
        <DPArray
          W={inst.W}
          title="The one array dp[0..W]. Cells can be clicked to mark them as dependencies."
          value={(j) => (target && j === target.j && !solved ? '?' : snap.val[j] === null ? null : String(snap.val[j]))}
          sub={(j) => (target && j === target.j && !solved ? `old ${snap.val[j]}` : undefined)}
          tones={(j) => {
            const out: Tone[] = [];
            if (target && j === target.j) out.push(solved ? 'new' : 'target');
            else if (target && snap.pass[j] === target.i) out.push('fresh');
            if (isSel([0, j])) out.push('selected');
            if (solved && target && j === target.j - w) out.push('take');
            return out;
          }}
          items={(j) => (snap.val[j] === null ? null : { text: formatItems(snap.items[j]), reuse: maxCount(snap.items[j]) > 1 })}
          pointer={target?.j ?? null}
          arrows={arrows}
          onCell={(j) => toggle([0, j])}
          clickable={() => !solved && !done}
        />
      </>
    );
  }

  return (
    <div class="mode-grid">
      <aside class="side">
        <SpecCard content={Object.fromEntries(Object.entries(SPEC_TEXT[view === '2d' ? 'table' : 'array']).map(([s, x]) => [s, <Rich text={x} />]))} status={{ transition: 'active' }} />
        <ItemList inst={inst} active={target?.i ?? null} />
      </aside>
      <section class="main">
        <div class="card">{display}</div>
        <div class="card panel" aria-live="polite">
          {done ? (
            <>
              {streak}
              <Callout tone="info" title="Table complete.">
                <p>Practice on a new table, or move on when you have reached mastery.</p>
              </Callout>
              <div class="controls">
                <button class="btn btn-primary" onClick={onNewTable}>
                  New table
                </button>
              </div>
            </>
          ) : (
            <>
              <div class="panel-head">
                {streak}
                <span class="muted small">
                  Cell {k + 1} of {targets.length} on this table
                </span>
              </div>
              <div class="predict-q">
                <label class="field">
                  <span class="field-label">
                    1. What is {view === '1d' && 'the new '}
                    <code>{cellName(view, target!.i, target!.j)}</code>?
                  </span>
                  <input
                    class="value-input"
                    inputMode="numeric"
                    value={value}
                    disabled={!!solved}
                    onInput={(e) => setValue((e.target as HTMLInputElement).value)}
                    onKeyDown={(e) => e.key === 'Enter' && submit()}
                    aria-label={`Value of ${cellName(view, target!.i, target!.j)}`}
                  />
                </label>
                <div class="field">
                  <span class="field-label">
                    2. Click the cells it <Term k="dependency">depends on</Term>
                    {view === '1d' && ' (click the ? cell itself for its old value)'}.
                  </span>
                  <span class="dep-list">
                    {deps.length === 0 ? <span class="muted">none selected</span> : deps.map((c) => <code key={c.join(',')}>{view === '2d' ? `dp[${c[0]}][${c[1]}]` : `dp[${c[1]}]`}</code>)}
                  </span>
                </div>
              </div>
              {hintLevel > 0 && ctx && (
                <div class="hints">
                  {([1, 2, 3] as const)
                    .filter((l) => l <= hintLevel)
                    .map((l) => (
                      <p key={l} class="hint">
                        <span class="hint-n">Hint {l}</span> {hint(ctx, l)}
                      </p>
                    ))}
                </div>
              )}
              {feedback && (
                <Callout tone="bad" title={feedback.title}>
                  {feedback.lines.map((l) => (
                    <p key={l}>{l}</p>
                  ))}
                </Callout>
              )}
              {solved && ctx && (
                <Callout tone="good" title={solved.clean ? 'Correct.' : 'Correct. (This one does not count toward the streak.)'}>
                  <p>{explainCell(ctx)}</p>
                  <p class="formula">{formulaCell(ctx)}</p>
                </Callout>
              )}
              <div class="controls">
                {!solved ? (
                  <>
                    <button class="btn btn-primary" onClick={submit}>
                      Check
                    </button>
                    <button class="btn" onClick={showHint} disabled={hintLevel >= 3}>
                      {hintLevel === 0 ? 'Hint' : hintLevel < 3 ? 'Next hint' : 'No more hints'}
                    </button>
                    {wrongTries >= 2 && hintLevel === 0 && <span class="small muted">Stuck? A hint names the next thing to check.</span>}
                  </>
                ) : (
                  <button class="btn btn-primary" onClick={advance} autoFocus>
                    Next cell →
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

/** Run the one-array loop forward and let the learner predict the first double count. */
function ForwardExperiment({ done, onDone }: { done: boolean; onDone: () => void }) {
  const inst = PREDICT_ARRAY_FIRST;
  const t = useMemo(() => truthTable(inst, 'zeroOne', 'atMost'), []);
  const fwd = useMemo(() => run(inst, arraySpec('up'), 'zeroOne', t), []);
  const back = useMemo(() => run(inst, arraySpec('down'), 'zeroOne', t), []);
  const first = fwd.writes.find((wr) => !wr.base && maxCount(wr.items) > 1)!;
  const passOne = fwd.writes.filter((wr) => wr.pass === 1);
  const baseCount = fwd.writes.filter((wr) => wr.base).length;
  const [phase, setPhase] = useState<'guess' | 'play' | 'explain' | 'finished'>(done ? 'finished' : 'guess');
  const [guess, setGuess] = useState<number | null>(null);
  const [shown, setShown] = useState(0);
  const { w, v } = inst.items[0];

  useEffect(() => {
    if (phase !== 'play' || shown >= passOne.length) return;
    const id = setTimeout(() => setShown((s) => s + 1), 900);
    return () => clearTimeout(id);
  }, [phase, shown]);

  const snap = snapshot(fwd, phase === 'guess' ? baseCount : phase === 'play' ? baseCount + shown : baseCount + passOne.length);
  const current = phase === 'play' && shown > 0 ? passOne[shown - 1] : null;
  const arrows: ArcArrow[] = current ? [{ from: current.j - w, to: current.j, kind: maxCount(current.items) > 1 ? 'bad' : 'take', label: `+${v}` }] : [];
  const fwdAnswer = fwd.writes.filter((x) => x.j === inst.W).pop()!;
  const backAnswer = back.writes.filter((x) => x.j === inst.W).pop()!;

  return (
    <section class="card experiment">
      <div class="kicker">Experiment · evaluation order</div>
      <h2>What if j runs forward?</h2>
      {phase === 'finished' ? (
        <p>
          Done. Running j forward reuses an item (dp[{first.j}] used item {first.pass} twice). Running j downward keeps dp[j − w[i]] at its “before item i” value. Forward gives dp[{inst.W}] = {fwdAnswer.value}
          (items {'{'}{formatItems(fwdAnswer.items)}{'}'}); the correct 0/1 answer is {backAnswer.value}.
        </p>
      ) : (
        <>
          <p>
            Same items, but now for item 1 (w = {w}, v = {v}) the loop runs <b>j = {w} up to {inst.W}</b>. Each step does <code>dp[j] = max(dp[j], dp[j − {w}] + {v})</code>.
          </p>
          {phase === 'guess' && <p class="ask">Which cell will be the first to use item 1 twice? Click it.</p>}
          <DPArray
            W={inst.W}
            title="Forward loop experiment"
            value={(j) => (snap.val[j] === null ? null : String(snap.val[j]))}
            tones={(j) => {
              const out: Tone[] = [];
              if (guess === j) out.push('selected');
              if (snap.pass[j] === 1) out.push('fresh');
              if (phase !== 'guess' && maxCount(snap.items[j]) > 1) out.push('reuse');
              return out;
            }}
            items={(j) => (snap.val[j] === null ? null : { text: formatItems(snap.items[j]), reuse: maxCount(snap.items[j]) > 1 })}
            pointer={current?.j ?? null}
            arrows={arrows}
            onCell={
              phase === 'guess'
                ? (j) => {
                    setGuess(j);
                    logEvent('forward_predict', 'p2-predict', { guess: j, answer: first.j, correct: j === first.j }, j === first.j ? [] : ['LOOP_FORWARD_01']);
                    setPhase('play');
                  }
                : undefined
            }
          />
          {phase === 'play' && shown >= passOne.length && (
            <>
              <Callout tone={guess === first.j ? 'good' : 'info'} title={guess === first.j ? `Yes: dp[${first.j}] is the first.` : `You picked dp[${guess}]. The first double count is dp[${first.j}].`}>
                <p>
                  dp[{first.j}] = dp[{first.j - w}] + {v}, but dp[{first.j - w}] had already been updated for item 1 in this same pass. So item 1 went in twice (items {'{'}{formatItems(first.items)}{'}'}). The 0/1 knapsack allows each item once.
                </p>
              </Callout>
              <button class="btn btn-primary" onClick={() => setPhase('explain')}>
                Explain why the downward loop is safe →
              </button>
            </>
          )}
          {phase === 'explain' && (
            <QuestionCard
              q={FORWARD_QUESTION}
              step="p2-predict"
              onDone={() => {
                setPhase('finished');
                onDone();
              }}
            />
          )}
        </>
      )}
    </section>
  );
}
