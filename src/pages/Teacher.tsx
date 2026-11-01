// The teacher's error board: merge exported learner logs and see which misconceptions
// came up, how often, and for how many learners, to plan the in-class debrief.

import { Fragment } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { DesignNote } from '../components/DesignNote';
import { Badge, Callout, PageHead } from '../components/ui';
import { CODES, type Code, SLOTS, SLOT_LABEL, type Slot } from '../lib/codes';
import { WATCH_QUESTIONS, FORWARD_QUESTION } from '../lib/content';
import { demoLogs } from '../lib/demo';
import { type LogFile, buildLogFile, parseLogFile } from '../lib/log';
import { STEPS } from '../lib/store';
import { RUBRIC } from '../lib/unitcheck';

type ModeFilter = 'all' | 'Watch' | 'Predict' | 'Build' | 'Write' | 'Test';

const STEP_MODE = Object.fromEntries(STEPS.map((s) => [s.id, s.mode]));
const QUESTIONS = Object.fromEntries([...Object.values(WATCH_QUESTIONS), FORWARD_QUESTION].map((q) => [q.id, q]));

interface CodeRow {
  code: Code;
  count: number;
  learners: Set<string>;
}

function aggregate(files: LogFile[], filter: ModeFilter) {
  const codes = new Map<Code, CodeRow>();
  const questions = new Map<string, { n: number; right: number; choices: number[] }>();
  const effort = new Map<string, { sum: number; n: number }>();
  const hardest: Record<Slot, number> = { state: 0, base: 0, transition: 0, order: 0, answer: 0 };
  const missedInExplain: Record<Slot, number> = { state: 0, base: 0, transition: 0, order: 0, answer: 0 };
  let predictN = 0;
  let predictRight = 0;
  let mastered = 0;
  const tests: { who: string; pre?: Record<string, unknown>; post?: Record<string, unknown> }[] = [];

  for (const f of files) {
    const who = f.nickname;
    const row: { who: string; pre?: Record<string, unknown>; post?: Record<string, unknown> } = { who };
    let didMaster = false;
    for (const e of f.events) {
      const mode = STEP_MODE[e.step] ?? 'Other';
      if (filter === 'all' || mode === filter) {
        for (const c of e.codes) {
          const r = codes.get(c) ?? { code: c, count: 0, learners: new Set<string>() };
          r.count++;
          r.learners.add(who);
          codes.set(c, r);
        }
      }
      if (e.type === 'self_explain' && typeof e.data.choice === 'number' && e.data.firstTry !== false) {
        const q = QUESTIONS[e.data.qid as string];
        if (q) {
          const s = questions.get(q.id) ?? { n: 0, right: 0, choices: q.options.map(() => 0) };
          s.n++;
          if (e.data.correct) s.right++;
          s.choices[e.data.choice as number]++;
          questions.set(q.id, s);
        }
      }
      if (e.type === 'predict_submit' && e.data.try === 1) {
        predictN++;
        if (e.data.correct) predictRight++;
      }
      if (e.type === 'predict_mastery' && e.step === 'p1-predict') didMaster = true;
      if (e.type === 'effort' && typeof e.data.rating === 'number') {
        const r = effort.get(e.step) ?? { sum: 0, n: 0 };
        r.sum += e.data.rating;
        r.n++;
        effort.set(e.step, r);
      }
      if (e.type === 'reflection' && typeof e.data.slot === 'string') hardest[e.data.slot as Slot]++;
      if (e.type === 'articulate' && e.data.rating) {
        for (const [s, v] of Object.entries(e.data.rating as Record<string, string>)) if (v !== 'same') missedInExplain[s as Slot]++;
      }
      if (e.type === 'test_submit') {
        if (e.data.phase === 'pre') row.pre = e.data;
        if (e.data.phase === 'post') row.post = e.data;
      }
    }
    if (didMaster) mastered++;
    tests.push(row);
  }
  const ranked = [...codes.values()].sort((a, b) => b.count - a.count || b.learners.size - a.learners.size);
  return { ranked, questions, predictN, predictRight, mastered, tests, effort, hardest, missedInExplain };
}

function pct(a: number, b: number) {
  return b ? `${Math.round((100 * a) / b)}%` : '—';
}

export function Teacher() {
  const [files, setFiles] = useState<{ name: string; log: LogFile }[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [filter, setFilter] = useState<ModeFilter>('all');
  const [openTests, setOpenTests] = useState<string | null>(null);

  const logs = files.map((f) => f.log);
  const board = useMemo(() => aggregate(logs, filter), [files, filter]);
  const learners = new Set(logs.map((l) => l.nickname)).size;
  const events = logs.reduce((a, l) => a + l.events.length, 0);
  const maxCount = board.ranked[0]?.count ?? 1;
  const hasDemo = logs.some((l) => l.demo);

  const load = async (list: FileList | null) => {
    if (!list) return;
    const errs: string[] = [];
    const added: { name: string; log: LogFile }[] = [];
    for (const file of Array.from(list)) {
      try {
        added.push({ name: file.name, log: parseLogFile(await file.text()) });
      } catch (e) {
        errs.push(`${file.name}: ${(e as Error).message}`);
      }
    }
    setFiles((f) => [...f, ...added]);
    setErrors(errs);
  };

  return (
    <div class="page">
      <PageHead kicker="Teacher view" title="Error board">
        Merge the log files your learners export. The board ranks the misconception codes behind their wrong answers, so the debrief can start with the most common one.
      </PageHead>
      <DesignNote id="teacher" />

      <section class="card loaders">
        <label class="btn btn-primary file-btn">
          Load learner logs (.json)
          <input type="file" accept="application/json,.json" multiple onChange={(e) => load((e.target as HTMLInputElement).files)} />
        </label>
        <button class="btn" onClick={() => setFiles((f) => [...f.filter((x) => !x.log.demo), ...demoLogs().map((log) => ({ name: `${log.nickname} (demo)`, log }))])}>
          Load demo data
        </button>
        <button class="btn" onClick={() => setFiles((f) => [...f, { name: 'This browser', log: buildLogFile() }])}>
          Add this browser’s own log
        </button>
        {files.length > 0 && (
          <button class="btn btn-quiet" onClick={() => setFiles([])}>
            Clear
          </button>
        )}
        {errors.map((e) => (
          <p key={e} class="small bad-text">
            {e}
          </p>
        ))}
      </section>

      {hasDemo && (
        <Callout tone="warn" title="Synthetic demo data">
          <p>The demo learners are invented, to show what the board looks like with a class. These numbers are not results.</p>
        </Callout>
      )}

      {files.length === 0 ? (
        <p class="muted">No logs loaded yet. Try “Load demo data” to see the board.</p>
      ) : (
        <>
          <div class="tiles">
            <div class="tile">
              <div class="tile-n">{learners}</div>
              <div class="tile-l">learners</div>
            </div>
            <div class="tile">
              <div class="tile-n">{events}</div>
              <div class="tile-l">logged events</div>
            </div>
            <div class="tile">
              <div class="tile-n">{pct(board.predictRight, board.predictN)}</div>
              <div class="tile-l">Predict cells right on the first try</div>
            </div>
            <div class="tile">
              <div class="tile-n">
                {board.mastered} / {learners}
              </div>
              <div class="tile-l">reached Predict mastery</div>
            </div>
          </div>

          <section class="card">
            <div class="card-row">
              <h2 class="card-title">Misconceptions, most frequent first</h2>
              <div class="seg" role="group" aria-label="Filter by mode">
                {(['all', 'Watch', 'Predict', 'Build', 'Write', 'Test'] as ModeFilter[]).map((m) => (
                  <button key={m} class={filter === m ? 'seg-on' : ''} aria-pressed={filter === m} onClick={() => setFilter(m)}>
                    {m === 'all' ? 'All modes' : m}
                  </button>
                ))}
              </div>
            </div>
            {board.ranked.length === 0 ? (
              <p class="muted">No coded errors in this mode.</p>
            ) : (
              <ol class="bars">
                {board.ranked.map((r) => (
                  <li key={r.code} class="bar-row" title={`${CODES[r.code].label}: ${r.count} times, ${r.learners.size} learners. ${CODES[r.code].meaning}`}>
                    <div class="bar-label">
                      <span>{CODES[r.code].label}</span>
                      {CODES[r.code].slot && <Badge>{SLOT_LABEL[CODES[r.code].slot!]}</Badge>}
                    </div>
                    <div class="bar-track">
                      <div class="bar-fill" style={{ width: `${(100 * r.count) / maxCount}%` }} />
                    </div>
                    <div class="bar-value">
                      {r.count} <span class="muted small">· {r.learners.size} learner{r.learners.size === 1 ? '' : 's'}</span>
                    </div>
                    <div class="bar-meaning small muted">{CODES[r.code].meaning}</div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {board.ranked.length > 0 && (
            <section class="card">
              <h2 class="card-title">Debrief plan for the first 10 minutes of class</h2>
              <ol class="debrief">
                {board.ranked.slice(0, 3).map((r) => (
                  <li key={r.code}>
                    <b>{CODES[r.code].label}</b> ({r.learners.size} of {learners} learners). {CODES[r.code].meaning}
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section class="card">
            <h2 class="card-title">Self-explanation questions, most missed first</h2>
            <div class="qstats">
              {[...board.questions.entries()]
                .sort((a, b) => a[1].right / a[1].n - b[1].right / b[1].n)
                .map(([id, s]) => {
                  const q = QUESTIONS[id];
                  return (
                    <div key={id} class="qstat">
                      <p>
                        <b>{q.prompt}</b> <span class="muted small">— {pct(s.right, s.n)} right on the first try ({s.n} answers)</span>
                      </p>
                      <ul>
                        {q.options.map((o, k) => (
                          <li key={k} class={o.correct ? 'opt-right' : ''}>
                            <span class="opt-count">{s.choices[k]}</span> {o.correct ? '✓ ' : ''}
                            {o.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
            </div>
          </section>

          <section class="card">
            <h2 class="card-title">Self-reports</h2>
            <div class="two-col">
              <div>
                <div class="kicker">Mental effort, 1–9 (Paas, 1992)</div>
                {board.effort.size === 0 ? (
                  <p class="muted small">No ratings yet.</p>
                ) : (
                  <table class="data">
                    <thead>
                      <tr>
                        <th scope="col">Step</th>
                        <th scope="col">Mean</th>
                        <th scope="col">Ratings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {STEPS.filter((s) => board.effort.has(s.id)).map((s) => {
                        const r = board.effort.get(s.id)!;
                        return (
                          <tr key={s.id}>
                            <td>
                              {s.mode} · {s.title}
                            </td>
                            <td>{(r.sum / r.n).toFixed(1)}</td>
                            <td>{r.n}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
              <div>
                <div class="kicker">Slots learners found hard</div>
                <table class="data">
                  <thead>
                    <tr>
                      <th scope="col">Slot</th>
                      <th scope="col">Hardest, in Reflect</th>
                      <th scope="col">Not “same idea”, in Explain</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SLOTS.map((s) => (
                      <tr key={s}>
                        <td>{SLOT_LABEL[s]}</td>
                        <td>{board.hardest[s]}</td>
                        <td>{board.missedInExplain[s]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section class="card">
            <h2 class="card-title">Unit Check</h2>
            <div class="svg-scroll">
              <table class="data">
                <thead>
                  <tr>
                    <th scope="col">Learner</th>
                    <th scope="col">Pretest form</th>
                    <th scope="col">Trace /4</th>
                    <th scope="col">Posttest form</th>
                    <th scope="col">Trace /4</th>
                    <th scope="col">Open answers</th>
                  </tr>
                </thead>
                <tbody>
                  {board.tests.map((r) => {
                    const pre = r.pre as { form?: string; auto?: { trace: number }; answers?: Record<string, unknown> } | undefined;
                    const post = r.post as typeof pre;
                    return (
                      <Fragment key={r.who}>
                        <tr>
                          <td>{r.who}</td>
                          <td>{pre?.form ?? '—'}</td>
                          <td>{pre?.auto?.trace ?? '—'}</td>
                          <td>{post?.form ?? '—'}</td>
                          <td>{post?.auto?.trace ?? '—'}</td>
                          <td>
                            {(pre || post) && (
                              <button class="btn btn-quiet" onClick={() => setOpenTests(openTests === r.who ? null : r.who)}>
                                {openTests === r.who ? 'Hide' : 'Show'}
                              </button>
                            )}
                          </td>
                        </tr>
                        {openTests === r.who && (
                          <tr>
                            <td colSpan={6}>
                              {[pre, post].map((t, k) =>
                                t?.answers ? (
                                  <div key={k} class="open-answers">
                                    <div class="kicker">
                                      {k === 0 ? 'Pretest' : 'Posttest'} · form {t.form}
                                    </div>
                                    <p>
                                      <b>Explain a:</b> {String(t.answers.explain1 ?? '')} <span class="muted small">Rubric: {RUBRIC.explain1[t.form as 'A' | 'B']}</span>
                                    </p>
                                    <p>
                                      <b>Explain b:</b> {String(t.answers.explain2 ?? '')} <span class="muted small">Rubric: {RUBRIC.explain2[t.form as 'A' | 'B']}</span>
                                    </p>
                                    {'debugFix' in t.answers && (
                                      <p>
                                        <b>Debug fix:</b> <code>{String(t.answers.debugFix)}</code> <span class="muted small">Rubric: {RUBRIC.debugFix[t.form as 'A' | 'B']}</span>
                                      </p>
                                    )}
                                  </div>
                                ) : null,
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p class="small muted">{RUBRIC.scale}</p>
          </section>
        </>
      )}
    </div>
  );
}
