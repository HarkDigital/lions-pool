"use client";

// ---------------------------------------------------------------------------
// Season movement graph: a bump chart of rank week by week.
// Built to the dataviz method: entity-fixed CVD-validated series colors
// (each player's avatarColor), 2px lines, 8px markers with a 2px surface
// ring, direct name labels in text tokens (never series-colored text),
// recessive axes, and a hover tooltip on every node. The Nums table below
// the chart is the table view.
// ---------------------------------------------------------------------------

import { useRef, useState } from "react";
import type { WeekRanks } from "@/lib/scoring";
import { fmtPts, ordinal, signedPts } from "@/lib/format";

export interface GraphPlayer {
  id: string;
  label: string; // public nickname, never a real name
  color: string;
}

interface Tip {
  /** Pixel position of the hovered dot inside the scroll wrapper. */
  px: number;
  py: number;
  /** Render the panel to the left of the dot when it sits near the right edge. */
  flip: boolean;
  label: string;
  week: number;
  rank: number;
  weekPts?: number;
  total: number;
}

const CELL_H = 34; // vertical px per rank slot
const CELL_W = 96; // horizontal px per week
const PAD_L = 44;
const PAD_R = 148; // room for the name-label column
const PAD_T = 14;
const PAD_B = 30;

export function SeasonGraph({
  players,
  progression,
}: {
  players: GraphPlayer[];
  progression: WeekRanks[];
}) {
  const [tip, setTip] = useState<Tip | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  if (progression.length === 0 || players.length === 0) return null;

  /** Anchor the tooltip to the hovered dot's rendered position, scroll included. */
  const showTip = (e: React.MouseEvent<SVGCircleElement>, data: Omit<Tip, "px" | "py" | "flip">) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const dot = e.currentTarget.getBoundingClientRect();
    const box = wrap.getBoundingClientRect();
    const px = dot.left - box.left + dot.width / 2 + wrap.scrollLeft;
    const py = dot.top - box.top + dot.height / 2 + wrap.scrollTop;
    setTip({ ...data, px, py, flip: dot.left - box.left > wrap.clientWidth * 0.62 });
  };

  const n = players.length;
  const weeks = progression.map((p) => p.week);
  const plotW = Math.max(1, weeks.length - 1) * CELL_W;
  const plotH = (n - 1) * CELL_H;
  const width = PAD_L + plotW + PAD_R;
  const height = PAD_T + plotH + PAD_B;

  const x = (wi: number) => PAD_L + wi * CELL_W;
  const yRank = (rank: number) => PAD_T + (rank - 1) * CELL_H;

  // Ties share a rank, so their nodes share a y. Nudge co-ranked nodes a few
  // px apart (stable order = players array order) so both stay visible; the
  // 2px surface ring separates any remaining overlap.
  const jitter = new Map<string, number>(); // `${week}:${playerId}` -> dy
  for (const col of progression) {
    const byRank = new Map<number, string[]>();
    for (const p of players) {
      const r = col.ranks[p.id]?.rank;
      if (r == null) continue;
      if (!byRank.has(r)) byRank.set(r, []);
      byRank.get(r)!.push(p.id);
    }
    for (const ids of byRank.values()) {
      if (ids.length < 2) continue;
      ids.forEach((id, i) => jitter.set(`${col.week}:${id}`, i * 7 - ((ids.length - 1) * 7) / 2));
    }
  }

  const nodeY = (week: number, id: string, rank: number) =>
    yRank(rank) + (jitter.get(`${week}:${id}`) ?? 0);

  // Label column: one slot per player, ordered by final-week rank (then by
  // players order), evenly spaced over the plot height so tied players still
  // get separate, readable rows.
  const last = progression[progression.length - 1];
  const labelOrder = [...players].sort(
    (a, b) => (last.ranks[a.id]?.rank ?? n) - (last.ranks[b.id]?.rank ?? n),
  );
  const labelY = (slot: number) => PAD_T + (n === 1 ? 0 : (slot * plotH) / (n - 1));

  return (
    <div ref={wrapRef} className="table-scroll relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ minWidth: width * 0.8, maxWidth: width * 1.4 }}
        role="img"
        aria-label={`Rank by week for all ${n} players. The Nums table below carries the same data.`}
      >
        {/* Recessive rank gridlines + axis labels */}
        {Array.from({ length: n }, (_, i) => i + 1).map((r) => (
          <g key={r}>
            <line
              x1={PAD_L - 6}
              x2={PAD_L + plotW}
              y1={yRank(r)}
              y2={yRank(r)}
              stroke="var(--color-edge)"
              strokeWidth={1}
            />
            <text
              x={PAD_L - 12}
              y={yRank(r) + 4}
              textAnchor="end"
              fontSize={11}
              fill="var(--color-fog)"
            >
              {ordinal(r)}
            </text>
          </g>
        ))}

        {/* Week axis */}
        {weeks.map((w, wi) => (
          <text
            key={w}
            x={x(wi)}
            y={height - 8}
            textAnchor="middle"
            fontSize={11}
            fontWeight={700}
            fill="var(--color-fog)"
          >
            {`Wk ${w}`}
          </text>
        ))}

        {/* Series lines (2px), then markers (8px + 2px surface ring) */}
        {players.map((p) => {
          const pts = progression
            .map((col, wi) => {
              const r = col.ranks[p.id];
              return r ? { wi, week: col.week, ...r } : null;
            })
            .filter(Boolean) as Array<{ wi: number; week: number; rank: number; total: number; weekPts?: number }>;
          if (pts.length === 0) return null;
          const path = pts
            .map((pt, i) => `${i === 0 ? "M" : "L"}${x(pt.wi)},${nodeY(pt.week, p.id, pt.rank)}`)
            .join(" ");
          return (
            <g key={p.id}>
              <path d={path} fill="none" stroke={p.color} strokeWidth={2} strokeLinejoin="round" />
              {pts.map((pt) => {
                const cy = nodeY(pt.week, p.id, pt.rank);
                return (
                  <g key={pt.week}>
                    <circle cx={x(pt.wi)} cy={cy} r={5} fill={p.color} stroke="var(--color-panel)" strokeWidth={2} />
                    {/* Oversized invisible hit target for the tooltip */}
                    <circle
                      cx={x(pt.wi)}
                      cy={cy}
                      r={13}
                      fill="transparent"
                      onMouseEnter={(e) =>
                        showTip(e, {
                          label: p.label,
                          week: pt.week,
                          rank: pt.rank,
                          weekPts: pt.weekPts,
                          total: pt.total,
                        })
                      }
                      onMouseLeave={() => setTip(null)}
                    />
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Direct label column at the right edge (the legend). Text wears
            text tokens; the colored dot + connector carry identity. */}
        {labelOrder.map((p, slot) => {
          const lastPt = last.ranks[p.id];
          if (!lastPt) return null;
          const fromY = nodeY(last.week, p.id, lastPt.rank);
          const toY = labelY(slot);
          const lx = x(weeks.length - 1);
          return (
            <g key={p.id}>
              <path
                d={`M${lx + 8},${fromY} C${lx + 26},${fromY} ${lx + 26},${toY} ${lx + 40},${toY}`}
                fill="none"
                stroke={p.color}
                strokeWidth={1.5}
                opacity={0.7}
              />
              <circle cx={lx + 46} cy={toY} r={4} fill={p.color} />
              <text x={lx + 55} y={toY + 4} fontSize={12} fontWeight={600} fill="var(--color-silver)">
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>

      {tip && (
        <div
          className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border border-edge-2 bg-panel-2 px-3 py-2 text-xs shadow-lg"
          style={{
            left: tip.flip ? tip.px - 14 : tip.px + 14,
            top: tip.py,
            transform: `translateY(-50%)${tip.flip ? " translateX(-100%)" : ""}`,
          }}
        >
          <div className="font-bold text-chalk">{tip.label}</div>
          <div className="text-fog">
            {`Wk ${tip.week}: ${ordinal(tip.rank)}`}
            {tip.weekPts != null && ` (${signedPts(tip.weekPts)} that week)`}
          </div>
          <div className="text-silver">{`${fmtPts(tip.total)} pts total`}</div>
        </div>
      )}
    </div>
  );
}
