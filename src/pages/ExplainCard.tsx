// Articulation: state the spec card in your own words, one sentence per slot, before
// seeing the reference card; then rate each slot against it. In class this is said aloud.

import { useState } from 'preact/hooks';
import { DesignNote } from '../components/DesignNote';
import { Callout, NextLink, PageHead, Rich } from '../components/ui';
import { SLOTS, SLOT_LABEL, SLOT_QUESTION, type Slot } from '../lib/codes';
import { SPEC_TEXT } from '../lib/content';
import { logEvent } from '../lib/log';
import { markDone, nextStep, useAppState } from '../lib/store';

const CHECKPOINTS: Record<Slot, string> = {
  state: 'Which items are allowed (items 1..i), what j measures (total weight at most j), and what is stored (the best total value).',
  base: 'Which cells need no work (row 0), and why (no items, so the value is 0).',
  transition: 'Both choices (skip and take), that “take” reads row i − 1, and what happens when item i does not fit.',
  order: 'What must be ready before a cell is filled (row i − 1), so rows go top to bottom; inside a row any direction works.',
  answer: 'Which cell (dp[n][W]) and why its meaning matches the whole question.',
};

type Rating = 'same' | 'partly' | 'missed';
const RATINGS: { key: Rating; label: string }[] = [
  { key: 'same', label: 'Same idea' },
  { key: 'partly', label: 'Partly' },
  { key: 'missed', label: 'I missed something' },
];

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export function ExplainCard() {
  const app = useAppState();
  const [text, setText] = useState<Record<Slot, string>>({ state: '', base: '', transition: '', order: '', answer: '' });
  const [revealed, setRevealed] = useState(false);
  const [rating, setRating] = useState<Partial<Record<Slot, Rating>>>({});
  const [saved, setSaved] = useState(false);
  const ready = SLOTS.every((s) => words(text[s]) >= 3);
  const rated = SLOTS.every((s) => rating[s]);
  const next = nextStep('p1-explain');

  const save = () => {
    logEvent('articulate', 'p1-explain', { text, rating });
    markDone('p1-explain');
    logEvent('step_done', 'p1-explain', {});
    setSaved(true);
  };

  return (
    <div class="page narrow">
      <PageHead kicker="0/1 knapsack · table · Explain" title="Explain your spec card">
        In class, each student says the card aloud, one sentence per slot. Here, write one sentence per slot in your own words. The reference card stays hidden until you finish.
      </PageHead>
      <DesignNote id="explain" />
      {app.done['p1-explain'] && !saved && (
        <Callout tone="info" title="You finished this step before.">
          <p>You can do it again; a new answer is saved next to the old one.</p>
        </Callout>
      )}

      <ol class="explain-list">
        {SLOTS.map((s) => (
          <li key={s} class="card explain-slot">
            <div class="slot-label">{SLOT_LABEL[s]}</div>
            <label class="field">
              <span class="field-label">{SLOT_QUESTION[s]}</span>
              <textarea
                rows={2}
                value={text[s]}
                disabled={revealed}
                placeholder="One sentence, in your own words."
                onInput={(e) => setText({ ...text, [s]: (e.target as HTMLTextAreaElement).value })}
              />
            </label>
            {revealed && (
              <div class="compare">
                <div>
                  <div class="kicker">Reference card</div>
                  <p>
                    <Rich text={SPEC_TEXT.table[s]} />
                  </p>
                  <p class="small muted">A strong sentence says: {CHECKPOINTS[s]}</p>
                </div>
                <div class="rate" role="radiogroup" aria-label={`How close was your ${SLOT_LABEL[s].toLowerCase()}?`}>
                  {RATINGS.map((r) => (
                    <label key={r.key} class={`rate-opt${rating[s] === r.key ? ' on' : ''}`}>
                      <input type="radio" name={`rate-${s}`} checked={rating[s] === r.key} disabled={saved} onChange={() => setRating({ ...rating, [s]: r.key })} />
                      {r.label}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>

      <div class="controls">
        {!revealed ? (
          <>
            <button class="btn btn-primary" disabled={!ready} onClick={() => setRevealed(true)}>
              Compare with the reference card
            </button>
            {!ready && <span class="small muted">Write at least a few words in every slot first.</span>}
          </>
        ) : !saved ? (
          <>
            <button class="btn btn-primary" disabled={!rated} onClick={save}>
              Save my card and ratings
            </button>
            {!rated && <span class="small muted">Rate every slot first.</span>}
          </>
        ) : null}
      </div>
      {saved && (
        <Callout tone="good" title="Saved.">
          <p>Slots you rated “partly” or “missed” are good ones to watch in Write after class.</p>
          <NextLink next={next} />
        </Callout>
      )}
    </div>
  );
}
