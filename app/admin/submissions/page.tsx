"use client";

// ---------------------------------------------------------------------------
// /admin/submissions/ — the inbox. Every submission for any week, translated
// out of pick-speak into plain language, with live grading detail on the
// weeks that are already in the books.
// ---------------------------------------------------------------------------

import { Fragment, useState } from "react";
import { AdminGate } from "@/components/AdminGate";
import { TeamLogo } from "@/components/TeamLogo";
import { Card, EmptyState, Pill, STATUS_DOT, STATUS_TONE, SectionTitle } from "@/components/ui";
import { fmtDateTime, fmtPts, fmtScore, signedPts } from "@/lib/format";
import { ALL_WEEKS } from "@/lib/schedule";
import { gradeWeek } from "@/lib/scoring";
import { teamInfo } from "@/lib/teams";
import {

  bonusValues,  currentWeek,
  effectiveContests,
  effectiveResults,
  effectiveSubmissions,
  poolParticipant,
  publicName,
  useStoreVersion,
} from "@/lib/store";
import type { Contest, ContestStatus, ScorePick, Submission } from "@/lib/types";

export default function SubmissionsPage() {
  return (
    <AdminGate>
      <SubmissionsInner />
    </AdminGate>
  );
}

// --- Plain-language rendering of a submission ------------------------------

/** One readable line per question in the contest, in slate order. */
function answerLines(contest: Contest, sub: Submission): string[] {
  return contest.questions.map((q) => {
    const a = sub.answers[q.id];
    switch (q.kind) {
      case "moneyline": {
        if (typeof a !== "string") return "No answer";
        const opt = q.options.find((o) => o.team === a);
        return opt
          ? `${teamInfo(opt.team).short} to win (pays ${fmtPts(opt.points)})`
          : `${a} to win`;
      }
      case "spread": {
        if (typeof a !== "string") return "No answer";
        if (a === q.favorite)
          return `${teamInfo(q.favorite).short} −${fmtPts(q.line)} (pays ${fmtPts(q.favoritePoints)})`;
        if (a === q.dog)
          return `${teamInfo(q.dog).short} +${fmtPts(q.line)} (pays ${fmtPts(q.dogPoints)})`;
        return a;
      }
      case "overUnder": {
        if (typeof a !== "string") return "No answer";
        if (a === "over")
          return `Over ${fmtPts(q.line)} on ${q.label} (pays ${fmtPts(q.overPoints)})`;
        if (a === "under")
          return `Under ${fmtPts(q.line)} on ${q.label} (pays ${fmtPts(q.underPoints)})`;
        if (a === "exact")
          return `Straight Money on ${fmtPts(q.line)}, ${q.label}${
            q.exactPoints != null ? ` (pays ${fmtPts(q.exactPoints)})` : ""
          }`;
        return a;
      }
      case "prop": {
        if (typeof a !== "string") return "No answer";
        const opt = q.options.find((o) => o.key === a);
        return `${q.question}: ${opt?.label ?? a}`;
      }
      case "pickem": {
        if (typeof a !== "object" || a == null) return "No answer";
        const picks: string[] = [];
        for (const g of q.games) {
          const winner = a[g.id];
          if (!winner) continue;
          const loser = winner === g.home ? g.away : g.home;
          picks.push(`${teamInfo(winner).short} over ${teamInfo(loser).short}`);
        }
        return picks.length > 0 ? picks.join(", ") : "No answer";
      }
    }
  });
}

/** "DET 31-20": winner's abbr first, winner's score first. */
function scorePickText(p: ScorePick): string {
  return p.winner === "DET"
    ? `DET ${fmtScore(p.lions, p.opp)}`
    : `${p.winner} ${fmtScore(p.opp, p.lions)}`;
}

// --- Status presentation ----------------------------------------------------

/* Labels are local; tones and dots come from the shared status maps so the
   inbox agrees with the rest of the site about what each color means. */
const STATUS_META: Record<
  ContestStatus,
  { label: string; tone: "default" | "blue" | "gold" | "win" | "loss"; dot: string }
> = {
  draft: { label: "Draft", tone: STATUS_TONE.draft, dot: STATUS_DOT.draft },
  open: { label: "Open", tone: STATUS_TONE.open, dot: STATUS_DOT.open },
  locked: { label: "Locked", tone: STATUS_TONE.locked, dot: STATUS_DOT.locked },
  graded: { label: "Graded", tone: STATUS_TONE.graded, dot: STATUS_DOT.graded },
};

// --- Page -------------------------------------------------------------------

function SubmissionsInner() {
  useStoreVersion();
  // Lazy init: runs on mount inside AdminGate, after hydration, so the
  // area-aware currentWeek() is safe here (never at module scope).
  const [week, setWeek] = useState<number>(() => currentWeek());
  const [expanded, setExpanded] = useState<string | null>(null);

  const contests = effectiveContests();
  const contest = contests.find((c) => c.week === week);
  const results = effectiveResults(week);

  const subs = [...effectiveSubmissions(week)].sort((a, b) =>
    a.submittedAtUTC.localeCompare(b.submittedAtUTC),
  );

  const isGraded = contest?.status === "graded" && results != null;
  const grades =
    isGraded && contest && results
      ? new Map(gradeWeek(contest, results, subs, bonusValues()).map((g) => [g.userId, g]))
      : null;

  const cols = isGraded ? 6 : 4;

  return (
    <div className="space-y-6">
      <SectionTitle kicker="Mother Superior's Office">The Inbox</SectionTitle>

      <div className="space-y-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {ALL_WEEKS.map((w) => {
            const c = contests.find((x) => x.week === w);
            const selected = w === week;
            const dim = c?.status === "draft" && !selected;
            return (
              <button
                key={w}
                type="button"
                onClick={() => {
                  setWeek(w);
                  setExpanded(null);
                }}
                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border bg-pitch px-2.5 py-1.5 text-xs font-bold transition ${
                  selected
                    ? "border-honolulu bg-honolulu/20 text-sky"
                    : dim
                      ? "border-edge text-fog hover:text-silver"
                      : "border-edge-2 text-silver hover:text-chalk"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${c ? STATUS_META[c.status].dot : "bg-edge-2"}`}
                />
                W{w}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-fog">
          {(["graded", "open", "locked", "draft"] as ContestStatus[]).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[s].dot}`} />
              {STATUS_META[s].label.toLowerCase()}
            </span>
          ))}
        </div>
      </div>

      {contest ? (
        <>
          <Card className="p-6">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="display text-2xl">
                Week {contest.week}: {contest.title}
              </h3>
              <Pill tone={STATUS_META[contest.status].tone}>
                {STATUS_META[contest.status].label}
              </Pill>
            </div>
            <div className="mt-2 text-sm text-fog">
              {contest.status === "graded" || contest.status === "locked" ? "Locked" : "Locks"}{" "}
              {fmtDateTime(contest.lockAtUTC)}
            </div>
            {contest.blurb && <p className="mt-3 text-sm italic text-fog">{contest.blurb}</p>}
          </Card>

          {subs.length === 0 ? (
            <EmptyState title="Inbox empty. Suspicious.">
              {contest.status === "draft"
                ? "The slate isn't even posted yet. Nobody can be early to a party that doesn't exist."
                : "Not a single pick in for this week. Mother Superior notices these things."}
            </EmptyState>
          ) : (
            <Card className="overflow-hidden">
              <div className="table-scroll">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-edge text-xs uppercase tracking-wider text-fog">
                      <th className="px-4 py-3">Player</th>
                      <th className="px-4 py-3">Submitted</th>
                      <th className="px-4 py-3">Answers</th>
                      <th className="px-4 py-3">Score pick</th>
                      {isGraded && <th className="px-4 py-3 text-right">Total</th>}
                      {isGraded && <th className="px-4 py-3" />}
                    </tr>
                  </thead>
                  <tbody>
                    {subs.map((s) => {
                      const p = poolParticipant(s.userId);
                      const g = grades?.get(s.userId);
                      const open = expanded === s.userId;
                      return (
                        <Fragment key={s.userId}>
                          <tr className="border-b border-edge last:border-0">
                            <td className="px-4 py-3 align-top">
                              <span className="flex items-start gap-2 whitespace-nowrap">
                                {p && (
                                  <span
                                    className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                                    style={{ background: p.avatarColor }}
                                  />
                                )}
                                <span>
                                  <span className="block font-bold text-chalk">
                                    {p ? publicName(p) : s.userId}
                                  </span>
                                  {p && <span className="block text-xs text-fog">{p.name}</span>}
                                </span>
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 align-top text-xs text-fog">
                              {fmtDateTime(s.submittedAtUTC)}
                            </td>
                            <td className="px-4 py-3 align-top">
                              <ul className="space-y-1 text-xs text-silver">
                                {answerLines(contest, s).map((line, i) => (
                                  <li key={i}>{line}</li>
                                ))}
                              </ul>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 align-top">
                              {s.scorePick ? (
                                <span className="inline-flex items-center gap-1.5 font-semibold text-silver">
                                  <TeamLogo abbr={s.scorePick.winner} size={18} />
                                  {scorePickText(s.scorePick)}
                                </span>
                              ) : (
                                <span className="text-xs text-fog">-</span>
                              )}
                            </td>
                            {isGraded && (
                              <td className="whitespace-nowrap px-4 py-3 text-right align-top">
                                <span
                                  className={`display text-xl ${
                                    g && g.total < 0
                                      ? "text-loss"
                                      : g && g.total > 0
                                        ? "text-win"
                                        : "text-fog"
                                  }`}
                                >
                                  {g ? signedPts(g.total) : "-"}
                                </span>
                              </td>
                            )}
                            {isGraded && (
                              <td className="px-4 py-3 text-right align-top">
                                <button
                                  type="button"
                                  onClick={() => setExpanded(open ? null : s.userId)}
                                  className="text-xs font-bold text-sky hover:underline"
                                >
                                  {open ? "Hide" : "Details"}
                                </button>
                              </td>
                            )}
                          </tr>
                          {open && g && (
                            <tr className="border-b border-edge bg-panel-2 last:border-0">
                              <td colSpan={cols} className="px-4 py-3">
                                <ul className="space-y-1.5">
                                  {g.items.map((item, i) => (
                                    <li
                                      key={i}
                                      className="flex items-center justify-between gap-4 text-xs"
                                    >
                                      <span
                                        className={
                                          item.kind === "bonus"
                                            ? "font-semibold text-gold"
                                            : item.kind === "penalty"
                                              ? "font-semibold text-loss"
                                              : "text-silver"
                                        }
                                      >
                                        {item.label}
                                      </span>
                                      <span
                                        className={`font-bold ${
                                          item.points > 0
                                            ? "text-win"
                                            : item.points < 0
                                              ? "text-loss"
                                              : "text-fog"
                                        }`}
                                      >
                                        {signedPts(item.points)}
                                      </span>
                                    </li>
                                  ))}
                                  {g.items.length === 0 && (
                                    <li className="text-xs text-fog">
                                      Nothing gradeable here. Impressive, in a way.
                                    </li>
                                  )}
                                </ul>
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
        </>
      ) : (
        <EmptyState title="No slate for this week">
          Mother Superior has not built this one yet. Patience.
        </EmptyState>
      )}

      <Card className="border-dashed p-4 text-xs leading-relaxed text-fog">
        <span className="font-bold uppercase tracking-wider text-sky">How this works live: </span>
        in the real thing, picks arrive through the site and lock automatically at kickoff. No
        email chains, no texts at 12:58, no deciphering anyone&apos;s handwriting. The machine
        stamps the time and slams the door. Mother Superior just reads. Team. Win. Score.
      </Card>
    </div>
  );
}
