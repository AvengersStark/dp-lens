import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { downloadLog } from './lib/log';
import { PAGE_OPENS_IN, STAGE, opensIn, pageReleased, stageLabel } from './lib/stage';
import { type StepId, STEPS, isUnlocked, setState, useAppState } from './lib/store';
import { Build } from './pages/Build';
import { ExplainCard } from './pages/ExplainCard';
import { Home } from './pages/Home';
import { LessonPlan } from './pages/LessonPlan';
import { Predict } from './pages/Predict';
import { Reflect } from './pages/Reflect';
import { Teacher } from './pages/Teacher';
import { UnitCheck } from './pages/UnitCheck';
import { Watch } from './pages/Watch';
import { Write } from './pages/Write';

const ROUTES: Record<string, { step?: StepId; page?: keyof typeof PAGE_OPENS_IN; view: () => ComponentChildren }> = {
  '#/': { view: () => <Home /> },
  '#/check/pre': { step: 'pre', view: () => <UnitCheck phase="pre" /> },
  '#/watch': { step: 'p1-watch', view: () => <Watch /> },
  '#/predict/table': { step: 'p1-predict', view: () => <Predict view="2d" /> },
  '#/predict/array': { step: 'p2-predict', view: () => <Predict view="1d" /> },
  '#/build/table': { step: 'p1-build', view: () => <Build id="zo2d" /> },
  '#/explain': { step: 'p1-explain', view: () => <ExplainCard /> },
  '#/write/table': { step: 'p1-write', view: () => <Write id="table" /> },
  '#/write/array': { step: 'p2-write', view: () => <Write id="array" /> },
  '#/build/complete': { step: 'p3-build', view: () => <Build id="complete" /> },
  '#/write/complete': { step: 'p3-write', view: () => <Write id="complete" /> },
  '#/reflect': { step: 'reflect', view: () => <Reflect /> },
  '#/check/post': { step: 'post', view: () => <UnitCheck phase="post" /> },
  '#/lesson': { page: 'lesson', view: () => <LessonPlan /> },
  '#/teacher': { page: 'teacher', view: () => <Teacher /> },
};

function useHash(): string {
  const [hash, setHash] = useState(location.hash || '#/');
  useEffect(() => {
    const on = () => {
      setHash(location.hash || '#/');
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

function NotYet({ milestone }: { milestone: number }) {
  return (
    <div class="page narrow">
      <h1>This part opens in Milestone {milestone}</h1>
      <p>This is the {stageLabel()} of DP Lens. The unit is released in stages, following the project plan.</p>
      <a class="btn btn-primary" href="#/">
        Back to the unit path
      </a>
    </div>
  );
}

function Gate({ step, children }: { step: StepId; children: ComponentChildren }) {
  const app = useAppState();
  if (opensIn(step) > STAGE) return <NotYet milestone={opensIn(step)} />;
  if (!app.nickname) {
    return (
      <div class="page narrow">
        <h1>Type a nickname first</h1>
        <p>DP Lens saves your progress under a nickname in this browser. No account is needed.</p>
        <a class="btn btn-primary" href="#/">
          Go to the start page
        </a>
      </div>
    );
  }
  if (!isUnlocked(app, step)) {
    const k = STEPS.findIndex((s) => s.id === step);
    const prev = STEPS[k - 1];
    return (
      <div class="page narrow">
        <h1>This step is locked</h1>
        <p>
          Finish <b>{prev.title}</b> first ({prev.problem}). Reviewers can turn on the reviewer pass on the start page to open every step.
        </p>
        <div class="controls">
          <a class="btn btn-primary" href={prev.route}>
            Go to {prev.title}
          </a>
          <a class="btn" href="#/">
            Start page
          </a>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

const THEMES = ['auto', 'light', 'dark'] as const;

export function App() {
  const app = useAppState();
  const hash = useHash();
  const route = ROUTES[hash] ?? ROUTES['#/'];

  useEffect(() => {
    const root = document.documentElement;
    if (app.theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', app.theme);
  }, [app.theme]);

  return (
    <>
      <a class="skip-link" href="#main">
        Skip to content
      </a>
      <header class="topbar">
        <a class="brand" href="#/">
          <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
            <rect width="32" height="32" rx="7" class="brand-bg" />
            <g fill="none" stroke="currentColor" stroke-width="2" class="brand-fg">
              <rect x="6" y="6" width="9" height="9" rx="1.5" />
              <rect x="17" y="6" width="9" height="9" rx="1.5" />
              <rect x="6" y="17" width="9" height="9" rx="1.5" />
            </g>
            <rect x="17" y="17" width="9" height="9" rx="1.5" class="brand-dot" />
          </svg>
          DP Lens
        </a>
        <nav class="nav" aria-label="Main">
          <a href="#/" aria-current={hash === '#/' ? 'page' : undefined}>
            Unit path
          </a>
          {pageReleased('lesson') && (
            <a href="#/lesson" aria-current={hash === '#/lesson' ? 'page' : undefined}>
              Lesson plan
            </a>
          )}
          {pageReleased('teacher') && (
            <a href="#/teacher" aria-current={hash === '#/teacher' ? 'page' : undefined}>
              Teacher view
            </a>
          )}
        </nav>
        <div class="topbar-right">
          {app.nickname && <span class="nick">{app.nickname}</span>}
          <button class="btn btn-quiet" onClick={() => setState({ theme: THEMES[(THEMES.indexOf(app.theme) + 1) % THEMES.length] })} title="Switch between automatic, light and dark">
            Theme: {app.theme}
          </button>
          <button class="btn" onClick={downloadLog}>
            Export log
          </button>
        </div>
      </header>
      <main id="main">
        {route.page && !pageReleased(route.page) ? (
          <NotYet milestone={PAGE_OPENS_IN[route.page]} />
        ) : route.step ? (
          <Gate step={route.step}>{route.view()}</Gate>
        ) : (
          route.view()
        )}
      </main>
      <footer class="footer">
        <span>DP Lens · a CS6460 prototype · knapsack unit · {stageLabel()}</span>
        <span>No account, no tracking: your data stays in this browser until you export it.</span>
      </footer>
    </>
  );
}
