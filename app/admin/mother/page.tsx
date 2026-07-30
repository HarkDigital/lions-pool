"use client";

// ---------------------------------------------------------------------------
// /admin/mother/ — Mother Superior's weekly picks. The house line, published
// to the whole pool via the "Mother Superior Says" strip on This Week.
// Not a graded submission; the Nums belong to the players.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { AdminGate } from "@/components/AdminGate";
import { TeamLogo } from "@/components/TeamLogo";
import { Btn, Card, Pill, SectionTitle, STATUS_TONE } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { gameForWeek } from "@/lib/schedule";
import {
  currentWeek,
  effectiveContest,
  effectiveContests,
  mothersPickFor,
  saveMothersPick,
  useStoreVersion,
} from "@/lib/store";
import { teamInfo } from "@/lib/teams";
import { TIE } from "@/lib/types";

export default function MotherPicksPage() {
  return (
    <AdminGate>
      <Inner />
    </AdminGate>
  );
}

interface Draft {
  winner: string; // "", team abbr, or TIE
  lions: string;
  opp: string;
  extra: string;
  blurb: string;
}

const EMPTY: Draft = { winner: "", lions: "", opp: "", extra: "", blurb: "" };

function draftFor(week: number): Draft {
  const saved = mothersPickFor(week);
  const blurb = effectiveContest(week)?.blurb ?? "";
  if (!saved) return { ...EMPTY, blurb };
  return {
    winner: saved.winner ?? "",
    lions: saved.lions != null ? String(saved.lions) : "",
    opp: saved.opp != null ? String(saved.opp) : "",
    extra: saved.extra ?? "",
    blurb,
  };
}

/** "LIONS WIN 34-20 / GOFF OVER" — the strip exactly as the pool will read it. */
function composeSays(week: number, d: Draft): string {
  const game = gameForWeek(week);
  const parts: string[] = [];
  const l = Number(d.lions);
  const o = Number(d.opp);
  const haveScore = d.lions !== "" && d.opp !== "" && Number.isFinite(l) && Number.isFinite(o);
  if (game && d.winner && haveScore) {
    if (d.winner === TIE) {
      parts.push(`TIE ${l}-${o}`);
    } else {
      const hi = Math.max(l, o);
      const lo = Math.min(l, o);
      parts.push(`${teamInfo(d.winner).short.toUpperCase()} WIN ${hi}-${lo}`);
    }
  }
  if (d.extra.trim()) parts.push(d.extra.trim().toUpperCase());
  return parts.join(" / ");
}

function Inner() {
  useStoreVersion();
  const [week, setWeek] = useState(() => currentWeek());
  const [draft, setDraft] = useState<Draft>(() => draftFor(week));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(draftFor(week));
    setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week]);

  const contests = effectiveContests();
  const contest = effectiveContest(week);
  const game = gameForWeek(week);
  const says = composeSays(week, draft);

  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setSaved(false);
  };

  const winnerBtn = (abbr: string, label: string) => (
    <button
      key={abbr}
      type="button"
      onClick={() => set({ winner: draft.winner === abbr ? "" : abbr })}
      className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold transition ${
        draft.winner === abbr
          ? "border-honolulu bg-honolulu/15 text-sky"
          : "border-edge bg-panel text-silver hover:border-edge-2"
      }`}
    >
      {abbr !== TIE && <TeamLogo abbr={abbr} size={22} />}
      {label}
    </button>
  );

  return (
    <div className="space-y-8">
      <SectionTitle kicker="Mother Superior's Office">Mother Superior&rsquo;s Picks</SectionTitle>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {contests.map((c) => (
          <button
            key={c.week}
            type="button"
            onClick={() => setWeek(c.week)}
            className={`shrink-0 whitespace-nowrap rounded-lg border bg-pitch px-3 py-1.5 text-xs font-bold transition ${
              week === c.week
                ? "border-honolulu bg-honolulu/15 text-sky"
                : "border-edge text-fog hover:border-edge-2"
            }`}
          >
            Wk {c.week}
            {mothersPickFor(c.week) && <span className="ml-1 text-win">✓</span>}
          </button>
        ))}
      </div>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="display text-2xl">
              Week {week}
              {game
                ? `: Lions ${game.home || game.neutral ? "vs" : "at"} ${teamInfo(game.opponent).short}`
                : ": Bye week slate"}
            </h3>
            {contest && (
              <p className="mt-1 text-xs text-fog">
                Locks {fmtDateTime(contest.lockAtUTC)}
                <Pill tone={STATUS_TONE[contest.status]} className="ml-2">
                  {contest.status}
                </Pill>
              </p>
            )}
          </div>
        </div>

        {game && (
          <div className="mt-5 space-y-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.15em] text-fog">
                Winner
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {winnerBtn("DET", "Lions win")}
                {winnerBtn(game.opponent, `${teamInfo(game.opponent).short} win`)}
                {winnerBtn(TIE, "Tie")}
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <label className="block">
                <span className="block text-xs font-semibold uppercase tracking-[0.15em] text-fog">
                  Lions score
                </span>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={draft.lions}
                  onChange={(e) => set({ lions: e.target.value })}
                  className="mt-1 w-28 rounded-lg border border-edge bg-panel-2 px-3 py-2 text-sm text-chalk outline-none focus:border-honolulu"
                />
              </label>
              <label className="block">
                <span className="block text-xs font-semibold uppercase tracking-[0.15em] text-fog">
                  {game ? `${teamInfo(game.opponent).short} score` : "Opponent score"}
                </span>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={draft.opp}
                  onChange={(e) => set({ opp: e.target.value })}
                  className="mt-1 w-28 rounded-lg border border-edge bg-panel-2 px-3 py-2 text-sm text-chalk outline-none focus:border-honolulu"
                />
              </label>
            </div>
          </div>
        )}

        <label className="mt-5 block">
          <span className="block text-xs font-semibold uppercase tracking-[0.15em] text-fog">
            From the Commissioner (the weekly announcement)
          </span>
          <textarea
            rows={5}
            value={draft.blurb}
            onChange={(e) => set({ blurb: e.target.value })}
            placeholder="The message the pool reads at the top of This Week. Type as long as it needs to be; readers see the first 100 words and expand for the rest."
            className="mt-1 w-full rounded-lg border border-edge bg-panel-2 px-3 py-2 text-sm leading-relaxed text-chalk outline-none focus:border-honolulu"
          />
        </label>

        <label className="mt-5 block">
          <span className="block text-xs font-semibold uppercase tracking-[0.15em] text-fog">
            Extra calls (optional, e.g. GOFF OVER / WILLIAMS UNDER)
          </span>
          <input
            type="text"
            value={draft.extra}
            onChange={(e) => set({ extra: e.target.value })}
            className="mt-1 w-full rounded-lg border border-edge bg-panel-2 px-3 py-2 text-sm text-chalk outline-none focus:border-honolulu"
          />
        </label>

        <div className="mt-6 rounded-lg border border-gold/40 bg-gold/5 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Mother Superior's Pick
          </div>
          <div className="display mt-1 text-2xl text-chalk">
            {says || "Nothing yet. The pool waits."}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Btn
            disabled={!says && !draft.blurb.trim()}
            onClick={() => {
              saveMothersPick(
                {
                  week,
                  winner: draft.winner || undefined,
                  lions: draft.lions === "" ? undefined : Number(draft.lions),
                  opp: draft.opp === "" ? undefined : Number(draft.opp),
                  extra: draft.extra.trim() || undefined,
                },
                says,
                draft.blurb,
              );
              setSaved(true);
            }}
          >
            Publish the house line
          </Btn>
          {saved && (
            <span className="text-xs font-semibold text-win">
              Published. The pool sees it on This Week the moment the slate is open.
            </span>
          )}
        </div>
      </Card>

      <p className="text-xs text-fog">
        The house line is flavor and psychological warfare. It is not a graded submission and it
        never touches the Nums.
      </p>
    </div>
  );
}
