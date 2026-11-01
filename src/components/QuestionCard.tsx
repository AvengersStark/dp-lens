// A self-explanation question: pick a reason, see why it is or is not right, and
// optionally explain in your own words. Every answer is logged with its code.

import { useState } from 'preact/hooks';
import type { Question } from '../lib/content';
import { logEvent } from '../lib/log';
import { Callout } from './ui';

export function QuestionCard({ q, step, onDone }: { q: Question; step: string; onDone: () => void }) {
  const [choice, setChoice] = useState<number | null>(null);
  const [checked, setChecked] = useState<number | null>(null);
  const [firstChoice, setFirstChoice] = useState<number | null>(null);
  const [text, setText] = useState('');
  const picked = checked === null ? null : q.options[checked];

  const check = () => {
    if (choice === null) return;
    setChecked(choice);
    if (firstChoice === null) setFirstChoice(choice);
    const o = q.options[choice];
    logEvent('self_explain', step, { qid: q.id, choice, correct: o.correct, firstTry: firstChoice === null }, o.code ? [o.code] : []);
  };

  const finish = () => {
    if (text.trim()) logEvent('self_explain', step, { qid: q.id, text: text.trim(), note: true });
    onDone();
  };

  return (
    <div class="question">
      <div class="kicker">Explain it</div>
      <p class="question-prompt">{q.prompt}</p>
      <div class="options" role="radiogroup" aria-label={q.prompt}>
        {q.options.map((o, k) => (
          <label key={k} class={`option${choice === k ? ' chosen' : ''}${checked === k ? (o.correct ? ' right' : ' wrong') : ''}`}>
            <input
              type="radio"
              name={q.id}
              checked={choice === k}
              disabled={picked?.correct}
              onChange={() => {
                setChoice(k);
              }}
            />
            <span>{o.text}</span>
          </label>
        ))}
      </div>
      {!picked?.correct && (
        <button class="btn btn-primary" disabled={choice === null || choice === checked} onClick={check}>
          Check my reason
        </button>
      )}
      {picked && (
        <Callout tone={picked.correct ? 'good' : 'bad'} title={picked.correct ? 'Yes.' : 'Not quite.'}>
          <p>{picked.why}</p>
          {!picked.correct && <p class="small">Pick another reason.</p>}
        </Callout>
      )}
      {picked?.correct && (
        <>
          <label class="field">
            <span class="field-label">In your own words (optional)</span>
            <textarea rows={2} value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} placeholder="One sentence is enough." />
          </label>
          <button class="btn btn-primary" onClick={finish}>
            Continue
          </button>
        </>
      )}
    </div>
  );
}
