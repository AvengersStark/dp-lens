// Reflection: the learner sees their own coded errors by slot (the same codes the
// teacher sees), then writes three sentences about the slot they missed most.

import { useMemo, useState } from 'preact/hooks';
import { DesignNote } from '../components/DesignNote';
import { Callout, PageHead } from '../components/ui';
import { CODES, type Code, SLOTS, SLOT_LABEL, type Slot } from '../lib/codes';
import { logEvent, readLog } from '../lib/log';
import { markDone, nextStep } from '../lib/store';

function record() {
  const events = readLog();
  const bySlot: Record<Slot, number> = { state: 0, base: 0, transition: 0, order: 0, answer: 0 };
  const byCode = new Map<Code, number>();
  let firstTries = 0;
  let firstRight = 0;
  for (const e of events) {
    for (const c of e.codes) {
      byCode.set(c, (byCode.get(c) ?? 0) + 1);
      const slot = CODES[c].slot;
      if (slot) bySlot[slot]++;
    }
    if (e.type === 'predict_submit' && e.data.try === 1) {
      firstTries++;
      if (e.data.correct) firstRight++;
    }
  }
  const top = [...byCode.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const total = Object.values(bySlot).reduce((a, b) => a + b, 0);
  const suggested = total ? SLOTS.reduce((a, b) => (bySlot[b] > bySlot[a] ? b : a)) : null;
  return { bySlot, top, total, firstTries, firstRight, suggested };
}

export function Reflect() {
  const r = useMemo(record, []);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [wrong, setWrong] = useState('');
  const [nextTime, setNextTime] = useState('');
  const [saved, setSaved] = useState(false);
  const max = Math.max(1, ...Object.values(r.bySlot));
  const next = nextStep('reflect');

  const save = () => {
    logEvent('reflection', 'reflect', { slot, wrong: wrong.trim(), nextTime: nextTime.trim(), suggested: r.suggested });
    markDone('reflect');
    logEvent('step_done', 'reflect', {});
    setSaved(true);
  };

  return (
    <div class="page narrow">
      <PageHead kicker="After class · Reflect" title="Reflect on your hardest slot">
        Contests reward the right answer but never ask how you got there. Look at your own record first, then write three sentences.
      </PageHead>
      <DesignNote id="reflect" />

      <section class="card">
        <h2 class="card-title">Your record in this browser</h2>
        {r.total === 0 ? (
          <p class="muted">No coded errors yet. Either everything went right, or you have not done the practice steps in this browser.</p>
        ) : (
          <>
            <ol class="bars">
              {SLOTS.map((s) => (
                <li key={s} class="bar-row compact">
                  <div class="bar-label">{SLOT_LABEL[s]}</div>
                  <div class="bar-track">
                    {r.bySlot[s] > 0 && <div class="bar-fill" style={{ width: `${(100 * r.bySlot[s]) / max}%` }} />}
                  </div>
                  <div class="bar-value">{r.bySlot[s]}</div>
                </li>
              ))}
            </ol>
            <p class="small">
              Your most frequent mistakes:{' '}
              {r.top.map(([c, n], k) => (
                <span key={c}>
                  {k > 0 && '; '}
                  <b>{CODES[c].label}</b> ({n})
                </span>
              ))}
              .
            </p>
          </>
        )}
        {r.firstTries > 0 && (
          <p class="small muted">
            Predict: {r.firstRight} of {r.firstTries} cells right on the first try.
          </p>
        )}
      </section>

      <section class="card">
        <fieldset class="slot-pick">
          <legend class="field-label">1. Which slot was hardest for you?</legend>
          {SLOTS.map((s) => (
            <label key={s} class={`rate-opt${slot === s ? ' on' : ''}`}>
              <input type="radio" name="hardest" checked={slot === s} disabled={saved} onChange={() => setSlot(s)} />
              {SLOT_LABEL[s]}
              {r.suggested === s && <span class="small muted"> (your record suggests this one)</span>}
            </label>
          ))}
        </fieldset>
        <label class="field">
          <span class="field-label">2. What went wrong there, and why?</span>
          <textarea rows={2} value={wrong} disabled={saved} onInput={(e) => setWrong((e.target as HTMLTextAreaElement).value)} />
        </label>
        <label class="field">
          <span class="field-label">3. What will you check first in the next DP problem?</span>
          <textarea rows={2} value={nextTime} disabled={saved} onInput={(e) => setNextTime((e.target as HTMLTextAreaElement).value)} />
        </label>
        {!saved && (
          <button class="btn btn-primary" disabled={!slot || !wrong.trim() || !nextTime.trim()} onClick={save}>
            Save my reflection
          </button>
        )}
      </section>
      {saved && (
        <Callout tone="good" title="Saved.">
          <p>Your teacher sees which slot each learner picked on the error board.</p>
          {next && (
            <a class="btn btn-primary" href={next.route}>
              Next: {next.title} →
            </a>
          )}
        </Callout>
      )}
    </div>
  );
}
