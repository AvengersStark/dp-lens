// The one-array view: dp[0..W] as a single row. Arcs above show what a cell reads;
// the line below each cell lists the items that built its value, so a reused item in
// the 0/1 knapsack shows up as "1×2".

import { useId } from 'preact/hooks';
import { Arrowheads, type CellProps, type Tone, cellAria } from './DPTable';

export interface ArcArrow {
  from: number;
  to: number;
  kind: 'skip' | 'take' | 'bad';
  label?: string;
}

interface Props extends Omit<CellProps, 'value' | 'tones' | 'sub' | 'badge' | 'onCell' | 'clickable'> {
  W: number;
  value: (j: number) => string | null;
  tones?: (j: number) => Tone[];
  sub?: (j: number) => string | undefined;
  badge?: (j: number) => string | undefined;
  items?: (j: number) => { text: string; reuse: boolean } | null;
  onCell?: (j: number) => void;
  clickable?: (j: number) => boolean;
  arrows?: ArcArrow[];
  pointer?: number | null;
  title: string;
}

const LABEL_W = 64;
const TOP = 78;
const CW = 54;
const CH = 44;
const GX = 8;
const PAD = 8;

const x0 = (j: number) => LABEL_W + j * (CW + GX);
const cx = (j: number) => x0(j) + CW / 2;

function arc(a: ArcArrow): { d: string; lx: number; ly: number } {
  if (a.from === a.to) {
    const c = cx(a.to);
    return { d: `M${c + 4},${TOP} C${c + 2},${TOP - 24} ${c + 22},${TOP - 24} ${c + 17},${TOP - 2}`, lx: c + 12, ly: TOP - 24 };
  }
  const xs = cx(a.from);
  const xt = cx(a.to) - 12;
  const h = Math.min(TOP - 14, 26 + 9 * Math.abs(a.to - a.from));
  return { d: `M${xs},${TOP} C${xs},${TOP - h} ${xt},${TOP - h} ${xt},${TOP - 2}`, lx: (xs + xt) / 2, ly: TOP - 0.75 * h - 4 };
}

export function DPArray(p: Props) {
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const cols = Array.from({ length: p.W + 1 }, (_, j) => j);
  const width = LABEL_W + (p.W + 1) * (CW + GX) - GX + PAD;
  const height = TOP + CH + 56;
  const yNum = TOP + CH + 20;
  const yItems = TOP + CH + 42;

  return (
    <div class="svg-scroll">
      <svg class="dp-svg" viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="group" aria-label={p.title}>
        <Arrowheads uid={uid} />
        <text class="row-main" x={LABEL_W - 12} y={TOP + CH / 2 + 5} text-anchor="end">
          dp
        </text>
        <text class="row-sub" x={LABEL_W - 12} y={yNum} text-anchor="end">
          j
        </text>
        {p.items && (
          <text class="row-sub" x={LABEL_W - 12} y={yItems} text-anchor="end">
            items
          </text>
        )}
        {cols.map((j) => {
          const value = p.value(j);
          const tones = [...(p.tones?.(j) ?? []), ...(value === null ? (['empty'] as Tone[]) : [])];
          const sub = p.sub?.(j);
          const badge = p.badge?.(j);
          const clickable = !!p.onCell && (p.clickable ? p.clickable(j) : true);
          const act = () => clickable && p.onCell!(j);
          const it = p.items?.(j);
          return (
            <g key={j}>
              <g
                class={`cell ${tones.map((t) => `t-${t}`).join(' ')}${clickable ? ' clickable' : ''}`}
                transform={`translate(${x0(j)},${TOP})`}
                role={clickable ? 'button' : undefined}
                tabIndex={clickable ? 0 : undefined}
                aria-label={cellAria(null, j, value, tones)}
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
              <text class={p.pointer === j ? 'axis-num pointer' : 'axis-num'} x={cx(j)} y={yNum} text-anchor="middle">
                {p.pointer === j ? `▲ ${j}` : j}
              </text>
              {it && (
                <text class={it.reuse ? 'items-text reuse' : 'items-text'} x={cx(j)} y={yItems} text-anchor="middle">
                  {it.text}
                </text>
              )}
            </g>
          );
        })}
        {(p.arrows ?? []).map((a, k) => {
          const r = arc(a);
          return (
            <g key={k} class={`arrow arrow-${a.kind}`}>
              <path d={r.d} marker-end={`url(#${uid}-${a.kind})`} />
              {a.label && (
                <text class="arrow-label" x={r.lx} y={r.ly} text-anchor="middle">
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
