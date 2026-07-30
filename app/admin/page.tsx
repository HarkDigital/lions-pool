"use client";

// ---------------------------------------------------------------------------
// /admin/ — Mother's commissioner dashboard. Headline numbers, the wall of
// shame for missing picks, and the full roster with live season standings.
// Everything is derived from the store; nothing is hand-entered.
// ---------------------------------------------------------------------------

import Link from "next/link";
import { AdminGate } from "@/components/AdminGate";
import { Card, Pill, SectionTitle } from "@/components/ui";
import { CURRENT_WEEK, PLAYERS } from "@/lib/demo-data";
import { fmtDateTime, fmtPts, ordinal } from "@/lib/format";
import { computeStandings, type SeasonInput } from "@/lib/scoring";
import {
  effectiveContest,
  effectiveContests,
  effectiveResults,
  effectiveSubmissions,
  useStoreVersion,
} from "@/lib/store";
import type { StandingsRow } from "@/lib/types";

export default function AdminPage() {
  return (
    <AdminGate>
      <Dashboard />
    </AdminGate>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.15em] text-fog">{label}</div>
      <div className="display mt-1 text-3xl">{value}</div>
      {sub && <div className="mt-1 text-xs text-fog">{sub}</div>}
    </Card>
  );
}

function BonusChips({ row }: { row: StandingsRow }) {
  const chips: { label: string; tone: "gold" | "loss" }[] = [];
  if (row.bonuses.perfecto > 0)
    chips.push({ label: `${row.bonuses.perfecto}× Perfecto`, tone: "gold" });
  if (row.bonuses.exacto > 0) chips.push({ label: `${row.bonuses.exacto}× Exacto`, tone: "gold" });
  if (row.bonuses.closest > 0)
    chips.push({ label: `${row.bonuses.closest}× Closest`, tone: "gold" });
  if (row.bonuses.kod > 0) chips.push({ label: `${row.bonuses.kod}× Kiss of Death`, tone: "loss" });
  if (chips.length === 0) return <span className="text-xs text-fog">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {chips.map((c) => (
        <Pill key={c.label} tone={c.tone}>
          {c.label}
        </Pill>
      ))}
    </span>
  );
}

function Dashboard() {
  useStoreVersion();

  const contests = effectiveContests();
  const gradedWeeks = contests
    .filter((c) => c.status === "graded" && effectiveResults(c.week) != null)
    .map((c) => c.week);

  const playerIds = PLAYERS.map((p) => p.id);
  const currentSubs = effectiveSubmissions(CURRENT_WEEK).filter((s) =>
    playerIds.includes(s.userId),
  );
  const current = effectiveContest(CURRENT_WEEK);

  const season: SeasonInput[] = gradedWeeks.map((week) => ({
    contest: contests.find((c) => c.week === week)!,
    results: effectiveResults(week)!,
    subs: effectiveSubmissions(week),
  }));
  const standings = computeStandings(playerIds, season);
  const rowFor = new Map(standings.map((r) => [r.userId, r]));

  const ghosts = PLAYERS.filter((p) => !currentSubs.some((s) => s.userId === p.id));
  const roster = [...PLAYERS].sort(
    (a, b) =>
      (rowFor.get(a.id)?.rank ?? PLAYERS.length) - (rowFor.get(b.id)?.rank ?? PLAYERS.length),
  );

  return (
    <div className="space-y-8">
      <SectionTitle kicker="Mother's Office">Commissioner Dashboard</SectionTitle>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Players"
          value={String(PLAYERS.length)}
          sub="Plus Mother, who does not lose"
        />
        <StatCard
          label={`Week ${CURRENT_WEEK} picks in`}
          value={`${currentSubs.length}/${PLAYERS.length}`}
          sub={ghosts.length > 0 ? `${ghosts.length} still missing` : "A full inbox. Finally."}
        />
        <StatCard
          label="Weeks graded"
          value={String(gradedWeeks.length)}
          sub={
            gradedWeeks.length > 0
              ? `Weeks ${gradedWeeks.join(", ")} in the books`
              : "Nothing graded yet"
          }
        />
        <StatCard
          label="Next lock"
          value={current ? fmtDateTime(current.lockAtUTC) : "TBD"}
          sub="Kickoff, Eastern time. Obviously."
        />
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="display text-2xl">Still ghosting Mother</h3>
          <Pill tone={ghosts.length > 0 ? "loss" : "win"}>
            {ghosts.length > 0 ? `${ghosts.length} missing` : "All in"}
          </Pill>
        </div>
        {ghosts.length > 0 ? (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              {ghosts.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-2 rounded-full border border-edge-2 bg-panel-2 px-3 py-1.5 text-xs font-bold text-silver"
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: p.avatarColor }}
                  />
                  {p.name}
                </span>
              ))}
            </div>
            <p className="mt-4 text-sm text-fog">
              The slate locks at kickoff, not kickoff-ish. Mother does not chase, Mother does not
              remind twice, and a missing pick scores exactly what it deserves. Team. Win. Score.
              Don&apos;t be an idiot.
            </p>
          </>
        ) : (
          <p className="mt-4 text-sm text-fog">
            Every pick is in before the deadline. Mother is proud of no one, but she is watching.
          </p>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-edge px-6 py-4">
          <h3 className="display text-2xl">The Roster</h3>
          <p className="mt-1 text-xs text-fog">
            Season totals computed live from the graded weeks. No hand math, no appeals.
          </p>
        </div>
        <div className="table-scroll">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-edge text-xs uppercase tracking-wider text-fog">
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3 text-right">Season pts</th>
                <th className="px-4 py-3">Bonuses</th>
                <th className="px-4 py-3 text-right">Picks</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((p) => {
                const row = rowFor.get(p.id);
                return (
                  <tr key={p.id} className="border-b border-edge last:border-0">
                    <td className="px-4 py-3">
                      <span className="display text-xl">
                        {row ? ordinal(row.rank) : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2.5">
                        <span
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: p.avatarColor }}
                        />
                        <span>
                          <span className="block font-semibold text-silver">{p.name}</span>
                          {p.nickname && (
                            <span className="block text-xs text-fog">{p.nickname}</span>
                          )}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="display text-xl text-sky">
                        {row ? fmtPts(row.total) : "0"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{row ? <BonusChips row={row} /> : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href="/admin/submissions/"
                        className="whitespace-nowrap text-xs font-bold text-sky hover:underline"
                      >
                        View picks →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
