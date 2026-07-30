"use client";

// ---------------------------------------------------------------------------
// Season standings. Every number on this page is computed live by
// lib/scoring.ts from graded contests — there is no hand-entered table.
// ---------------------------------------------------------------------------

import { Fragment, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { computeStandings, gradeWeek, type SeasonInput } from "@/lib/scoring";
import type { LineItem, StandingsRow, UserWeekGrade } from "@/lib/types";
import {
  CONTESTS,
  CURRENT_WEEK,
  PLAYERS,
  RESULTS,
  SUBMISSIONS,
  participant,
} from "@/lib/demo-data";
import {
  effectiveContests,
  effectiveResults,
  effectiveSubmissions,
  useHydrated,
  useStoreVersion,
} from "@/lib/store";
import { fmtPts, signedPts } from "@/lib/format";
import { Card, EmptyState, Pill, SectionTitle } from "@/components/ui";

// --- Data assembly ----------------------------------------------------------

/**
 * Graded weeks, derived dynamically: contest.status === "graded" AND results
 * exist. Pre-hydration we read only baked demo data so the first client
 * render matches the static HTML; after hydration the store overlays win.
 */
function gradedWeeks(hydrated: boolean): SeasonInput[] {
  const contests = hydrated ? effectiveContests() : CONTESTS;
  const out: SeasonInput[] = [];
  for (const contest of contests) {
    if (contest.status !== "graded") continue;
    const results = hydrated
      ? effectiveResults(contest.week)
      : RESULTS.find((r) => r.week === contest.week);
    if (!results) continue;
    const subs = hydrated
      ? effectiveSubmissions(contest.week)
      : SUBMISSIONS.filter((s) => s.week === contest.week);
    out.push({ contest, results, subs });
  }
  return out.sort((a, b) => a.contest.week - b.contest.week);
}

interface LongshotTally {
  attempts: number;
  hits: number;
}

interface FlavorStats {
  longshots: { total: LongshotTally; leader: { userId: string; tally: LongshotTally } | null };
  bestWeek: { userId: string; week: number; points: number } | null;
  mostBonuses: { userId: string; count: number } | null;
}

/** Winner of a moneyline question, mirroring the grading engine's fallback. */
function moneylineWinner(
  w: SeasonInput,
  qId: string,
  options: { team: string; points: number }[],
): string | null {
  const v = w.results.values[qId];
  if (typeof v === "string") return v;
  const { lionsScore, oppScore } = w.results;
  if (lionsScore == null || oppScore == null || lionsScore === oppScore) return null;
  if (lionsScore > oppScore) return "DET";
  return options.find((o) => o.team !== "DET")?.team ?? null;
}

function computeFlavor(weeks: SeasonInput[], rows: StandingsRow[]): FlavorStats {
  const playerIds = new Set(rows.map((r) => r.userId));

  // Longshots: moneyline options with an uneven divide; the fat side is the dare.
  const total: LongshotTally = { attempts: 0, hits: 0 };
  const byPlayer = new Map<string, LongshotTally>();
  for (const w of weeks) {
    for (const q of w.contest.questions) {
      if (q.kind !== "moneyline" || q.options.length < 2) continue;
      const sorted = [...q.options].sort((a, b) => b.points - a.points);
      if (sorted[0].points === sorted[sorted.length - 1].points) continue; // even money
      const longshot = sorted[0].team;
      const winner = moneylineWinner(w, q.id, q.options);
      for (const sub of w.subs) {
        if (!playerIds.has(sub.userId) || sub.answers[q.id] !== longshot) continue;
        const t = byPlayer.get(sub.userId) ?? { attempts: 0, hits: 0 };
        t.attempts += 1;
        total.attempts += 1;
        if (winner === longshot) {
          t.hits += 1;
          total.hits += 1;
        }
        byPlayer.set(sub.userId, t);
      }
    }
  }
  let leader: FlavorStats["longshots"]["leader"] = null;
  for (const [userId, tally] of byPlayer) {
    if (!leader || tally.attempts > leader.tally.attempts) leader = { userId, tally };
  }

  let bestWeek: FlavorStats["bestWeek"] = null;
  for (const r of rows) {
    for (const w of weeks) {
      const pts = r.weekly[w.contest.week];
      if (pts != null && (!bestWeek || pts > bestWeek.points)) {
        bestWeek = { userId: r.userId, week: w.contest.week, points: pts };
      }
    }
  }

  let mostBonuses: FlavorStats["mostBonuses"] = null;
  for (const r of rows) {
    const count = r.bonuses.closest + r.bonuses.exacto + r.bonuses.perfecto;
    if (count > 0 && (!mostBonuses || count > mostBonuses.count)) {
      mostBonuses = { userId: r.userId, count };
    }
  }

  return { longshots: { total, leader }, bestWeek, mostBonuses };
}

// --- Small pieces -----------------------------------------------------------

function Movement({ rank, prevRank }: { rank: number; prevRank?: number }) {
  if (prevRank == null) return null;
  if (prevRank === rank) {
    return (
      <span className="text-xs font-semibold text-fog" aria-label="No movement">
        &mdash;
      </span>
    );
  }
  const up = rank < prevRank;
  const delta = Math.abs(prevRank - rank);
  return (
    <span
      className={`text-xs font-semibold tabular-nums ${up ? "text-win" : "text-loss"}`}
      aria-label={up ? `Up ${delta} from last week` : `Down ${delta} from last week`}
    >
      {up ? "▲" : "▼"}
      {delta}
    </span>
  );
}

function AvatarDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ background: color }}
    />
  );
}

function BonusPills({ b }: { b: StandingsRow["bonuses"] }) {
  const pills: ReactNode[] = [];
  if (b.exacto > 0) {
    pills.push(
      <Pill key="e" tone="gold">
        Exacto &times;{b.exacto}
      </Pill>,
    );
  }
  if (b.perfecto > 0) {
    pills.push(
      <Pill key="p" tone="gold">
        Perfecto &times;{b.perfecto}
      </Pill>,
    );
  }
  if (b.closest > 0) {
    pills.push(
      <Pill key="c" tone="blue">
        Closest-To &times;{b.closest}
      </Pill>,
    );
  }
  if (b.kod > 0) {
    pills.push(
      <Pill key="k" tone="loss">
        Kiss of Death &times;{b.kod}
      </Pill>,
    );
  }
  if (pills.length === 0) return <span className="text-xs text-fog">&mdash;</span>;
  return <div className="flex flex-wrap items-center gap-1">{pills}</div>;
}

function lineItemLabelClass(item: LineItem): string {
  if (item.kind === "bonus") return "text-gold";
  if (item.kind === "penalty") return "text-loss";
  return item.points > 0 ? "text-silver" : "text-fog";
}

function WeekDetail({ week, grade }: { week: number; grade: UserWeekGrade | undefined }) {
  const total = grade?.total ?? 0;
  return (
    <div className="rounded-lg border border-edge bg-panel p-3">
      <div className="mb-2 flex items-baseline justify-between gap-3 border-b border-edge pb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-fog">
          Week {week}
        </span>
        <span
          className={`display text-lg ${
            total < 0 ? "text-loss" : total > 0 ? "text-chalk" : "text-fog"
          }`}
        >
          {signedPts(total)}
        </span>
      </div>
      {grade && grade.items.length > 0 ? (
        <ul className="space-y-1.5">
          {grade.items.map((item, i) => (
            <li key={i} className="flex items-start justify-between gap-3 text-xs">
              <span className={lineItemLabelClass(item)}>{item.label}</span>
              <span
                className={`shrink-0 font-semibold tabular-nums ${lineItemLabelClass(item)}`}
              >
                {signedPts(item.points)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-fog">{"No pick submitted. Zero points. Mother noticed."}</p>
      )}
    </div>
  );
}

// --- Page -------------------------------------------------------------------

export default function StandingsPage() {
  const hydrated = useHydrated();
  const version = useStoreVersion();
  const [openId, setOpenId] = useState<string | null>(null);

  const { weeks, rows, grades, flavor } = useMemo(() => {
    const weeks = gradedWeeks(hydrated);
    const rows = computeStandings(
      PLAYERS.map((p) => p.id),
      weeks,
    );
    const grades = new Map<number, Map<string, UserWeekGrade>>();
    for (const w of weeks) {
      const m = new Map<string, UserWeekGrade>();
      for (const g of gradeWeek(w.contest, w.results, w.subs)) m.set(g.userId, g);
      grades.set(w.contest.week, m);
    }
    return { weeks, rows, grades, flavor: computeFlavor(weeks, rows) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, version]);

  const weekNums = weeks.map((w) => w.contest.week);
  const leaderTotal = rows[0]?.total ?? 0;
  const rankCounts = new Map<number, number>();
  for (const r of rows) rankCounts.set(r.rank, (rankCounts.get(r.rank) ?? 0) + 1);
  const rankLabel = (rank: number) => ((rankCounts.get(rank) ?? 0) > 1 ? `T${rank}` : `${rank}`);

  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));

  const kodRows = rows.filter((r) => r.bonuses.kod > 0);
  const { longshots, bestWeek, mostBonuses } = flavor;
  const longshotLeader = longshots.leader ? participant(longshots.leader.userId) : null;

  return (
    <div className="space-y-10">
      <div>
        <SectionTitle kicker="Season to date">Standings</SectionTitle>
        <p className="mt-2 max-w-2xl text-sm text-fog">
          {
            "Team. Win. Score. Every point below is computed from graded weeks — nothing hand-entered, nothing negotiable."
          }
        </p>
      </div>

      {weeks.length === 0 ? (
        <EmptyState title="Nothing graded yet">
          {"Mother grades when Mother grades. Check back after the first final whistle."}
        </EmptyState>
      ) : (
        <>
          {/* Podium */}
          <div className="grid gap-4 sm:grid-cols-3">
            {rows.slice(0, 3).map((row) => {
              const p = participant(row.userId);
              if (!p) return null;
              const back = leaderTotal - row.total;
              const medal =
                row.rank === 1 ? "text-gold" : row.rank === 2 ? "text-silver" : "text-fog";
              return (
                <Card key={row.userId} accent className="p-5">
                  <div className="flex items-start justify-between">
                    <span className={`display text-5xl leading-none ${medal}`}>
                      {rankLabel(row.rank)}
                    </span>
                    <AvatarDot color={p.avatarColor} />
                  </div>
                  <div className="mt-3 font-bold text-chalk">{p.name}</div>
                  {p.nickname && <div className="text-xs text-fog">&ldquo;{p.nickname}&rdquo;</div>}
                  <div className="mt-3 flex items-baseline gap-2">
                    <span
                      className={`display text-3xl ${row.total < 0 ? "text-loss" : "text-chalk"}`}
                    >
                      {row.total < 0 ? signedPts(row.total) : fmtPts(row.total)}
                    </span>
                    <span className="text-xs uppercase tracking-wider text-fog">pts</span>
                  </div>
                  <div className="mt-1 text-xs text-fog">
                    {row.rank === 1
                      ? "The hunted. Enjoy it while it lasts."
                      : back === 0
                        ? "Even on top."
                        : `${fmtPts(back)} back`}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Full table */}
          <div>
            <p className="mb-3 text-xs text-fog">
              {
                "Click any row for the receipts — every line item, every bonus, every mistake. Through "
              }
              {weeks.length} graded {weeks.length === 1 ? "week" : "weeks"}.
            </p>
            <Card className="overflow-hidden">
              <div className="table-scroll">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-edge text-left text-xs uppercase tracking-wider text-fog">
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Rank
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Player
                      </th>
                      {weekNums.map((w) => (
                        <th key={w} scope="col" className="px-3 py-3 text-right font-semibold">
                          W{w}
                        </th>
                      ))}
                      <th scope="col" className="px-4 py-3 text-right font-semibold">
                        Total
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Bonuses
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const p = participant(row.userId);
                      if (!p) return null;
                      const open = openId === row.userId;
                      return (
                        <Fragment key={row.userId}>
                          <tr
                            onClick={() => toggle(row.userId)}
                            className={`cursor-pointer border-b border-edge transition last:border-b-0 hover:bg-panel-2 ${
                              open ? "bg-panel-2" : ""
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="display w-8 text-xl leading-none text-chalk">
                                  {rankLabel(row.rank)}
                                </span>
                                <Movement rank={row.rank} prevRank={row.prevRank} />
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                aria-expanded={open}
                                aria-controls={
                                  open ? `standings-detail-${row.userId}` : undefined
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggle(row.userId);
                                }}
                                className="flex cursor-pointer items-center gap-2.5 rounded focus-visible:outline-2 focus-visible:outline-sky"
                              >
                                <AvatarDot color={p.avatarColor} />
                                <span className="font-semibold text-silver">{p.name}</span>
                                {p.nickname && (
                                  <span className="hidden text-xs text-fog lg:inline">
                                    &ldquo;{p.nickname}&rdquo;
                                  </span>
                                )}
                                <span
                                  aria-hidden
                                  className={`inline-block text-xs text-fog transition-transform ${
                                    open ? "rotate-90" : ""
                                  }`}
                                >
                                  {"▸"}
                                </span>
                              </button>
                            </td>
                            {weekNums.map((w) => {
                              const v = row.weekly[w];
                              return (
                                <td
                                  key={w}
                                  className={`px-3 py-3 text-right tabular-nums ${
                                    v == null
                                      ? "text-fog"
                                      : v < 0
                                        ? "font-semibold text-loss"
                                        : "text-silver"
                                  }`}
                                >
                                  {v == null ? "—" : v < 0 ? signedPts(v) : fmtPts(v)}
                                </td>
                              );
                            })}
                            <td className="px-4 py-3 text-right">
                              <span
                                className={`display text-2xl leading-none ${
                                  row.total < 0 ? "text-loss" : "text-chalk"
                                }`}
                              >
                                {row.total < 0 ? signedPts(row.total) : fmtPts(row.total)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <BonusPills b={row.bonuses} />
                            </td>
                          </tr>
                          {open && (
                            <tr
                              id={`standings-detail-${row.userId}`}
                              className="border-b border-edge bg-pitch/40 last:border-b-0"
                            >
                              <td colSpan={weekNums.length + 4} className="px-4 py-4">
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                  {weeks.map((w) => (
                                    <WeekDetail
                                      key={w.contest.week}
                                      week={w.contest.week}
                                      grade={grades.get(w.contest.week)?.get(row.userId)}
                                    />
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Flavor */}
          <div>
            <SectionTitle kicker="The watch list" className="mb-4">
              Situations Mother Is Monitoring
            </SectionTitle>
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="p-5">
                <h3 className="display text-xl text-loss">Kiss of Death Watch</h3>
                {kodRows.length > 0 ? (
                  <>
                    <ul className="mt-3 space-y-2">
                      {kodRows.map((r) => {
                        const p = participant(r.userId);
                        if (!p) return null;
                        return (
                          <li key={r.userId} className="flex items-center gap-2.5 text-sm">
                            <AvatarDot color={p.avatarColor} />
                            <span className="font-semibold text-silver">{p.name}</span>
                            <Pill tone="loss">Kiss of Death &times;{r.bonuses.kod}</Pill>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="mt-3 text-xs text-fog">
                      {
                        "Called an exact final score, backwards. Minus twenty, no appeals. Mother does not grade on intent."
                      }
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-fog">
                    {"Nobody has reversed a final score yet. Statistically, somebody will."}
                  </p>
                )}
              </Card>

              {longshots.total.attempts > 0 && longshots.leader && longshotLeader ? (
                <Card className="p-5">
                  <h3 className="display text-xl text-sky">The Machine Line</h3>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="display text-4xl leading-none text-chalk">
                      {longshots.total.hits} for {longshots.total.attempts}
                    </span>
                    <span className="text-xs uppercase tracking-wider text-fog">
                      on longshots, pool-wide
                    </span>
                  </div>
                  <p className="mt-3 flex items-center gap-2.5 text-sm">
                    <AvatarDot color={longshotLeader.avatarColor} />
                    <span>
                      <span className="font-semibold text-silver">{longshotLeader.name}</span>
                      <span className="text-fog">
                        {" "}
                        owns {longshots.leader.tally.attempts} of the {longshots.total.attempts}{" "}
                        attempts ({longshots.leader.tally.hits}{" "}
                        {longshots.leader.tally.hits === 1 ? "hit" : "hits"}).
                      </span>
                    </span>
                  </p>
                  <p className="mt-3 text-xs text-fog">
                    {
                      "The points divide is an incentive, not a dare. It keeps getting treated as a dare."
                    }
                  </p>
                </Card>
              ) : (
                <>
                  {bestWeek && (
                    <Card className="p-5">
                      <h3 className="display text-xl text-sky">Best Single Week</h3>
                      <div className="mt-3 flex items-baseline gap-2">
                        <span className="display text-4xl leading-none text-chalk">
                          {fmtPts(bestWeek.points)}
                        </span>
                        <span className="text-xs uppercase tracking-wider text-fog">
                          pts, Week {bestWeek.week}
                        </span>
                      </div>
                      <p className="mt-3 flex items-center gap-2.5 text-sm">
                        {participant(bestWeek.userId) && (
                          <AvatarDot color={participant(bestWeek.userId)!.avatarColor} />
                        )}
                        <span className="font-semibold text-silver">
                          {participant(bestWeek.userId)?.name ?? bestWeek.userId}
                        </span>
                      </p>
                      <p className="mt-3 text-xs text-fog">
                        {"The high-water mark. Everyone else is chasing it."}
                      </p>
                    </Card>
                  )}
                  {mostBonuses && (
                    <Card className="p-5">
                      <h3 className="display text-xl text-gold">Most Bonuses</h3>
                      <div className="mt-3 flex items-baseline gap-2">
                        <span className="display text-4xl leading-none text-chalk">
                          {mostBonuses.count}
                        </span>
                        <span className="text-xs uppercase tracking-wider text-fog">
                          score bonuses cashed
                        </span>
                      </div>
                      <p className="mt-3 flex items-center gap-2.5 text-sm">
                        {participant(mostBonuses.userId) && (
                          <AvatarDot color={participant(mostBonuses.userId)!.avatarColor} />
                        )}
                        <span className="font-semibold text-silver">
                          {participant(mostBonuses.userId)?.name ?? mostBonuses.userId}
                        </span>
                      </p>
                      <p className="mt-3 text-xs text-fog">
                        {"Closest-tos, exactos, perfectos. The score pick is not decorative."}
                      </p>
                    </Card>
                  )}
                </>
              )}
            </div>
          </div>

          {/* CTA */}
          <Card className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
            <p className="text-sm text-silver">
              <span className="font-bold text-chalk">Week {CURRENT_WEEK} is open.</span>{" "}
              {"Team. Win. Score. Don't be an idiot."}
            </p>
            <Link
              href="/"
              className="rounded-lg bg-honolulu px-4 py-2 text-sm font-bold text-white transition hover:bg-honolulu-deep"
            >
              Make your pick
            </Link>
          </Card>
        </>
      )}
    </div>
  );
}
