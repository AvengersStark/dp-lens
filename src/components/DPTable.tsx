// The DP table as SVG: rows are items 0..n, columns are capacities 0..W. Dependency
// arrows run through the gap between rows, so they never cover a number.

import { useId } from 'preact/hooks';
import type { Instance } from '../lib/knapsack';

export type Tone = 'empty' | 'target' | 'skip' | 'take' | 'selected' | 'wrong' | 'root' | 'answer' | 'ok' | 'fresh' | 'new' | 'chain' | 'reuse';

export interface Arrow {
  from: number[];
  to: number[];
  kind: 'skip' | 'take' | 'bad';
  label?: string;
}

export interface CellProps {
  value: (i: number, j: number) => string | null;
  tones?: (i: number, j: number) => Tone[];
  sub?: (i: number, j: number) => string | undefined;
  badge?: (i: number, j: number) => string | undefined;
  onCell?: (i: number, j: number) => void;
  clickable?: (i: number, j: number) => boolean;
}

interface Props extends CellProps {
  inst: Instance;
  arrows?: Arrow[];
  activeRow?: number | null;
  title: string;
}

const LABEL_W = 112;
const HEAD_H = 48;
const CW = 54;
const CH = 42;
const GX = 8;
const GY = 30;
const PAD = 8;
/** Room on the right for the label of a skip arrow in the last column. */
const RIGHT_PAD = 40;

const x0 = (j: number) => LABEL_W + j * (CW + GX);
const cx = (j: number) => x0(j) + CW / 2;
const y0 = (i: number) => HEAD_H + i * (CH + GY);

function route(a: Arrow): { d: string; lx: number; ly: number; anchor: 'start' | 'middle' } {
  const [r1, c1] = a.from;
  const [r2, c2] = a.to;
  if (r1 === r2 - 1 && c1 === c2) {
    const x = cx(c2) + 12;
    return { d: `M${x},${y0(r1) + CH} L${x},${y0(r2) - 2}`, lx: x + 6, ly: y0(r1) + CH + GY / 2 + 4, anchor: 'start' };
  }
  if (r1 === r2 - 1 && c1 < c2) {
    const xs = cx(c1);
    const xt = cx(c2) - 12;
    const yc = y0(r1) + CH + GY / 2;
    return { d: `M${xs},${y0(r1) + CH} L${xs},${yc} L${xt},${yc} L${xt},${y0(r2) - 2}`, lx: (xs + xt) / 2, ly: yc + 4, anchor: 'middle' };
  }
  if (r1 === r2 && c1 < c2) {
    const xs = cx(c1);
    const xt = cx(c2) - 12;
    const yc = y0(r2) - GY + 9;
    return { d: `M${xs},${y0(r2)} L${xs},${yc} L${xt},${yc} L${xt},${y0(r2) - 2}`, lx: (xs + xt) / 2, ly: yc + 4, anchor: 'middle' };
  }
  const xs = cx(c1);
  const xt = cx(c2);
  const ys = y0(r1) + CH;
  const yt = y0(r2) - 2;
  return { d: `M${xs},${ys} L${xt},${yt}`, lx: (xs + xt) / 2 + 6, ly: (ys + yt) / 2, anchor: 'start' };
}

export function Arrowheads({ uid }: { uid: string }) {
  return (
    <defs>
      {(['skip', 'take', 'bad'] as const).map((k) => (
        <marker key={k} id={`${uid}-${k}`} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" class={`ah ah-${k}`} />
        </marker>
      ))}
    </defs>
  );
}

export function cellAria(i: number | null, j: number, value: string | null, tones: Tone[]): string {
  const name = i === null ? `dp[${j}]` : `dp[${i}][${j}]`;
  const what = tones.includes('target') ? 'the cell to predict' : value === null || value === '' ? 'empty' : value;
  const extra = tones.includes('selected') ? ', marked as a dependency' : tones.includes('wrong') || tones.includes('root') ? ', wrong' : '';
  return `${name}: ${what}${extra}`;
}

export function DPTable(p: Props) {
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const n = p.inst.items.length;
  const W = p.inst.W;
  const width = LABEL_W + (W + 1) * (CW + GX) - GX + RIGHT_PAD;
  const height = HEAD_H + (n + 1) * (CH + GY) - GY + PAD;
  const cols = Array.from({ length: W + 1 }, (_, j) => j);
  const rows = Array.from({ length: n + 1 }, (_, i) => i);

  return (
    <div class="svg-scroll">
      <svg class="dp-svg" viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="group" aria-label={p.title}>
        <Arrowheads uid={uid} />
        <text class="axis-title" x={x0(0)} y={16}>
          capacity j →
        </text>
        {cols.map((j) => (
          <text key={j} class="axis-num" x={cx(j)} y={38} text-anchor="middle">
            {j}
          </text>
        ))}
        {rows.map((i) => {
          const yc = y0(i) + CH / 2;
          const active = p.activeRow === i;
          return (
            <g key={i} class={active ? 'row-label active' : 'row-label'}>
              <text class="row-main" x={LABEL_W - 12} y={yc - 3} text-anchor="end">
                {i === 0 ? 'no items' : `item ${i}`}
              </text>
              <text class="row-sub" x={LABEL_W - 12} y={yc + 13} text-anchor="end">
                {i === 0 ? 'i = 0' : `w ${p.inst.items[i - 1].w} · v ${p.inst.items[i - 1].v}`}
              </text>
            </g>
          );
        })}
        {rows.map((i) =>
          cols.map((j) => {
            const value = p.value(i, j);
            const tones = [...(p.tones?.(i, j) ?? []), ...(value === null ? (['empty'] as Tone[]) : [])];
            const sub = p.sub?.(i, j);
            const badge = p.badge?.(i, j);
            const clickable = !!p.onCell && (p.clickable ? p.clickable(i, j) : true);
            const act = () => clickable && p.onCell!(i, j);
            return (
              <g
                key={`${i},${j}`}
                class={`cell ${tones.map((t) => `t-${t}`).join(' ')}${clickable ? ' clickable' : ''}`}
                transform={`translate(${x0(j)},${y0(i)})`}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                aria-label={cellAria(i, j, value, tones)}
                aria-pressed={clickable ? tones.includes('selected') : undefined}
                onClick={act}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    act();
                  }
                }}
              >
                <rect width={CW} height={CH} rx={7} />
                <text class="cell-value" x={CW / 2} y={sub ? 21 : 28} text-anchor="middle">
                  {value ?? ''}
                </text>
                {sub && (
                  <text class="cell-sub" x={CW / 2} y={CH - 7} text-anchor="middle">
                    {sub}
                  </text>
                )}
                {tones.includes('selected') && (
                  <text class="cell-tick" x={CW - 7} y={13} text-anchor="middle">
                    ✓
                  </text>
                )}
                {badge && (
                  <g class="cell-badge">
                    <circle cx={0} cy={0} r={10} />
                    <text x={0} y={4} text-anchor="middle">
                      {badge}
                    </text>
                  </g>
                )}
              </g>
            );
          }),
        )}
        {(p.arrows ?? []).map((a, k) => {
          const r = route(a);
          return (
            <g key={k} class={`arrow arrow-${a.kind}`}>
              <path d={r.d} marker-end={`url(#${uid}-${a.kind})`} />
              {a.label && (
                <text class="arrow-label" x={r.lx} y={r.ly} text-anchor={r.anchor}>
                  {a.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
