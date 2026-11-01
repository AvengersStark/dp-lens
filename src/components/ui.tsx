import type { ComponentChildren } from 'preact';
import { GLOSSARY, type TermKey } from '../lib/glossary';

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

export function PageHead({ kicker, title, children }: { kicker: string; title: string; children?: ComponentChildren }) {
  return (
    <header class="page-head">
      <div class="kicker">{kicker}</div>
      <h1>{title}</h1>
      {children && <p class="lede">{children}</p>}
    </header>
  );
}
