// Build: a Parsons problem over the spec card. Blocks are shuffled, distractors
// included. The card is judged by running it on 66 instances, so valid alternatives
// pass and each trap fails with feedback on the slot that caused it.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { DesignNote } from '../components/DesignNote';
import { EffortRating } from '../components/EffortRating';
import { FailureView } from '../components/FailureView';
import { Callout, PageHead, Rich, Term } from '../components/ui';
import { BUILD_INSTANCES, BUILD_PROBLEMS, type Block, type BuildProblem, type CardResult, type Placement, blockById, evaluateCard } from '../lib/build';
import { CODES, SLOTS, SLOT_LABEL, SLOT_QUESTION, type Slot } from '../lib/codes';
import { logEvent } from '../lib/log';
import { mulberry32, shuffle } from '../lib/rng';
import { type StepId, learnerSeed, markDone, nextStep, useAppState } from '../lib/store';

const CANONICAL: Record<BuildProblem['id'], Record<Slot, string>> = {
  zo2d: { state: 's-atmost', base: 'b-zeros', transition: 't-ok', order: 'o-iup-jup', answer: 'a-nW' },
  complete: { state: 'c-s-ok', base: 'c-b-zeros', transition: 'c-t-ok', order: 'c-o-up', answer: 'c-a-W' },
};

/** A block that works in this slot given the rest of the card (respects the "exactly j" alternative). */
function suggestion(p: BuildProblem, placement: Placement, slot: Slot): string {
  if (p.id === 'zo2d' && placement.state === 's-exact') {
    if (slot === 'base') return 'b-exact';
    if (slot === 'answer') return 'a-max';
  }
  return CANONICAL[p.id][slot];
}

export function Build({ id }: { id: BuildProblem['id'] }) {
  const app = useAppState();
  const p = BUILD_PROBLEMS[id];
  const stepId: StepId = id === 'zo2d' ? 'p1-build' : 'p3-build';
  const order = useMemo(() => shuffle(mulberry32(learnerSeed(app, stepId)), p.blocks), [id]);
  const [placement, setPlacement] = useState<Placement>({});
  const [picked, setPicked] = useState<string | null>(null);
  const [result, setResult] = useState<CardResult | null>(null);
  const [runs, setRuns] = useState(0);
  const [hint, setHint] = useState<0 | 1 | 2>(0);
  const resultRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [result]);

  const placedIds = new Set(Object.values(placement));
  const pool = order.filter((b) => !placedIds.has(b.id));

  const place = (slot: Slot, blockId: string) => {
    setPlacement((pl) => {
      const next: Placement = { ...pl };
      for (const s of SLOTS) if (next[s] === blockId) delete next[s];
      next[slot] = blockId;
      return next;
    });
    setPicked(null);
    setResult(null);
  };
  const remove = (slot: Slot) => {
    setPlacement((pl) => {
      const next = { ...pl };
      delete next[slot];
      return next;
    });
    setResult(null);
  };

  const runCard = () => {
    const r = evaluateCard(p, placement);
    setResult(r);
    setRuns((x) => x + 1);
    setHint(0);
    const verdict = r.status === 'checked' ? r.verdict : null;
    const codes = r.status === 'misplaced' ? r.verdicts.map((v) => v.code) : verdict ? [verdict.code] : [];
    logEvent(
      'build_run',
      stepId,
      {
        problem: id,
        placement,
        status: r.status,
        pass: r.status === 'checked' && !r.verdict,
        badSlot: r.status === 'checked' ? r.badSlot : null,
        passed: r.status === 'checked' ? r.check.passed : null,
        run: runs + 1,
      },
      codes,
    );
    if (r.status === 'checked' && !r.verdict) {
      markDone(stepId);
      logEvent('step_done', stepId, { runs: runs + 1 });
    }
  };

  const badSlot = result?.status === 'checked' ? result.badSlot : null;
  const misplaced = new Set(result?.status === 'misplaced' ? result.verdicts.map((v) => v.slot) : []);
  const success = result?.status === 'checked' && !result.verdict;
  const next = nextStep(stepId)!;

  return (
    <div class="page">
      <PageHead kicker={`${p.title} · Build`} title={id === 'zo2d' ? 'Build the spec card' : 'Build the complete knapsack'}>
        {p.task} Put one block in each slot of the spec card, then run your card. Some blocks are traps.
      </PageHead>
      <DesignNote id="build" />
      <div class="build-grid">
        <section class="card" aria-label="Your spec card">
          <h2 class="card-title">Your spec card</h2>
          <ol class="slots build-slots">
            {SLOTS.map((s) => {
              const b = placement[s] ? blockById(p, placement[s]!) : null;
              const st = success ? 'ok' : badSlot === s || misplaced.has(s) ? 'bad' : undefined;
              return (
                <li
                  key={s}
                  class={`slot drop${st ? ` slot-${st}` : ''}${picked ? ' drop-ready' : ''}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const bid = e.dataTransfer?.getData('text/plain');
                    if (bid) place(s, bid);
                  }}
                >
                  <div class="slot-label">
                    <Term k={s === 'base' ? 'base' : s}>{SLOT_LABEL[s]}</Term>
                    {st === 'ok' && <span class="slot-mark">✓</span>}
                    {st === 'bad' && <span class="slot-mark">✗</span>}
                  </div>
                  <div class="slot-q">{SLOT_QUESTION[s]}</div>
                  {b ? (
                    <button class="block placed" onClick={() => (picked ? place(s, picked) : remove(s))} title={picked ? 'Swap in the picked block' : 'Send back to the bank'}>
                      <Rich text={b.text} />
                      <span class="block-x" aria-hidden="true">
                        ×
                      </span>
                    </button>
                  ) : (
                    <button class="drop-target" onClick={() => picked && place(s, picked)} disabled={!picked}>
                      {picked ? 'Put the picked block here' : 'Pick a block, then click here (or drag it here)'}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
          <div class="controls">
            <button class="btn btn-primary" onClick={runCard}>
              Run my card on {BUILD_INSTANCES.length} instances
            </button>
            <span class="small muted">Runs so far: {runs}</span>
          </div>
        </section>

        <section class="card" aria-label="Block bank">
          <h2 class="card-title">Block bank</h2>
          <p class="small muted">Click a block to pick it up, then click a slot. Click a placed block to send it back.</p>
          <div class="bank">
            {pool.map((b: Block) => (
              <button
                key={b.id}
                class={`block${picked === b.id ? ' picked' : ''}`}
                draggable
                onDragStart={(e) => e.dataTransfer?.setData('text/plain', b.id)}
                onClick={() => setPicked(picked === b.id ? null : b.id)}
                aria-pressed={picked === b.id}
              >
                <Rich text={b.text} />
              </button>
            ))}
            {pool.length === 0 && <p class="muted small">Every block is placed.</p>}
          </div>
        </section>
      </div>

      {result && (
        <section class="card result" aria-live="polite" ref={resultRef}>
          {result.status === 'incomplete' && (
            <Callout tone="warn" title="Fill every slot first.">
              <p>Missing: {result.missing.map((s) => SLOT_LABEL[s]).join(', ')}.</p>
            </Callout>
          )}
          {result.status === 'misplaced' && (
            <Callout tone="bad" title="Some blocks are in the wrong slot.">
              {result.verdicts.map((v) => (
                <p key={v.slot}>
                  <b>{SLOT_LABEL[v.slot]}:</b> {v.message}
                </p>
              ))}
            </Callout>
          )}
          {result.status === 'checked' && result.verdict && !result.check.first && (
            <Callout tone="bad" title={`Look at: ${SLOT_LABEL[result.verdict.slot]} — ${CODES[result.verdict.code].label}`}>
              <p>{result.verdict.message}</p>
            </Callout>
          )}
          {result.status === 'checked' && result.check.first && <FailureView failure={result.check.first} total={result.check.total} passed={result.check.passed} />}
          {result.status === 'checked' && result.verdict && (
            <div class="hint-row">
              {hint >= 1 && (
                <p class="hint">
                  <span class="hint-n">Hint 1</span> {CODES[result.verdict.code].meaning} Ask: {SLOT_QUESTION[result.verdict.slot].toLowerCase()}
                </p>
              )}
              {hint < 1 && (
                <button
                  class="btn"
                  onClick={() => {
                    setHint(1);
                    logEvent('build_hint', stepId, { level: 1, slot: result.verdict!.slot });
                  }}
                >
                  Hint
                </button>
              )}
              {hint === 1 && (
                <button
                  class="btn"
                  onClick={() => {
                    setHint(2);
                    logEvent('build_hint', stepId, { level: 2, slot: result.verdict!.slot });
                    place(result.verdict!.slot, suggestion(p, placement, result.verdict!.slot));
                  }}
                >
                  Place a working block in {SLOT_LABEL[result.verdict.slot].toLowerCase()} for me
                </button>
              )}
            </div>
          )}
          {success && (
            <Callout tone="good" title={`Your card is correct on all ${result.check.total} instances.`}>
              {result.notes.map((n) => (
                <p key={n}>{n}</p>
              ))}
              <EffortRating step={stepId} />
              <a class="btn btn-primary" href={next.route}>
                Next: {next.title} →
              </a>
            </Callout>
          )}
        </section>
      )}
    </div>
  );
}
