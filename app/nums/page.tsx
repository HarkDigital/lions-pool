"use client";

// ---------------------------------------------------------------------------
// Nums: the season table, the movement graph, and the bonus ledgers.
// Every number on this page is computed live by lib/scoring.ts from graded
// contests. There is no hand-entered table.
// Public page: nicknames only, via publicName().
// ---------------------------------------------------------------------------

import { Fragment, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  computeStandings,
  gradeWeek,
  isBlankPick,
  rankProgression,
  type SeasonInput,
} from "@/lib/scoring";
import type {
  LineItem,
  ScoreBonusType,
  StandingsRow,
  Submission,
  UserWeekGrade,
  WeekResults,
} from "@/lib/types";
import {
  bonusValues,
  effectiveContests,
  effectiveResults,
  effectiveSubmissions,
  poolParticipant,
  poolPlayers,
  publicName,
  useHydrated,
  useStoreVersion,
} from "@/lib/store";
import { fmtPts, fmtScore, signedPts } from "@/lib/format";
import { gameForWeek } from "@/lib/schedule";
import { ScrollRail } from "@/components/ScrollRail";
import { SeasonGraph, type GraphPlayer } from "@/components/SeasonGraph";
import { SortTh, sortRows, useSort, type SortValue } from "@/components/sort";
import { Card, EmptyState, LoadingCard, Pill, SectionTitle } from "@/components/ui";

// --- Data assembly ----------------------------------------------------------

/**
 * Graded weeks, derived dynamically: contest.status === "graded" AND results
 * exist. Store selectors only — the page holds a LoadingCard until hydration,
 * then everything comes from the current area's overlays.
 */
function gradedWeeks(): SeasonInput[] {
  const out: SeasonInput[] = [];
  for (const contest of effectiveContests()) {
    if (contest.status !== "graded") continue;
    const results = effectiveResults(contest.week);
    if (!results) continue;
    out.push({ contest, results, subs: effectiveSubmissions(contest.week) });
  }
  return out.sort((a, b) => a.contest.week - b.contest.week);
}

interface LongshotTally {
  attempts: number;
  hits: number;
}

interface LongshotStats {
  total: LongshotTally;
  leader: { userId: string; tally: LongshotTally } | null;
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

/** Longshot tracking: moneyline options with an uneven divide; the fat side is the dare. */
function computeLongshots(weeks: SeasonInput[], rows: StandingsRow[]): LongshotStats {
  const playerIds = new Set(rows.map((r) => r.userId));
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
  let leader: LongshotStats["leader"] = null;
  for (const [userId, tally] of byPlayer) {
    if (!leader || tally.attempts > leader.tally.attempts) leader = { userId, tally };
  }
  return { total, leader };
}

// --- Small pieces -----------------------------------------------------------

function Movement({ rank, prevRank }: { rank: number; prevRank?: number }) {
  if (prevRank == null) return null;
  if (prevRank === rank) {
    return (
      <span className="text-xs font-semibold text-fog" aria-label="No movement">
        &middot;
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
  if (pills.length === 0) return <span className="text-xs text-fog">&middot;</span>;
  return <div className="flex flex-wrap items-center gap-1">{pills}</div>;
}

function lineItemLabelClass(item: LineItem): string {
  if (item.kind === "bonus") return "text-gold";
  if (item.kind === "penalty") return "text-loss";
  return item.points > 0 ? "text-silver" : "text-fog";
}

/** "DET 31-17" / "NO 27-20" / "Tie 20-20": winner first, the way the pool reads a score. */
function calledScore(pick: NonNullable<Submission["scorePick"]>): string {
  if (pick.winner === "DET") return `DET ${fmtScore(pick.lions, pick.opp)}`;
  if (pick.lions === pick.opp) return `Tie ${fmtScore(pick.lions, pick.opp)}`;
  return `${pick.winner} ${fmtScore(pick.opp, pick.lions)}`;
}

function finalScore(week: number, results: WeekResults | undefined): string | null {
  if (!results || results.lionsScore == null || results.oppScore == null) return null;
  const { lionsScore: l, oppScore: o } = results;
  const opp = gameForWeek(week)?.opponent ?? "OPP";
  if (l === o) return `Tie ${fmtScore(l, o)}`;
  return l > o ? `DET ${fmtScore(l, o)}` : `${opp} ${fmtScore(o, l)}`;
}

function WeekDetail({
  week,
  grade,
  sub,
  results,
}: {
  week: number;
  grade: UserWeekGrade | undefined;
  /** The player's own submission for the week, for the score they called. */
  sub?: Submission;
  results?: WeekResults;
}) {
  const total = grade?.total ?? 0;
  const blank = sub ? isBlankPick(sub) : false;
  const final = finalScore(week, results);
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
      {sub?.scorePick && !blank && (
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs">
          <span className="text-silver">
            Called <span className="font-semibold text-chalk">{calledScore(sub.scorePick)}</span>
          </span>
          {final && <span className="text-fog">Final {final}</span>}
        </div>
      )}
      {blank ? (
        <p className="text-xs text-fog">{"Filed as no pick (0-0). Zero points."}</p>
      ) : grade && grade.items.length > 0 ? (
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
        <p className="text-xs text-fog">
          {"No pick submitted. Zero points. Mother Superior noticed."}
        </p>
      )}
    </div>
  );
}

// --- Tabs -------------------------------------------------------------------

type TabId = "table" | "movement" | "kod" | "exacto" | "perfecto";

const TABS: { id: TabId; label: string }[] = [
  { id: "table", label: "The Table" },
  { id: "movement", label: "Season Movement" },
  { id: "kod", label: "Kiss of Death" },
  { id: "exacto", label: "Exacto" },
  { id: "perfecto", label: "Perfecto" },
];

/** One cashed (or suffered) score bonus, resolved for public rendering. */
interface BonusHit {
  userId: string;
  name: string;
  color: string;
  week: number;
  label: string;
  points: number;
}

function BonusList({
  hits,
  tone,
  emptyTitle,
  emptyBody,
}: {
  hits: BonusHit[];
  tone: "gold" | "loss";
  emptyTitle: string;
  emptyBody: string;
}) {
  if (hits.length === 0) {
    return <EmptyState title={emptyTitle}>{emptyBody}</EmptyState>;
  }
  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-edge">
        {hits.map((h, i) => (
          <li
            key={`${h.week}-${h.userId}-${i}`}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3"
          >
            <span className="flex items-center gap-2.5">
              <AvatarDot color={h.color} />
              <span className="text-sm font-semibold text-silver">{h.name}</span>
              <span className="text-xs uppercase tracking-wider text-fog">Week {h.week}</span>
            </span>
            <span className="flex items-center gap-3">
              <span className="text-xs text-fog">{h.label}</span>
              <span
                className={`display text-lg leading-none tabular-nums ${
                  tone === "gold" ? "text-gold" : "text-loss"
                }`}
              >
                {signedPts(h.points)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// --- Page -------------------------------------------------------------------

export default function NumsPage() {
  const hydrated = useHydrated();
  const version = useStoreVersion();
  const [openId, setOpenId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("table");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const { sort, toggle: onSort } = useSort<string>();
  const [query, setQuery] = useState("");

  const data = useMemo(() => {
    // Pre-hydration the area is unknown; the page renders a LoadingCard.
    if (!hydrated) return null;

    const weeks = gradedWeeks();
    const players = poolPlayers();
    const playerIds = players.map((p) => p.id);
    const rows = computeStandings(playerIds, weeks, bonusValues());

    const grades = new Map<number, Map<string, UserWeekGrade>>();
    for (const w of weeks) {
      const m = new Map<string, UserWeekGrade>();
      for (const g of gradeWeek(w.contest, w.results, w.subs, bonusValues())) m.set(g.userId, g);
      grades.set(w.contest.week, m);
    }

    // Graph identity = entity colors, all players, nicknames only.
    const graphPlayers: GraphPlayer[] = players.map((p) => ({
      id: p.id,
      label: publicName(p),
      color: p.avatarColor,
    }));
    const progression = rankProgression(playerIds, weeks, bonusValues());

    // Bonus ledgers: every score-bonus line item, by type, week then player.
    const bonusHits: Record<Exclude<ScoreBonusType, "closest">, BonusHit[]> = {
      kod: [],
      exacto: [],
      perfecto: [],
    };
    for (const w of weeks) {
      for (const g of grades.get(w.contest.week)?.values() ?? []) {
        const p = poolParticipant(g.userId);
        if (!p) continue;
        for (const item of g.items) {
          if (
            item.bonusType !== "kod" &&
            item.bonusType !== "exacto" &&
            item.bonusType !== "perfecto"
          )
            continue;
          bonusHits[item.bonusType].push({
            userId: g.userId,
            name: publicName(p),
            color: p.avatarColor,
            week: w.contest.week,
            label: item.label,
            points: item.points,
          });
        }
      }
    }
    for (const list of Object.values(bonusHits)) {
      list.sort((a, b) => a.week - b.week || a.name.localeCompare(b.name));
    }

    return {
      weeks,
      players,
      rows,
      grades,
      graphPlayers,
      progression,
      longshots: computeLongshots(weeks, rows),
      bonusHits,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, version]);

  if (!data) {
    return (
      <div className="space-y-10">
        <SectionTitle kicker="Season to date">Nums</SectionTitle>
        <LoadingCard />
      </div>
    );
  }

  const { weeks, players, rows, grades, graphPlayers, progression, longshots, bonusHits } = data;

  // No graded weeks OR no players (live starts empty): nothing to compute,
  // so the table and movement tabs show their EmptyState instead. Also keeps
  // rankProgression/labelY-style math away from empty arrays.
  const nothingGraded = weeks.length === 0 || players.length === 0;

  const weekNums = weeks.map((w) => w.contest.week);
  const rankCounts = new Map<number, number>();
  for (const r of rows) rankCounts.set(r.rank, (rankCounts.get(r.rank) ?? 0) + 1);
  const rankLabel = (rank: number) => ((rankCounts.get(rank) ?? 0) > 1 ? `T${rank}` : `${rank}`);

  const accessors: Record<string, (row: StandingsRow) => SortValue> = {
    rank: (row) => row.rank,
    player: (row) => {
      const p = poolParticipant(row.userId);
      return p ? publicName(p) : null;
    },
    total: (row) => row.total,
    // Count of every pill the cell shows, Kiss of Death included; none renders
    // as a dot, so none sorts as blank.
    bonuses: (row) => {
      const n = row.bonuses.exacto + row.bonuses.perfecto + row.bonuses.closest + row.bonuses.kod;
      return n > 0 ? n : null;
    },
  };
  for (const w of weekNums) accessors[`w${w}`] = (row) => row.weekly[w];
  const sortedRows = sortRows(rows, sort, accessors);
  // Search narrows the table only: ranks and points stay the season's, never
  // the filter's.
  const needle = query.trim().toLowerCase();
  const tableRows = needle
    ? sortedRows.filter((row) => {
        const p = poolParticipant(row.userId);
        return p != null && publicName(p).toLowerCase().includes(needle);
      })
    : sortedRows;

  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));

  const longshotLeader = longshots.leader ? poolParticipant(longshots.leader.userId) : null;


  const onTablistKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = TABS.findIndex((t) => t.id === tab);
    let next = -1;
    if (e.key === "ArrowRight") next = (idx + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="space-y-10">
      <div>
        <SectionTitle kicker="Season to date">Nums</SectionTitle>
        <ScrollRail
          className="mt-4"
          railProps={{ role: "tablist", "aria-label": "Nums views", onKeyDown: onTablistKeyDown }}
        >
          {TABS.map((t, i) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`nums-tab-${t.id}`}
                aria-selected={active}
                aria-controls={`nums-panel-${t.id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setTab(t.id)}
                className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-sky ${
                  active ? "bg-honolulu/15 text-sky" : "text-fog hover:bg-panel-2 hover:text-chalk"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </ScrollRail>
      </div>

      {tab === "table" && (
        <div
          role="tabpanel"
          id="nums-panel-table"
          aria-labelledby="nums-tab-table"
          className="space-y-10"
        >
          {nothingGraded ? (
            <EmptyState title="Nothing graded yet">
              {
                "Mother Superior grades when Mother Superior grades. Check back after the first final whistle."
              }
            </EmptyState>
          ) : (
            <>
              {/* Full table */}
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search players…"
                    aria-label="Search the table by player"
                    className="w-full rounded-lg border border-edge bg-panel-2 px-3 py-1.5 text-sm text-chalk outline-none transition placeholder:text-fog focus:border-honolulu/60 sm:w-64"
                  />
                  {needle && (
                    <span className="text-xs text-fog">
                      {tableRows.length} of {sortedRows.length}
                    </span>
                  )}
                </div>
                {tableRows.length === 0 ? (
                  <EmptyState title="Nobody by that name.">
                    {`No player matches “${query.trim()}”.`}
                  </EmptyState>
                ) : (
                <Card className="overflow-hidden">
                  <div className="table-scroll">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead>
                        <tr className="border-b border-edge text-left text-xs uppercase tracking-wider text-fog">
                          <SortTh k="rank" sort={sort} onSort={onSort} className="px-4 py-3 font-semibold">
                            Rank
                          </SortTh>
                          <SortTh k="player" sort={sort} onSort={onSort} className="px-4 py-3 font-semibold">
                            Player
                          </SortTh>
                          {weekNums.map((w) => (
                            <SortTh
                              key={w}
                              k={`w${w}`}
                              sort={sort}
                              onSort={onSort}
                              firstDir="desc"
                              title={`Week ${w} points`}
                              className="px-3 py-3 text-right font-semibold"
                            >
                              W{w}
                            </SortTh>
                          ))}
                          <SortTh
                            k="total"
                            sort={sort}
                            onSort={onSort}
                            firstDir="desc"
                            className="px-4 py-3 text-right font-semibold"
                          >
                            Total
                          </SortTh>
                          <SortTh
                            k="bonuses"
                            sort={sort}
                            onSort={onSort}
                            firstDir="desc"
                            className="px-4 py-3 font-semibold"
                          >
                            Bonuses
                          </SortTh>
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.map((row) => {
                          const p = poolParticipant(row.userId);
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
                                      open ? `nums-detail-${row.userId}` : undefined
                                    }
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggle(row.userId);
                                    }}
                                    className="flex cursor-pointer items-center gap-2.5 rounded focus-visible:outline-2 focus-visible:outline-sky"
                                  >
                                    <AvatarDot color={p.avatarColor} />
                                    <span className="font-semibold text-silver">
                                      {publicName(p)}
                                    </span>
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
                                      {v == null ? "·" : v < 0 ? signedPts(v) : fmtPts(v)}
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
                                  id={`nums-detail-${row.userId}`}
                                  className="border-b border-edge bg-pitch/40 last:border-b-0"
                                >
                                  <td colSpan={weekNums.length + 4} className="px-4 py-4">
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                      {weeks.map((w) => (
                                        <WeekDetail
                                          key={w.contest.week}
                                          week={w.contest.week}
                                          grade={grades.get(w.contest.week)?.get(row.userId)}
                                          sub={w.subs.find((s) => s.userId === row.userId)}
                                          results={w.results}
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
                )}
              </div>

              {/* The Machine Line */}
              {longshots.total.attempts > 0 && longshots.leader && longshotLeader && (
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
                      <span className="font-semibold text-silver">
                        {publicName(longshotLeader)}
                      </span>
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
              )}
            </>
          )}
        </div>
      )}

      {tab === "movement" && (
        <div role="tabpanel" id="nums-panel-movement" aria-labelledby="nums-tab-movement">
          {nothingGraded ? (
            <EmptyState title="Nothing graded yet">
              {"No weeks in the books, no movement to draw. Check back after the first final whistle."}
            </EmptyState>
          ) : (
            <Card className="p-5">
              <h3 className="display text-xl text-chalk">Season movement</h3>
              <p className="mt-1 text-xs text-fog">
                {"Rank after each graded week. Hover a dot for the receipts."}
              </p>
              <div className="mt-4">
                <SeasonGraph players={graphPlayers} progression={progression} />
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === "kod" && (
        <div role="tabpanel" id="nums-panel-kod" aria-labelledby="nums-tab-kod">
          <BonusList
            hits={bonusHits.kod}
            tone="loss"
            emptyTitle="No kisses yet"
            emptyBody="Nobody has taken the Kiss yet. The season is young."
          />
        </div>
      )}

      {tab === "exacto" && (
        <div role="tabpanel" id="nums-panel-exacto" aria-labelledby="nums-tab-exacto">
          <BonusList
            hits={bonusHits.exacto}
            tone="gold"
            emptyTitle="No Exactos yet"
            emptyBody="Nobody has landed a score on the nose. Mother Superior keeps the eight points warm."
          />
        </div>
      )}

      {tab === "perfecto" && (
        <div role="tabpanel" id="nums-panel-perfecto" aria-labelledby="nums-tab-perfecto">
          <BonusList
            hits={bonusHits.perfecto}
            tone="gold"
            emptyTitle="No Perfectos yet"
            emptyBody="Twenty points, unclaimed. Perfection remains theoretical."
          />
        </div>
      )}

    </div>
  );
}
