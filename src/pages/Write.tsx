// Write: the learner types the transition in a small notation and picks the loop order.
// DP Lens runs it on 206 instances and, on failure, traces the first wrong cell back
// through its dependencies.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { DesignNote } from '../components/DesignNote';
import { EffortRating } from '../components/EffortRating';
import { FailureView } from '../components/FailureView';
import { SpecCard } from '../components/SpecCard';
import { Callout, PageHead, Rich } from '../components/ui';
import { type CheckResult, type WriteProblem, checkWrite } from '../lib/check';
import { type Code, SLOT_LABEL } from '../lib/codes';
import { SPEC_TEXT } from '../lib/content';
import { checkInstances } from '../lib/knapsack';
import { logEvent } from '../lib/log';
import { NotationError, parse } from '../lib/notation';
import type { Order, Order1D, Order2D } from '../lib/runner';
import { type StepId, markDone, nextStep } from '../lib/store';

type WriteId = 'table' | 'array' | 'complete';

interface Config {
  step: StepId;
  problem: WriteProblem;
  title: string;
  kicker: string;
  intro: string;
  lhs: string;
  placeholder: string;
  palette: string[];
  solution: { formula: string; order: Order };
}

const CONFIGS: Record<WriteId, Config> = {
  table: {
    step: 'p1-write',
    problem: { kind: 'zeroOne', dims: 2, answer: 'nW' },
    title: 'Write the transition',
    kicker: '0/1 knapsack · table · Write',
    intro: 'The state, base case and answer are given. Type the rule that builds dp[i][j], and choose the loop order.',
    lhs: 'dp[i][j] =',
    placeholder: 'if j >= w[i] then … else …',
    palette: ['max(', ', ', ')', 'dp[i-1][j]', 'dp[', '][', ']', 'i-1', 'j-w[i]', 'v[i]', 'w[i]', ' + ', 'if ', ' then ', ' else ', ' >= '],
    solution: { formula: 'if j >= w[i] then max(dp[i-1][j], dp[i-1][j-w[i]] + v[i]) else dp[i-1][j]', order: { dims: 2, outer: 'i', iDir: 'up', jDir: 'up' } },
  },
  array: {
    step: 'p2-write',
    problem: { kind: 'zeroOne', dims: 1, answer: 'W' },
    title: 'Write the one-array version',
    kicker: '0/1 knapsack · one array · Write',
    intro: 'Same 0/1 knapsack, one array dp[0..W]. Type what dp[j] becomes when item i is processed, and choose which way j runs.',
    lhs: 'dp[j] =',
    placeholder: 'max(…, …)',
    palette: ['max(', ', ', ')', 'dp[j]', 'dp[', ']', 'j-w[i]', 'v[i]', 'w[i]', ' + ', 'if ', ' then ', ' else ', ' >= '],
    solution: { formula: 'max(dp[j], dp[j-w[i]] + v[i])', order: { dims: 1, jDir: 'down', jFrom: 'w' } },
  },
  complete: {
    step: 'p3-write',
    problem: { kind: 'complete', dims: 1, answer: 'W' },
    title: 'Write the complete knapsack',
    kicker: 'Complete knapsack · one array · Write',
    intro: 'Now every item may be packed any number of times. Type what dp[j] becomes when item i is processed, and choose which way j runs.',
    lhs: 'dp[j] =',
    placeholder: 'max(…, …)',
    palette: ['max(', ', ', ')', 'dp[j]', 'dp[', ']', 'j-w[i]', 'v[i]', 'w[i]', ' + ', 'if ', ' then ', ' else ', ' >= '],
    solution: { formula: 'max(dp[j], dp[j-w[i]] + v[i])', order: { dims: 1, jDir: 'up', jFrom: 'w' } },
  },
};

const ORDER_1D: { key: string; label: string; order: Order1D }[] = [
  { key: 'down-w', label: 'j from W down to w[i]', order: { dims: 1, jDir: 'down', jFrom: 'w' } },
  { key: 'up-w', label: 'j from w[i] up to W', order: { dims: 1, jDir: 'up', jFrom: 'w' } },
  { key: 'down-0', label: 'j from W down to 0', order: { dims: 1, jDir: 'down', jFrom: 'zero' } },
  { key: 'up-0', label: 'j from 0 up to W', order: { dims: 1, jDir: 'up', jFrom: 'zero' } },
];

const HINT2: Partial<Record<Code, string>> = {
  CURRENT_ROW: 'Your take choice reads row i. Which row is sure not to contain item i yet?',
  NEG_CAPACITY: 'When w[i] > j, item i does not fit. Guard the take choice (if j >= w[i] then … else …), or make the loop skip those j.',
  READ_BEFORE_WRITE: 'Row i reads row i − 1. Which way must i run so that row i − 1 is ready first?',
  LOOP_FORWARD_01: 'Which direction leaves dp[j − w[i]] untouched until after dp[j] has been computed?',
  LOOP_BACKWARD_COMPLETE: 'Here item i may be used again. Which direction makes dp[j − w[i]] already include item i?',
  ALWAYS_TAKE: 'max(…) needs both choices: skip the item, and take it.',
  MISSING_TAKE: 'Add the take choice: the best value at capacity j − w[i], plus v[i].',
  NO_WEIGHT_SUBTRACT: 'Taking item i uses w[i] units of room. Which capacity is left for the other items?',
  NEIGHBOR_COPY: 'Taking item i frees w[i] units of capacity, not 1.',
  INDEX_RANGE: 'Check every index: rows go 0..n, capacities 0..W, items 1..n.',
  UNSET_BASE: 'Every cell your rule reads must already hold a value.',
};

const INSTANCES = checkInstances(200);

export function Write({ id }: { id: WriteId }) {
  const c = CONFIGS[id];
  const [src, setSrc] = useState('');
  const [order2, setOrder2] = useState<Order2D>({ dims: 2, outer: 'i', iDir: 'up', jDir: 'up' });
  const [order1, setOrder1] = useState<string>('');
  const [result, setResult] = useState<CheckResult | null>(null);
  const [runs, setRuns] = useState(0);
  const [hint, setHint] = useState<0 | 1 | 2 | 3>(0);
  const input = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [result]);

  const parsed = useMemo(() => {
    if (!src.trim()) return null;
    try {
      return { node: parse(src, c.problem.dims) };
    } catch (e) {
      if (e instanceof NotationError) return { error: e };
      throw e;
    }
  }, [src, id]);

  const order: Order | null = c.problem.dims === 2 ? order2 : (ORDER_1D.find((o) => o.key === order1)?.order ?? null);

  const insert = (tok: string) => {
    const el = input.current;
    const at = el ? el.selectionStart ?? src.length : src.length;
    const end = el ? el.selectionEnd ?? at : at;
    const next = src.slice(0, at) + tok + src.slice(end);
    setSrc(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + tok.length, at + tok.length);
    });
  };

  const runIt = () => {
    if (!parsed || 'error' in parsed || !order) return;
    const spec = { dims: c.problem.dims, base: 'zeros' as const, transition: { kind: 'formula' as const, node: parsed.node! }, order };
    const r = checkWrite(c.problem, spec, INSTANCES);
    setResult(r);
    setRuns((x) => x + 1);
    setHint(0);
    const pass = !r.first;
    logEvent(
      'write_run',
      c.step,
      { problem: id, formula: src, order, pass, passed: r.passed, total: r.total, failIndex: r.first?.index ?? null, slot: r.first?.diag.slot ?? null, run: runs + 1 },
      r.first ? [r.first.diag.code] : [],
    );
    if (pass) {
      markDone(c.step);
      logEvent('step_done', c.step, { runs: runs + 1 });
    }
  };

  const next = nextStep(c.step);
  const failure = result?.first ?? null;
  const parseError = parsed && 'error' in parsed ? parsed.error : null;

  const transitionSlot = (
    <div class="write-box">
      <label class="field">
        <span class="field-label">
          <code>{c.lhs}</code>
        </span>
        <textarea
          ref={input}
          class={`formula-input${parseError ? ' invalid' : ''}`}
          rows={2}
          spellcheck={false}
          autoCapitalize="off"
          autoComplete="off"
          value={src}
          placeholder={c.placeholder}
          onInput={(e) => {
            setSrc((e.target as HTMLTextAreaElement).value);
            setResult(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) runIt();
          }}
          aria-describedby="parse-status"
        />
      </label>
      <div class="palette" aria-label="Insert a piece of notation">
        {c.palette.map((p) => (
          <button key={p} class="tok" onClick={() => insert(p)}>
            {p.trim() || '␣'}
          </button>
        ))}
      </div>
      <p id="parse-status" class={`parse-status ${parseError ? 'bad' : parsed ? 'good' : ''}`}>
        {parseError ? (
          <>
            <span>{parseError.message}</span>
            <code class="caret-line">
              {src.slice(0, parseError.pos)}
              <mark>{src.slice(parseError.pos, parseError.pos + 1) || ' '}</mark>
              {src.slice(parseError.pos + 1)}
            </code>
          </>
        ) : parsed ? (
          'The formula reads correctly. Run it to check what it computes.'
        ) : (
          'Names you can use: i, j, n, W, w[i], v[i], dp[…], max, min, INF, if … then … else.'
        )}
      </p>
    </div>
  );

  const orderSlot =
    c.problem.dims === 2 ? (
      <div class="order-picks">
        <label class="inline-field">
          <span>Outer loop</span>
          <select value={order2.outer} onChange={(e) => (setOrder2({ ...order2, outer: (e.target as HTMLSelectElement).value as 'i' | 'j' }), setResult(null))}>
            <option value="i">i (rows)</option>
            <option value="j">j (columns)</option>
          </select>
        </label>
        <label class="inline-field">
          <span>i runs</span>
          <select value={order2.iDir} onChange={(e) => (setOrder2({ ...order2, iDir: (e.target as HTMLSelectElement).value as 'up' | 'down' }), setResult(null))}>
            <option value="up">1 → n</option>
            <option value="down">n → 1</option>
          </select>
        </label>
        <label class="inline-field">
          <span>j runs</span>
          <select value={order2.jDir} onChange={(e) => (setOrder2({ ...order2, jDir: (e.target as HTMLSelectElement).value as 'up' | 'down' }), setResult(null))}>
            <option value="up">0 → W</option>
            <option value="down">W → 0</option>
          </select>
        </label>
      </div>
    ) : (
      <fieldset class="order-radios">
        <legend class="small">For each item i = 1..n:</legend>
        {ORDER_1D.map((o) => (
          <label key={o.key} class="radio">
            <input
              type="radio"
              name={`order-${id}`}
              checked={order1 === o.key}
              onChange={() => {
                setOrder1(o.key);
                setResult(null);
              }}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </fieldset>
    );

  const spec = SPEC_TEXT[id === 'table' ? 'table' : id === 'array' ? 'array' : 'complete'];

  return (
    <div class="page">
      <PageHead kicker={c.kicker} title={c.title}>
        {c.intro}
      </PageHead>
      <DesignNote id="write" />
      <div class="write-grid">
        <SpecCard
          title="Spec card — two slots are yours"
          content={{
            state: <Rich text={spec.state} />,
            base: <Rich text={spec.base} />,
            transition: transitionSlot,
            order: orderSlot,
            answer: <Rich text={spec.answer} />,
          }}
          status={{
            transition: failure && failure.diag.slot === 'transition' ? 'bad' : result && !failure ? 'ok' : 'active',
            order: failure && failure.diag.slot === 'order' ? 'bad' : result && !failure ? 'ok' : 'active',
          }}
        />
        <div class="controls">
          <button class="btn btn-primary" onClick={runIt} disabled={!parsed || !!parseError || !order}>
            Run on {INSTANCES.length} instances
          </button>
          {!order && <span class="small muted">Choose a loop order first.</span>}
          <span class="small muted">Runs so far: {runs}</span>
        </div>
      </div>

      {result && (
        <section class="card result" aria-live="polite" ref={resultRef}>
          {failure ? (
            <>
              <FailureView failure={failure} total={result.total} passed={result.passed} />
              <div class="hints">
                {hint >= 1 && (
                  <p class="hint">
                    <span class="hint-n">Hint 1</span> The problem is in the {SLOT_LABEL[failure.diag.slot].toLowerCase()} slot.
                  </p>
                )}
                {hint >= 2 && (
                  <p class="hint">
                    <span class="hint-n">Hint 2</span> {HINT2[failure.diag.code] ?? 'Compare your rule with the state, word by word: which cells does it promise to read?'}
                  </p>
                )}
                {hint >= 3 && (
                  <p class="hint">
                    <span class="hint-n">Hint 3</span> One working answer: <code>{c.lhs} {c.solution.formula}</code>, with{' '}
                    {c.solution.order.dims === 1 ? ORDER_1D.find((o) => JSON.stringify(o.order) === JSON.stringify(c.solution.order))!.label : 'i from 1 to n outside, j from 0 to W inside'}.
                  </p>
                )}
                {hint < 3 && (
                  <button
                    class="btn"
                    onClick={() => {
                      const lvl = (hint + 1) as 1 | 2 | 3;
                      setHint(lvl);
                      logEvent('write_hint', c.step, { level: lvl, code: failure.diag.code });
                    }}
                  >
                    {hint === 0 ? 'Hint' : 'Next hint'}
                  </button>
                )}
              </div>
            </>
          ) : (
            <Callout tone="good" title={`Correct on all ${result.total} instances.`}>
              <p>Every cell of every table matched the state, including the edge cases (capacity 0, an item heavier than W, items of weight 1).</p>
              <EffortRating step={c.step} />
              {next && (
                <a class="btn btn-primary" href={next.route}>
                  Next: {next.title} →
                </a>
              )}
            </Callout>
          )}
        </section>
      )}
    </div>
  );
}
