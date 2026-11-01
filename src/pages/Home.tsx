// Start page: type a nickname, then follow the unit path. No account.

import { Fragment } from 'preact';
import { useState } from 'preact/hooks';
import { DesignNote } from '../components/DesignNote';
import { Badge, Callout } from '../components/ui';
import { clearLog, logEvent } from '../lib/log';
import { PHASES, STEPS, SUPPORT, isUnlocked, resetProgress, setState, useAppState } from '../lib/store';

const FADING: { mode: 'Watch' | 'Predict' | 'Build' | 'Write'; what: string; engagement: string }[] = [
  { mode: 'Watch', what: 'You study a solved table, step by step.', engagement: 'viewing, self-explaining' },
  { mode: 'Predict', what: 'You fill one paused cell and name what it reads.', engagement: 'responding' },
  { mode: 'Build', what: 'You assemble the whole card from blocks.', engagement: 'constructing, with traps' },
  { mode: 'Write', what: 'You type the rule yourself and it runs.', engagement: 'constructing from scratch' },
];

function SupportDots({ level }: { level: number }) {
  return (
    <span class="support-dots" aria-label={`support level ${level} of 4`} title={`Support: ${level} of 4`}>
      {[1, 2, 3, 4].map((x) => (
        <span key={x} class={x <= level ? 'sd on' : 'sd'} />
      ))}
    </span>
  );
}

function FruitFeast() {
  return (
    <li class="step external">
      <span class="step-n" aria-hidden="true">
        ↗
      </span>
      <div class="step-body">
        <div class="step-top">
          <Badge>Contest problem</Badge>
          <span class="small muted">· about 25 min</span>
        </div>
        <div class="step-title">Solve Fruit Feast on the USACO judge</div>
        <div class="small muted">USACO 2015 December, Gold. A knapsack variant; write your spec card before you code.</div>
      </div>
      <a class="btn" href="https://usaco.org/index.php?page=viewproblem2&cpid=574" target="_blank" rel="noopener">
        Open problem
      </a>
    </li>
  );
}

export function Home() {
  const app = useAppState();
  const [name, setName] = useState(app.nickname);
  const [confirmReset, setConfirmReset] = useState(false);

  const start = (e: Event) => {
    e.preventDefault();
    const nick = name.trim().slice(0, 40);
    if (!nick) return;
    setState({ nickname: nick });
    logEvent('session_start', 'home', { nickname: nick, userAgent: navigator.userAgent });
  };

  const doneCount = STEPS.filter((s) => app.done[s.id]).length;

  return (
    <div class="page">
      <section class="hero">
        <div>
          <div class="kicker">A step-based tutor for knapsack dynamic programming</div>
          <h1 class="hero-title">See every step of the DP.</h1>
          <p class="lede">
            DP Lens breaks a dynamic program into five slots — state, base case, transition, evaluation order, answer — and checks your reasoning one cell at a time. Support fades as you go: watch,
            predict, build, then write.
          </p>
        </div>
        <form class="card nick-form" onSubmit={start}>
          <label class="field">
            <span class="field-label">{app.nickname ? 'Your nickname' : 'Type a nickname to start'}</span>
            <input value={name} maxLength={40} onInput={(e) => setName((e.target as HTMLInputElement).value)} placeholder="e.g. bessie" autoComplete="nickname" />
          </label>
          <button class="btn btn-primary" type="submit" disabled={!name.trim() || name.trim() === app.nickname}>
            {app.nickname ? 'Change nickname' : 'Start'}
          </button>
          <p class="small muted">No account and no password. Your progress stays in this browser.</p>
        </form>
      </section>

      {app.nickname && (
        <>
          <div class="path-head">
            <h2>Unit path</h2>
            <span class="muted">
              {doneCount} of {STEPS.length} steps done
            </span>
          </div>

          <Callout tone="info" title="Reviewing for CS6460?">
            <p>The unit gates each step behind the one before it (for example, Predict opens the next step only after three cells in a row are right on the first try). Turn on the reviewer pass to open every step at once and to show a short design note on each page.</p>
            <label class="switch">
              <input type="checkbox" checked={app.reviewer} onChange={(e) => setState({ reviewer: (e.target as HTMLInputElement).checked })} />
              <span>Reviewer pass: unlock every step</span>
            </label>
            {app.reviewer && (
              <div class="tour">
                <div class="kicker">A 15-minute tour</div>
                <ol>
                  <li>
                    <a href="#/watch">Watch</a>: press Play; answer one question wrong on purpose.
                  </li>
                  <li>
                    <a href="#/predict/table">Predict cells</a>: make a mistake on purpose, then ask for hints.
                  </li>
                  <li>
                    <a href="#/build/table">Build the spec card</a>: put in a trap block and run the card.
                  </li>
                  <li>
                    <a href="#/write/array">Write the one-array version</a>: try “j from w[i] up to W” first.
                  </li>
                  <li>
                    <a href="#/teacher">Teacher view</a>: load the demo data.
                  </li>
                  <li>
                    <a href="#/lesson">Lesson plan</a>: how the steps fit into the live class.
                  </li>
                </ol>
              </div>
            )}
          </Callout>
          <DesignNote id="home" />

          <section class="fading" aria-label="How support fades">
            <div class="kicker">How support fades</div>
            <ol class="fading-strip">
              {FADING.map((f) => (
                <li key={f.mode}>
                  <div class="fading-mode">
                    {f.mode} <SupportDots level={SUPPORT[f.mode]!} />
                  </div>
                  <div class="small">{f.what}</div>
                  <div class="small muted">{f.engagement}</div>
                </li>
              ))}
            </ol>
          </section>

          {PHASES.map((ph) => (
            <section key={ph.id} class="phase">
              <div class="phase-head">
                <h3>{ph.title}</h3>
                <span class="small muted">{ph.note}</span>
              </div>
              <ol class="path">
                {STEPS.filter((s) => s.phase === ph.id).map((s) => {
                  const k = STEPS.indexOf(s) + 1;
                  const open = isUnlocked(app, s.id);
                  const done = !!app.done[s.id];
                  return (
                    <Fragment key={s.id}>
                    {s.id === 'reflect' && <FruitFeast />}
                    <li class={`step${done ? ' done' : ''}${open ? '' : ' locked'}`}>
                      <span class="step-n" aria-hidden="true">
                        {done ? '✓' : k}
                      </span>
                      <div class="step-body">
                        <div class="step-top">
                          <Badge tone={s.mode === 'Test' ? 'neutral' : 'accent'}>{s.mode}</Badge>
                          {SUPPORT[s.mode] && <SupportDots level={SUPPORT[s.mode]!} />}
                          <span class="small muted">{s.problem}</span>
                          <span class="small muted">· about {s.minutes} min</span>
                        </div>
                        <div class="step-title">{s.title}</div>
                        <div class="small muted">{s.blurb}</div>
                      </div>
                      {open ? (
                        <a class={`btn${done ? '' : ' btn-primary'}`} href={s.route}>
                          {done ? 'Review' : 'Start'}
                          <span class="sr-only"> {s.title}</span>
                        </a>
                      ) : (
                        <span class="locked-note small">Locked: finish step {k - 1} first</span>
                      )}
                    </li>
                    </Fragment>
                  );
                })}
              </ol>
            </section>
          ))}

          <section class="card about">
            <h2 class="card-title">Your data</h2>
            <p class="small">
              Every answer you give is logged in this browser, tagged with the misconception it shows. Use <b>Export log</b> at the top right to save it as a file for your teacher. Nothing is sent
              anywhere.
            </p>
            {!confirmReset ? (
              <button class="btn btn-quiet" onClick={() => setConfirmReset(true)}>
                Reset my progress…
              </button>
            ) : (
              <span class="confirm">
                <span class="small">This clears your progress and your log in this browser.</span>
                <button
                  class="btn"
                  onClick={() => {
                    resetProgress();
                    clearLog();
                    setConfirmReset(false);
                  }}
                >
                  Yes, reset
                </button>
                <button class="btn btn-quiet" onClick={() => setConfirmReset(false)}>
                  Cancel
                </button>
              </span>
            )}
          </section>
        </>
      )}
    </div>
  );
}
