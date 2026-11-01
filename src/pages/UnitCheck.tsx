// Test mode: the Unit Check, with no feedback during the test. Pretest and posttest
// use opposite parallel forms.

import { useEffect, useState } from 'preact/hooks';
import { DesignNote } from '../components/DesignNote';
import { Callout, PageHead } from '../components/ui';
import { SLOTS, SLOT_LABEL } from '../lib/codes';
import { logEvent } from '../lib/log';
import { type StepId, formFor, markDone, nextStep, setState, useAppState } from '../lib/store';
import { type Answers, FORMS, emptyAnswers, scoreAuto } from '../lib/unitcheck';

const LETTERS = ['A', 'B', 'C', 'D'];

function mmss(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

export function UnitCheck({ phase }: { phase: 'pre' | 'post' }) {
  const app = useAppState();
  const formId = formFor(app, phase);
  const form = FORMS[formId];
  const record = app.tests[phase];
  const [answers, setAnswers] = useState<Answers>(emptyAnswers);
  const [confirming, setConfirming] = useState(false);
  const [retake, setRetake] = useState(false);
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const stepId: StepId = phase;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const set = (patch: Partial<Answers>) => {
    setAnswers((a) => ({ ...a, ...patch }));
    setConfirming(false);
  };

  const submit = () => {
    const auto = scoreAuto(form, answers);
    const seconds = Math.round((Date.now() - start) / 1000);
    setState({ tests: { ...app.tests, [phase]: { form: formId, traceScore: auto.trace, debugLine: auto.debugLine, submittedAt: Date.now() } } });
    logEvent('test_submit', stepId, { phase, form: formId, answers, auto, seconds });
    markDone(stepId);
    setRetake(false);
    window.scrollTo(0, 0);
  };

  const title = phase === 'pre' ? 'Unit Check · pretest' : 'Unit Check · posttest';

  if (record && !retake) {
    const next = nextStep(stepId);
    const pre = app.tests.pre;
    return (
      <div class="page narrow">
        <PageHead kicker={`Test mode · form ${record.form}`} title={title} />
        <Callout tone="info" title="Submitted.">
          <p>
            Trace (scored automatically): <b>{record.traceScore} of 4</b> cells.
            {phase === 'post' && pre && ` On the pretest you had ${pre.traceScore} of 4.`}
          </p>
          <p>Explain, Debug and Design are scored by your teacher with a rubric. Export your log (top right) and send the file to your teacher.</p>
          {phase === 'pre' && record.traceScore >= 3 && <p>Your Trace score means you may skip Watch and start at Predict.</p>}
        </Callout>
        <div class="controls">
          {next && (
            <a class="btn btn-primary" href={next.route}>
              Next: {next.title} →
            </a>
          )}
          {phase === 'post' && (
            <a class="btn btn-primary" href="#/">
              Back to the unit path
            </a>
          )}
          <button class="btn" onClick={() => setRetake(true)}>
            Take it again
          </button>
        </div>
      </div>
    );
  }

  const n = form.trace.inst.items.length;
  const W = form.trace.inst.W;
  const elapsed = Math.round((now - start) / 1000);

  return (
    <div class="page narrow">
      <PageHead kicker={`Test mode · form ${formId} · no feedback`} title={title}>
        About 20 minutes. You will not see whether answers are right until your teacher scores them. Answer in the notation, in pseudocode, or in plain words.
      </PageHead>
      <DesignNote id="check" />
      <div class="timer" aria-live="off">
        Time: {mmss(elapsed)} <span class="muted">/ about 20:00</span>
      </div>

      <section class="card test-part">
        <div class="kicker">Part 1 · Trace</div>
        <p>
          Items <b>(w, v)</b>: {form.trace.inst.items.map((it, k) => `item ${k + 1} = (${it.w}, ${it.v})`).join(', ')}. Capacity W = {W}. Each item at most once.
        </p>
        <p>
          <code>dp[i][j]</code> = the best total value using only items 1..i with total weight at most j. <code>dp[0][j] = 0</code>; if w[i] &gt; j then{' '}
          <code>dp[i][j] = dp[i−1][j]</code>, otherwise <code>dp[i][j] = max(dp[i−1][j], dp[i−1][j−w[i]] + v[i])</code>.
        </p>
        <p>Fill in the four marked cells A–D. The other boxes are scratch space and are not scored.</p>
        <div class="svg-scroll">
          <table class="trace-grid">
            <thead>
              <tr>
                <th scope="col">i \ j</th>
                {Array.from({ length: W + 1 }, (_, j) => (
                  <th key={j} scope="col">
                    {j}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: n + 1 }, (_, i) => (
                <tr key={i}>
                  <th scope="row">{i}</th>
                  {Array.from({ length: W + 1 }, (_, j) => {
                    if (i === 0) return <td key={j}>0</td>;
                    const k = form.trace.cells.findIndex(([a, b]) => a === i && b === j);
                    return (
                      <td key={j} class={k >= 0 ? 'scored' : ''}>
                        {k >= 0 && <span class="cell-letter">{LETTERS[k]}</span>}
                        <input
                          inputMode="numeric"
                          aria-label={k >= 0 ? `Cell ${LETTERS[k]}: dp[${i}][${j}]` : `Scratch dp[${i}][${j}]`}
                          value={k >= 0 ? answers.trace[k] : undefined}
                          onInput={
                            k >= 0
                              ? (e) => {
                                  const tr = answers.trace.slice();
                                  tr[k] = (e.target as HTMLInputElement).value;
                                  set({ trace: tr });
                                }
                              : undefined
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section class="card test-part">
        <div class="kicker">Part 2 · Explain</div>
        <p>{form.explain.context}</p>
        <pre class="code">{form.explain.code.join('\n')}</pre>
        <label class="field">
          <span class="field-label">a. {form.explain.q1}</span>
          <textarea rows={2} value={answers.explain1} onInput={(e) => set({ explain1: (e.target as HTMLTextAreaElement).value })} />
        </label>
        <label class="field">
          <span class="field-label">b. {form.explain.q2}</span>
          <textarea rows={3} value={answers.explain2} onInput={(e) => set({ explain2: (e.target as HTMLTextAreaElement).value })} />
        </label>
      </section>

      <section class="card test-part">
        <div class="kicker">Part 3 · Debug</div>
        <p>{form.debug.claim}</p>
        <p class="field-label">a. Click the line with the bug.</p>
        <div class="code-lines" role="radiogroup" aria-label="Program lines">
          {form.debug.lines.map((l, k) => (
            <button key={k} role="radio" aria-checked={answers.debugLine === k + 1} class={`code-line${answers.debugLine === k + 1 ? ' chosen' : ''}`} onClick={() => set({ debugLine: k + 1 })}>
              <span class="ln">{k + 1}</span>
              <code>{l}</code>
            </button>
          ))}
        </div>
        <label class="field">
          <span class="field-label">b. Write the fixed line.</span>
          <input class="mono" value={answers.debugFix} onInput={(e) => set({ debugFix: (e.target as HTMLInputElement).value })} />
        </label>
      </section>

      <section class="card test-part">
        <div class="kicker">Part 4 · Design</div>
        <p>{form.design}</p>
        {SLOTS.map((s) => (
          <label key={s} class="field">
            <span class="field-label">{SLOT_LABEL[s]}</span>
            <textarea rows={2} value={answers.design[s]} onInput={(e) => set({ design: { ...answers.design, [s]: (e.target as HTMLTextAreaElement).value } })} />
          </label>
        ))}
      </section>

      <div class="controls">
        {!confirming ? (
          <button class="btn btn-primary" onClick={() => setConfirming(true)}>
            Submit test
          </button>
        ) : (
          <>
            <span>Submit now? You cannot change your answers afterwards.</span>
            <button class="btn btn-primary" onClick={submit}>
              Yes, submit
            </button>
            <button class="btn" onClick={() => setConfirming(false)}>
              Keep working
            </button>
          </>
        )}
      </div>
    </div>
  );
}
