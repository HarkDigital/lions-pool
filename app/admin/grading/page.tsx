"use client";

// ---------------------------------------------------------------------------
// Admin: the auto-grading console. Enter what actually happened, preview the
// engine's grades for every player (lib/scoring runs right here in the
// browser), then save — the Nums and My Picks pick it up instantly.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { AreaLink } from "@/components/AreaLink";
import type { Contest, Question, TeamAbbr, UserWeekGrade, WeekResults } from "@/lib/types";
import {
  currentWeek,
  effectiveContest,
  effectiveContests,
  effectiveResults,
  effectiveSubmissions,
  isDemoArea,
  poolParticipant,
  publicName,
  saveContest,
  saveResults,
  useStoreVersion,
} from "@/lib/store";
import { gradeWeek } from "@/lib/scoring";
import { gameForWeek } from "@/lib/schedule";
import { teamInfo } from "@/lib/teams";
import { fmtPts, signedPts } from "@/lib/format";
import { AdminGate } from "@/components/AdminGate";
import { TeamLogo } from "@/components/TeamLogo";
import { Btn, Card, EmptyState, Pill, SectionTitle, STATUS_TONE } from "@/components/ui";

const INPUT =
  "w-full rounded-lg border border-edge bg-panel-2 px-3 py-2 text-sm text-chalk outline-none transition focus:border-honolulu/60";
const LABEL = "mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-fog";

const choice = (active: boolean) =>
  `inline-flex items-center rounded-lg border px-3 py-1.5 text-sm font-bold transition ${
    active
      ? "border-honolulu/60 bg-honolulu/15 text-sky"
      : "border-edge bg-panel-2 text-fog hover:border-edge-2 hover:text-silver"
  }`;

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** First ungraded week that has a real slate, else the live week. Call-time
 *  only: the area comes from the URL, so never at module scope. */
function defaultGradingWeek(): number {
  return (
    effectiveContests().find((c) => c.questions.length > 0 && c.status !== "graded")?.week ??
    currentWeek()
  );
}

function qLabel(q: Question): string {
  switch (q.kind) {
    case "moneyline":
      return `Moneyline (${q.options.map((o) => o.team).join(" / ")})`;
    case "spread":
      return `${teamInfo(q.favorite).short} −${fmtPts(q.line)} spread`;
    case "overUnder":
      return `O/U ${fmtPts(q.line)}: ${q.label}`;
    case "prop":
      return q.question;
    case "pickem":
      return `Pick’em (${q.games.length} games)`;
  }
}

// ---------------------------------------------------------------------------
// Per-question gradability. ONE predicate decides whether the engine can
// grade a question from the entered final score or whether Mother Superior
// has to type a per-question actual — and every gate on this page (the missing
// list, which inputs render, the auto-graded caption, the preview/save
// buttons) reads that same predicate, so the console asks for exactly what
// lib/scoring will read.
// ---------------------------------------------------------------------------

/** True when lib/scoring grades `q` purely from the entered final score. */
function gradedFromFinalScore(q: Question, contest: Contest): boolean {
  switch (q.kind) {
    case "moneyline":
      // Only the Lions game itself resolves from the final score; a bonus
      // moneyline on any other matchup needs its winner typed in.
      return contest.hasLionsGame && q.options.some((o) => o.team === "DET");
    case "spread":
      // gradeSpread reads the entered final score, whatever week it is.
      return true;
    case "overUnder":
      // "total" and "lionsMargin" derive from the final score; "stat" is
      // a number Mother Superior types in.
      return q.source !== "stat";
    default:
      // Props and pick'ems are always typed in.
      return false;
  }
}

/** True when the console must collect the final score for this week. */
function needsFinalScore(contest: Contest): boolean {
  return (
    contest.hasLionsGame || contest.questions.some((q) => gradedFromFinalScore(q, contest))
  );
}

/** Everything the admin still has to type before the week can be saved. */
function missingActuals(contest: Contest, r: WeekResults): string[] {
  const out: string[] = [];
  if (needsFinalScore(contest) && (r.lionsScore == null || r.oppScore == null)) {
    out.push("the final score");
  }
  for (const q of contest.questions) {
    if (gradedFromFinalScore(q, contest)) continue;
    if (q.kind === "overUnder" && typeof r.values[q.id] !== "number") {
      out.push(q.label);
    }
    if (q.kind === "prop" && typeof r.values[q.id] !== "string") {
      out.push(q.question);
    }
    if (q.kind === "moneyline" && typeof r.values[q.id] !== "string") {
      out.push(`winner of ${q.options.map((o) => o.team).join(" / ")}`);
    }
    if (q.kind === "pickem") {
      const v = r.values[q.id];
      const map = typeof v === "object" && v != null ? (v as Record<string, string>) : {};
      const left = q.games.filter((g) => !map[g.id]).length;
      if (left > 0) out.push(`${left} pick’em winner${left === 1 ? "" : "s"}`);
    }
  }
  return out;
}

function GradeTable({ grades }: { grades: UserWeekGrade[] }) {
  return (
    <div className="table-scroll mt-4">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold uppercase tracking-wider text-fog">
            <th className="pb-2 pr-4">Player</th>
            <th className="pb-2 pr-4">Line items</th>
            <th className="pb-2 text-right">Week total</th>
          </tr>
        </thead>
        <tbody>
          {grades.map((g) => {
            const p = poolParticipant(g.userId);
            return (
              <tr key={g.userId} className="border-t border-edge align-top">
                <td className="whitespace-nowrap py-3 pr-4">
                  <span className="flex items-center gap-2">
                    {p && (
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: p.avatarColor }}
                      />
                    )}
                    <span>
                      <span className="block font-bold text-silver">
                        {p ? publicName(p) : g.userId}
                      </span>
                      {p && <span className="block text-xs text-fog">{p.name}</span>}
                    </span>
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <ul className="space-y-1">
                    {g.items.map((item, i) => {
                      const labelCls =
                        item.kind === "bonus"
                          ? "text-gold"
                          : item.kind === "penalty"
                            ? "text-loss"
                            : "text-silver";
                      const ptsCls =
                        item.kind === "bonus"
                          ? "text-gold"
                          : item.kind === "penalty" || item.points < 0
                            ? "text-loss"
                            : item.points > 0
                              ? "text-win"
                              : "text-fog";
                      return (
                        <li key={i} className="flex items-baseline justify-between gap-4">
                          <span className={labelCls}>{item.label}</span>
                          <span className={`font-bold ${ptsCls}`}>{signedPts(item.points)}</span>
                        </li>
                      );
                    })}
                    {g.items.length === 0 && <li className="text-fog">No gradable answers</li>}
                  </ul>
                </td>
                <td className="py-3 text-right">
                  <span className="display text-2xl">{fmtPts(g.total)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GradingConsole() {
  // AdminGate only renders children after hydration, so the area-aware
  // selectors are safe from the first render here.
  useStoreVersion();

  const contests = effectiveContests().filter((c) => c.questions.length > 0);
  const isGraded = (week: number, status: Contest["status"]) =>
    status === "graded" && effectiveResults(week) != null;

  const [selectedWeek, setSelectedWeek] = useState<number>(() => defaultGradingWeek());
  const [draft, setDraft] = useState<WeekResults>(() => ({ week: selectedWeek, values: {} }));
  const [preview, setPreview] = useState<UserWeekGrade[] | null>(null);
  const [savedNote, setSavedNote] = useState(false);

  useEffect(() => {
    const existing = effectiveResults(selectedWeek);
    setDraft(existing ? clone(existing) : { week: selectedWeek, values: {} });
    setPreview(null);
    setSavedNote(false);
  }, [selectedWeek]);

  const contest = effectiveContest(selectedWeek);
  const subs = contest ? effectiveSubmissions(selectedWeek) : [];
  const game = gameForWeek(selectedWeek);
  const opp = game?.opponent;

  const touch = () => {
    setPreview(null);
    setSavedNote(false);
  };

  const setScore = (field: "lionsScore" | "oppScore", raw: string) => {
    const n = Number(raw);
    setDraft((d) => ({
      ...d,
      [field]: raw === "" || Number.isNaN(n) ? undefined : Math.max(0, Math.round(n)),
    }));
    touch();
  };

  const setValue = (id: string, v: number | string | undefined) => {
    setDraft((d) => {
      const values = { ...d.values };
      if (v === undefined) delete values[id];
      else values[id] = v;
      return { ...d, values };
    });
    touch();
  };

  const setPickemWinner = (qid: string, gameId: string, team: TeamAbbr) => {
    setDraft((d) => {
      const cur = d.values[qid];
      const map =
        typeof cur === "object" && cur != null ? (cur as Record<string, TeamAbbr>) : {};
      return { ...d, values: { ...d.values, [qid]: { ...map, [gameId]: team } } };
    });
    touch();
  };

  const missing = contest ? missingActuals(contest, draft) : [];
  const scoreNeeded = !!contest && needsFinalScore(contest);
  const scoresMissing = scoreNeeded && (draft.lionsScore == null || draft.oppScore == null);

  const runPreview = () => {
    if (!contest) return;
    setPreview([...gradeWeek(contest, draft, subs)].sort((a, b) => b.total - a.total));
  };

  const handleSave = () => {
    if (!contest) return;
    saveResults({ ...clone(draft), week: contest.week });
    saveContest({ ...clone(contest), status: "graded" });
    setSavedNote(true);
  };

  const needsInput = contest
    ? contest.questions.filter((q) => !gradedFromFinalScore(q, contest))
    : [];
  const autoGraded = contest
    ? contest.questions.filter((q) => gradedFromFinalScore(q, contest))
    : [];

  return (
    <div className="space-y-6">
      <SectionTitle kicker="Admin · After the whistle">Grading Console</SectionTitle>

      {/* Week selector: only weeks with a real slate */}
      <div className="flex flex-wrap gap-2">
        {contests.map((c) => {
          const graded = isGraded(c.week, c.status);
          const active = c.week === selectedWeek;
          return (
            <button
              key={c.week}
              onClick={() => setSelectedWeek(c.week)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-bold transition ${
                active
                  ? "border-honolulu/60 bg-honolulu/15 text-sky"
                  : graded
                    ? "border-win/40 text-win hover:border-win/70"
                    : "border-edge text-fog hover:border-edge-2 hover:text-silver"
              }`}
            >
              Wk {c.week}
              {graded && <span className="ml-1">✓</span>}
            </button>
          );
        })}
      </div>

      {!contest ? (
        <Card className="p-6 text-sm text-fog">Pulling up the week...</Card>
      ) : (
        <>
          <Card className="p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="display text-2xl">
                  Week {contest.week}: {contest.title}
                </h3>
                <div className="mt-0.5 text-xs text-fog">
                  {game && <>{game.home ? "vs" : "@"} {teamInfo(game.opponent).name} · </>}
                  {subs.length} pick{subs.length === 1 ? "" : "s"} in
                </div>
              </div>
              {isGraded(contest.week, contest.status) && (
                <Pill tone={STATUS_TONE.graded}>graded, re-save to adjust</Pill>
              )}
            </div>

            <h4 className="display mb-3 text-lg">What actually happened</h4>
            <div className="space-y-4">
              {scoreNeeded && (
                <div className="grid max-w-lg gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="grading-lions-score" className={LABEL}>
                      <TeamLogo abbr="DET" size={18} /> Lions final score
                    </label>
                    <input
                      id="grading-lions-score"
                      type="number"
                      min={0}
                      step={1}
                      className={INPUT}
                      value={draft.lionsScore ?? ""}
                      onChange={(e) => setScore("lionsScore", e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="grading-opp-score" className={LABEL}>
                      {opp ? (
                        <>
                          <TeamLogo abbr={opp} size={18} /> {teamInfo(opp).short} final score
                        </>
                      ) : (
                        <>Opponent final score</>
                      )}
                    </label>
                    <input
                      id="grading-opp-score"
                      type="number"
                      min={0}
                      step={1}
                      className={INPUT}
                      value={draft.oppScore ?? ""}
                      onChange={(e) => setScore("oppScore", e.target.value)}
                    />
                  </div>
                </div>
              )}

              {needsInput.map((q) => (
                <div key={q.id} className="rounded-lg border border-edge bg-panel-2/50 p-4">
                  {q.kind === "overUnder" && (
                    <>
                      <label
                        htmlFor={`grading-stat-${q.id}`}
                        className="mb-2 block text-sm font-semibold text-silver"
                      >
                        {q.label}{" "}
                        <span className="font-normal text-fog">
                          (the number was {fmtPts(q.line)})
                        </span>
                      </label>
                      <input
                        id={`grading-stat-${q.id}`}
                        type="number"
                        step="any"
                        className={`${INPUT} max-w-40`}
                        value={
                          typeof draft.values[q.id] === "number"
                            ? (draft.values[q.id] as number)
                            : ""
                        }
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          setValue(
                            q.id,
                            e.target.value === "" || Number.isNaN(n) ? undefined : n,
                          );
                        }}
                      />
                    </>
                  )}
                  {q.kind === "prop" && (
                    <>
                      <div className="mb-2 text-sm font-semibold text-silver">{q.question}</div>
                      <div className="flex flex-wrap gap-2">
                        {q.options.map((o) => (
                          <button
                            key={o.key}
                            onClick={() => setValue(q.id, o.key)}
                            className={choice(draft.values[q.id] === o.key)}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {q.kind === "moneyline" && (
                    <>
                      <div className="mb-2 text-sm font-semibold text-silver">
                        Who won{q.title ? ` (${q.title})` : ""}?
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {q.options.map((o) => (
                          <button
                            key={o.team}
                            onClick={() => setValue(q.id, o.team)}
                            className={choice(draft.values[q.id] === o.team)}
                          >
                            <TeamLogo abbr={o.team} size={18} className="mr-1.5" />
                            {teamInfo(o.team).short}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {q.kind === "pickem" && (
                    <>
                      <div className="mb-2 text-sm font-semibold text-silver">
                        Pick’em winners
                      </div>
                      <div className="space-y-2">
                        {q.games.map((g) => {
                          const cur = draft.values[q.id];
                          const winners =
                            typeof cur === "object" && cur != null
                              ? (cur as Record<string, string>)
                              : {};
                          const w = winners[g.id];
                          return (
                            <div key={g.id} className="flex flex-wrap items-center gap-2">
                              <button
                                onClick={() => setPickemWinner(q.id, g.id, g.away)}
                                className={choice(w === g.away)}
                              >
                                <TeamLogo abbr={g.away} size={18} className="mr-1.5" />
                                {g.away}
                              </button>
                              <span className="text-xs text-fog">@</span>
                              <button
                                onClick={() => setPickemWinner(q.id, g.id, g.home)}
                                className={choice(w === g.home)}
                              >
                                <TeamLogo abbr={g.home} size={18} className="mr-1.5" />
                                {g.home}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              ))}

              {autoGraded.length > 0 && (
                <p className="text-xs text-fog">
                  Graded automatically from the final score:{" "}
                  {autoGraded.map(qLabel).join(" · ")}
                </p>
              )}
              {missing.length > 0 && (
                <p className="text-xs font-semibold text-gold">
                  Still needed before saving: {missing.join(" · ")}
                </p>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-edge pt-4">
              <Btn
                onClick={runPreview}
                disabled={subs.length === 0 || scoresMissing}
                className="!px-6 !py-3 !text-base"
              >
                Preview grades
              </Btn>
              <Btn
                kind="ghost"
                onClick={handleSave}
                disabled={subs.length === 0 || missing.length > 0}
              >
                Save &amp; mark graded
              </Btn>
              {savedNote && (
                <span className="text-sm font-semibold text-win">
                  Week {contest.week} is in the books. The Nums and My Picks updated instantly.{" "}
                  {isDemoArea() ? "Saved to this browser (demo)." : "Saved to this browser."}{" "}
                  <AreaLink href="/nums/" className="text-sky underline">
                    See the Nums
                  </AreaLink>
                </span>
              )}
            </div>
          </Card>

          {subs.length === 0 ? (
            <EmptyState title="No picks to grade">
              Nobody has submitted for Week {contest.week}. Mother Superior cannot grade silence.
              Team. Win. Score. Remind them.
            </EmptyState>
          ) : (
            preview && (
              <Card accent className="p-5 sm:p-6">
                <div className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky">
                  Preview: nothing saved yet
                </div>
                <h3 className="display text-2xl">Week {contest.week}, graded</h3>
                <p className="mt-1 text-sm text-fog">
                  This is the automation: scores in, every pick graded, bonuses included.
                </p>
                <GradeTable grades={preview} />
              </Card>
            )
          )}

          <div className="rounded-xl border border-honolulu/40 bg-honolulu/5 p-4 text-sm text-fog">
            <span className="font-bold text-sky">Production note:</span> in the live version a
            nightly job pulls final scores from the league API and this page becomes a one-click
            confirm.{" "}
            {isDemoArea()
              ? "In the demo, the nightly job is you."
              : "Until that job lands with the backend, the nightly job is you."}
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminGradingPage() {
  return (
    <AdminGate>
      <GradingConsole />
    </AdminGate>
  );
}
