// Shows where a learner's specification goes wrong on its smallest failing instance:
// the wrong cells, the trace from the answer back to the first wrong cell, and the
// slot of the spec card to look at.

import type { Failure } from '../lib/check';
import { CODES, SLOT_LABEL } from '../lib/codes';
import { formatItems, formatValue as f, maxCount } from '../lib/knapsack';
import { type WriteRec, grid } from '../lib/runner';
import { DPArray, type ArcArrow } from './DPArray';
import { DPTable, type Arrow, type Tone } from './DPTable';
import { Callout } from './ui';

function name(dims: 1 | 2, wr: { pass: number; j: number }) {
  return dims === 2 ? `dp[${wr.pass}][${wr.j}]` : `dp[${wr.j}]`;
}

export function InstanceLine({ items, W }: { items: { w: number; v: number }[]; W: number }) {
  return (
    <span class="instance-line">
      {items.map((it, k) => (
        <span key={k} class="chip">
          item {k + 1}: w {it.w}, v {it.v}
        </span>
      ))}
      <span class="chip chip-strong">W = {W}</span>
    </span>
  );
}

export function FailureView({ failure, total, passed }: { failure: Failure; total: number; passed: number }) {
  const r = failure.run;
  const dims = r.spec.dims;
  const focus: WriteRec | null = failure.focus === null ? null : r.writes[failure.focus];
  const chainPos = new Map(failure.chain.map((id, k) => [id, k + 1]));
  const err = r.error;
  const d = failure.diag;

  let picture;
  if (dims === 2) {
    const g = grid(r);
    const arrows: Arrow[] = [];
    if (focus && !focus.base) {
      for (const rd of focus.reads) {
        const sameRow = rd.cell[0] === focus.pass;
        const bad = !r.writes[rd.src].ok || (sameRow && r.kind === 'zeroOne');
        arrows.push({ from: rd.cell, to: [focus.pass, focus.j], kind: bad ? 'bad' : rd.cell[1] === focus.j ? 'skip' : 'take' });
      }
    }
    picture = (
      <DPTable
        inst={r.inst}
        title="Your table on the failing instance"
        value={(i, j) => {
          if (err && err.pass === i && err.j === j) return '!';
          const wr = g[i][j];
          return wr ? f(wr.value) : null;
        }}
        sub={(i, j) => {
          const wr = g[i][j];
          return wr && !wr.ok ? `want ${f(wr.expected)}` : undefined;
        }}
        tones={(i, j) => {
          const out: Tone[] = [];
          const wr = g[i][j];
          if (err && err.pass === i && err.j === j) out.push('root');
          if (err?.read && err.read[0] === i && err.read[1] === j) out.push('wrong');
          if (wr && !wr.ok) out.push(wr.id === failure.focus ? 'root' : 'wrong');
          if (wr && chainPos.has(wr.id)) out.push('chain');
          return out;
        }}
        badge={(i, j) => {
          const wr = g[i][j];
          return wr && failure.chain.length > 1 && chainPos.has(wr.id) ? String(chainPos.get(wr.id)) : undefined;
        }}
        arrows={arrows}
        activeRow={focus?.pass ?? err?.pass ?? null}
      />
    );
  } else {
    // One array: show the array right after the diagnosed write (or at the error).
    const upto = focus ? focus.id + 1 : r.writes.length;
    const val: (WriteRec | null)[] = Array(r.inst.W + 1).fill(null);
    for (const wr of r.writes.slice(0, upto)) val[wr.j] = wr;
    const pass = focus?.pass ?? err?.pass ?? 0;
    const arrows: ArcArrow[] = [];
    if (focus && !focus.base) {
      for (const rd of focus.reads) {
        const src = r.writes[rd.src];
        const fresh = rd.cell[0] !== focus.j && src.pass === focus.pass;
        const kind = rd.cell[0] === focus.j ? 'skip' : (r.kind === 'zeroOne' && fresh) || !src.ok ? 'bad' : 'take';
        arrows.push({ from: rd.cell[0], to: focus.j, kind, label: rd.cell[0] === focus.j ? 'keep' : undefined });
      }
    }
    picture = (
      <>
        <p class="pass-line">
          {focus ? `Just after ${name(1, focus)} was written while processing item ${pass}.` : err ? `While processing item ${pass}.` : 'Final array.'} Shaded cells were
          updated for item {pass}.
        </p>
        <DPArray
          W={r.inst.W}
          title="Your array on the failing instance"
          value={(j) => (err && !focus && err.j === j ? '!' : val[j] ? f(val[j]!.value) : null)}
          sub={(j) => (val[j] && !val[j]!.ok ? `want ${f(val[j]!.expected)}` : undefined)}
          tones={(j) => {
            const out: Tone[] = [];
            const wr = val[j];
            if (wr && wr.pass === pass && !wr.base) out.push('fresh');
            if (wr && !wr.ok) out.push(wr.id === failure.focus ? 'root' : 'wrong');
            if (err && !focus && err.j === j) out.push('root');
            return out;
          }}
          items={(j) => (val[j] ? { text: formatItems(val[j]!.items), reuse: r.kind === 'zeroOne' && maxCount(val[j]!.items) > 1 } : null)}
          pointer={focus?.j ?? err?.j ?? null}
          arrows={arrows}
        />
      </>
    );
  }

  return (
    <div class="failure">
      <Callout tone="bad" title={`Look at: ${SLOT_LABEL[d.slot]} — ${CODES[d.code].label}`}>
        <p>{d.message}</p>
      </Callout>
      <p class="small">
        Passed {passed} of {total} instances. Smallest failing instance (#{failure.index + 1}): <InstanceLine items={r.inst.items} W={r.inst.W} />
      </p>
      {picture}
      {failure.chain.length > 1 && (
        <div class="trace">
          <div class="kicker">Trace from the answer back to the first wrong cell</div>
          <ol>
            {failure.chain.map((id, k) => {
              const wr = r.writes[id];
              return (
                <li key={id}>
                  <code>{name(dims, wr)}</code>
                  {dims === 1 && <span class="muted"> after item {wr.pass}</span>} = {f(wr.value)} <span class="muted">(want {f(wr.expected)})</span>
                  {k === 0 && <span class="small"> — the answer</span>}
                  {k > 0 && k < failure.chain.length - 1 && <span class="small"> — read by the cell above</span>}
                  {k === failure.chain.length - 1 && <b class="small"> — first wrong cell: its inputs were all right</b>}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
