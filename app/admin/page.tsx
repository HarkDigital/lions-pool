"use client";

// ---------------------------------------------------------------------------
// /admin/ — Mother Superior's commissioner dashboard. Headline numbers, the
// wall of shame for missing picks, and the full roster with live season Nums
// plus admin-only identity (real names, emails) and payment status.
// Everything is derived from the store; nothing is hand-entered.
// ---------------------------------------------------------------------------

import { useState } from "react";
import { AdminGate } from "@/components/AdminGate";
import { AreaLink } from "@/components/AreaLink";
import { Btn, Card, Pill, SectionTitle } from "@/components/ui";
import { fmtDateTime, fmtPts, ordinal, signedPts } from "@/lib/format";
import { computeStandings, type BonusValues, type SeasonInput } from "@/lib/scoring";
import {
  bonusValues,
  currentWeek,
  effectiveContest,
  effectiveContests,
  effectiveResults,
  effectiveSubmissions,
  paymentFor,
  poolPlayers,
  publicName,
  saveBonusValues,
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

const BONUS_FIELDS: { key: keyof BonusValues; label: string; hint: string }[] = [
  { key: "closest", label: "Closest-To", hint: "per team score, when nobody was exact" },
  { key: "exacto", label: "Exacto", hint: "nailed one team's score" },
  { key: "perfecto", label: "Perfecto", hint: "nailed the entire final score" },
  { key: "kod", label: "Kiss of Death", hint: "exact reverse of the final (enter a negative)" },
];

/** Season bonus payouts. Saving re-scores every graded week instantly. */
function ScoringSettings() {
  useStoreVersion();
  const [draft, setDraft] = useState<Record<keyof BonusValues, string> | null>(null);
  const [saved, setSaved] = useState(false);
  const current = bonusValues();
  const values =
    draft ??
    (Object.fromEntries(
      BONUS_FIELDS.map((f) => [f.key, String(current[f.key])]),
    ) as Record<keyof BonusValues, string>);

  const parsed = Object.fromEntries(
    BONUS_FIELDS.map((f) => [f.key, Number(values[f.key])]),
  ) as unknown as BonusValues;
  const valid = BONUS_FIELDS.every((f) => Number.isFinite(parsed[f.key]));
  const dirty = BONUS_FIELDS.some((f) => parsed[f.key] !== current[f.key]);

  return (
    <Card className="p-5">
      <h3 className="display text-2xl">Scoring Settings</h3>
      <p className="mt-1 text-sm text-fog">
        The payouts for the score bonuses. Changes apply to every graded week instantly. Mother
        Superior rewrites history when Mother Superior pleases.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {BONUS_FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-fog">
              {f.label}
            </span>
            <input
              type="number"
              step="0.5"
              value={values[f.key]}
              onChange={(e) => {
                setSaved(false);
                setDraft({ ...values, [f.key]: e.target.value });
              }}
              className="mt-1 w-full rounded-lg border border-edge bg-panel-2 px-3 py-2 text-sm text-chalk outline-none focus:border-honolulu"
            />
            <span className="mt-1 block text-[11px] leading-tight text-fog">{f.hint}</span>
          </label>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Btn
          disabled={!valid || !dirty}
          onClick={() => {
            saveBonusValues(parsed);
            setDraft(null);
            setSaved(true);
          }}
        >
          Save payouts
        </Btn>
        {saved && (
          <span className="text-xs font-semibold text-win">
            Saved. Every graded week now pays {signedPts(parsed.exacto)} Exacto,{" "}
            {signedPts(parsed.perfecto)} Perfecto, {signedPts(parsed.kod)} Kiss of Death.
          </span>
        )}
        {!valid && (
          <span className="text-xs font-semibold text-loss">
            Numbers only. Mother Superior does not accept essays here.
          </span>
        )}
      </div>
    </Card>
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
    chips.push({ label: `Perfecto ×${row.bonuses.perfecto}`, tone: "gold" });
  if (row.bonuses.exacto > 0) chips.push({ label: `Exacto ×${row.bonuses.exacto}`, tone: "gold" });
  if (row.bonuses.closest > 0)
    chips.push({ label: `Closest-To ×${row.bonuses.closest}`, tone: "gold" });
  if (row.bonuses.kod > 0) chips.push({ label: `Kiss of Death ×${row.bonuses.kod}`, tone: "loss" });
  if (chips.length === 0) return <span className="text-xs text-fog">-</span>;
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

  // Rendered inside AdminGate, so the store is hydrated and the area-aware
  // selectors are safe to read. Live starts with an empty roster.
  const players = poolPlayers();
  const hasPlayers = players.length > 0;
  const week = currentWeek();

  const contests = effectiveContests();
  const gradedWeeks = contests
    .filter((c) => c.status === "graded" && effectiveResults(c.week) != null)
    .map((c) => c.week);

  const playerIds = players.map((p) => p.id);
  const currentSubs = effectiveSubmissions(week).filter((s) => playerIds.includes(s.userId));
  const current = effectiveContest(week);

  const season: SeasonInput[] = gradedWeeks.map((w) => ({
    contest: contests.find((c) => c.week === w)!,
    results: effectiveResults(w)!,
    subs: effectiveSubmissions(w),
  }));
  const standings = computeStandings(playerIds, season, bonusValues());
  const rowFor = new Map(standings.map((r) => [r.userId, r]));

  const ghosts = players.filter((p) => !currentSubs.some((s) => s.userId === p.id));
  const roster = [...players].sort(
    (a, b) =>
      (rowFor.get(a.id)?.rank ?? players.length) - (rowFor.get(b.id)?.rank ?? players.length),
  );

  return (
    <div className="space-y-8">
      <SectionTitle kicker="Mother Superior's Office">Commissioner Dashboard</SectionTitle>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Players"
          value={String(players.length)}
          sub={
            hasPlayers
              ? "Plus Mother Superior, who does not lose"
              : "No players yet. Accounts arrive with the backend."
          }
        />
        <StatCard
          label={`Week ${week} picks in`}
          value={hasPlayers ? `${currentSubs.length}/${players.length}` : "0"}
          sub={
            !hasPlayers
              ? "Nobody to chase. For now."
              : ghosts.length > 0
                ? `${ghosts.length} still missing`
                : "A full inbox. Finally."
          }
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
          <h3 className="display text-2xl">Still ghosting Mother Superior</h3>
          <Pill tone={!hasPlayers ? "default" : ghosts.length > 0 ? "loss" : "win"}>
            {!hasPlayers
              ? "Nobody to ghost"
              : ghosts.length > 0
                ? `${ghosts.length} missing`
                : "All in"}
          </Pill>
        </div>
        {!hasPlayers ? (
          <p className="mt-4 text-sm text-fog">
            No players yet. Accounts arrive with the backend. Mother Superior cannot be ghosted
            by people who do not exist, and she considers that a personal best.
          </p>
        ) : ghosts.length > 0 ? (
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
                  {publicName(p)} ({p.name})
                </span>
              ))}
            </div>
            <p className="mt-4 text-sm text-fog">
              The slate locks at kickoff, not kickoff-ish. Mother Superior does not chase, Mother
              Superior does not remind twice, and a missing pick scores exactly what it deserves.
              Team. Win. Score. Don&apos;t be an idiot.
            </p>
          </>
        ) : (
          <p className="mt-4 text-sm text-fog">
            Every pick is in before the deadline. Mother Superior is proud of no one, but she is
            watching.
          </p>
        )}
      </Card>

      <ScoringSettings />

      <Card className="overflow-hidden">
        <div className="border-b border-edge px-6 py-4">
          <h3 className="display text-2xl">The Roster</h3>
          <p className="mt-1 text-xs text-fog">
            Season totals computed live from the graded weeks. No hand math, no appeals. The bold
            name is the public nickname (all the pool ever sees); real names and emails stay in
            this office.
          </p>
        </div>
        {!hasPlayers ? (
          <div className="p-10 text-center">
            <div className="display text-2xl text-fog">No players yet</div>
            <p className="mt-2 text-sm text-fog">
              Accounts arrive with the backend. The standings will compute themselves the moment
              there is someone to rank.
            </p>
          </div>
        ) : (
        <div className="table-scroll">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-edge text-xs uppercase tracking-wider text-fog">
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3 text-right">Season pts</th>
                <th className="px-4 py-3">Bonuses</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3 text-right">Picks</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((p) => {
                const row = rowFor.get(p.id);
                const payment = paymentFor(p.id);
                return (
                  <tr key={p.id} className="border-b border-edge last:border-0">
                    <td className="px-4 py-3">
                      <span className="display text-xl">
                        {row ? ordinal(row.rank) : "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2.5">
                        <span
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: p.avatarColor }}
                        />
                        <span>
                          <span className="block font-bold text-chalk">{publicName(p)}</span>
                          <span className="block text-xs text-silver">{p.name}</span>
                          {p.email && <span className="block text-xs text-fog">{p.email}</span>}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="display text-xl text-sky">
                        {row ? fmtPts(row.total) : "0"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{row ? <BonusChips row={row} /> : "-"}</td>
                    <td className="px-4 py-3">
                      <AreaLink href="/admin/payments/" className="inline-flex">
                        <Pill tone={payment.paid ? "win" : "loss"}>
                          {payment.paid ? "Paid" : "Unpaid"}
                        </Pill>
                      </AreaLink>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <AreaLink
                        href="/admin/submissions/"
                        className="whitespace-nowrap text-xs font-bold text-sky hover:underline"
                      >
                        View picks →
                      </AreaLink>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </Card>
    </div>
  );
}
