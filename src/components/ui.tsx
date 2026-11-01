import type { ComponentChildren } from 'preact';
import { GLOSSARY, type TermKey } from '../lib/glossary';
import type { StepInfo } from '../lib/store';

/** Text with `code` spans written in backticks. */
export function Rich({ text }: { text: string }) {
  const parts = text.split('`');
  return <>{parts.map((p, k) => (k % 2 ? <code key={k}>{p}</code> : p))}</>;
}

/** A glossary term: dotted underline, definition on hover and keyboard focus. */
export function Term({ k, children }: { k: TermKey; children: ComponentChildren }) {
  return (
    <span class="term" tabIndex={0}>
      {children}
      <span class="term-tip" role="tooltip">
        {GLOSSARY[k]}
      </span>
    </span>
  );
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'accent' | 'good' | 'bad' | 'warn'; children: ComponentChildren }) {
  return <span class={`badge badge-${tone}`}>{children}</span>;
}

export type FeedbackTone = 'good' | 'bad' | 'info' | 'warn';

const ICON: Record<FeedbackTone, string> = { good: '✓', bad: '✗', info: 'i', warn: '!' };

export function Callout({ tone, title, children }: { tone: FeedbackTone; title?: string; children?: ComponentChildren }) {
  return (
    <div class={`callout callout-${tone}`} role={tone === 'bad' || tone === 'good' ? 'status' : undefined}>
      <span class="callout-icon" aria-hidden="true">
        {ICON[tone]}
      </span>
      <div class="callout-body">
        {title && <div class="callout-title">{title}</div>}
        {children}
      </div>
    </div>
  );
}

/** The link to the next released step, or a note that this version ends here. */
export function NextLink({ next }: { next: StepInfo | null }) {
  if (!next) {
    return (
      <p class="small">
        This is the last step in this version of DP Lens. <a href="#/">Back to the unit path</a>
      </p>
    );
  }
  return (
    <a class="btn btn-primary" href={next.route}>
      Next: {next.title} →
    </a>
  );
}

export function PageHead({ kicker, title, children }: { kicker: string; title: string; children?: ComponentChildren }) {
  return (
    <header class="page-head">
      <div class="kicker">{kicker}</div>
      <h1>{title}</h1>
      {children && <p class="lede">{children}</p>}
    </header>
  );
}
