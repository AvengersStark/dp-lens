// The five-slot spec card: the subgoal labels every mode is organized around.

import type { ComponentChildren } from 'preact';
import { SLOTS, SLOT_LABEL, SLOT_QUESTION, type Slot } from '../lib/codes';
import type { Instance } from '../lib/knapsack';
import { Term } from './ui';

export type SlotStatus = 'active' | 'ok' | 'bad' | undefined;

const TERM: Record<Slot, 'state' | 'base' | 'transition' | 'order' | 'answer'> = {
  state: 'state',
  base: 'base',
  transition: 'transition',
  order: 'order',
  answer: 'answer',
};

export function SpecCard({
  content,
  status,
  title = 'Spec card',
  showQuestions = false,
}: {
  content: Partial<Record<Slot, ComponentChildren>>;
  status?: Partial<Record<Slot, SlotStatus>>;
  title?: string;
  showQuestions?: boolean;
}) {
  return (
    <section class="card spec-card" aria-label={title}>
      <h2 class="card-title">{title}</h2>
      <ol class="slots">
        {SLOTS.map((s) => {
          const st = status?.[s];
          return (
            <li key={s} class={`slot${st ? ` slot-${st}` : ''}`}>
              <div class="slot-label">
                <Term k={TERM[s]}>{SLOT_LABEL[s]}</Term>
                {st === 'ok' && <span class="slot-mark" aria-label="correct">✓</span>}
                {st === 'bad' && <span class="slot-mark" aria-label="needs work">✗</span>}
              </div>
              {showQuestions && <div class="slot-q">{SLOT_QUESTION[s]}</div>}
              <div class="slot-body">{content[s] ?? <span class="muted">—</span>}</div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function ItemList({ inst, active, note }: { inst: Instance; active?: number | null; note?: ComponentChildren }) {
  return (
    <section class="card" aria-label="Items">
      <h2 class="card-title">
        <Term k="item">Items</Term> · <Term k="capacity">capacity</Term> W = {inst.W}
      </h2>
      <table class="items">
        <thead>
          <tr>
            <th scope="col">item</th>
            <th scope="col">
              <Term k="weight">weight</Term> w
            </th>
            <th scope="col">
              <Term k="value">value</Term> v
            </th>
          </tr>
        </thead>
        <tbody>
          {inst.items.map((it, k) => (
            <tr key={k} class={active === k + 1 ? 'active' : undefined}>
              <td>{k + 1}</td>
              <td>{it.w}</td>
              <td>{it.v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {note && <p class="small muted">{note}</p>}
    </section>
  );
}
