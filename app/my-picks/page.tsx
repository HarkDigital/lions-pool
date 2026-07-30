"use client";

// ---------------------------------------------------------------------------
// My Picks: the signed-in player's ledger. Season summary up top, then one
// card per week: picks in plain language, and Mother Superior's math once
// graded.
// ---------------------------------------------------------------------------

import Link from "next/link";
import { Card, EmptyState, Pill, SectionTitle } from "@/components/ui";
import { TeamLogo } from "@/components/TeamLogo";
import { CONTESTS, PLAYERS, resultsForWeek, submissionsForWeek } from "@/lib/demo-data";
import { fmtDateTime, fmtPts, fmtScore, ordinal, signedPts } from "@/lib/format";
import { gameForWeek } from "@/lib/schedule";
import { computeStandings, gradeWeek, type SeasonInput } from "@/lib/scoring";
import {
  effectiveContests,
  effectiveResults,
  effectiveSubmissions,
  publicName,
  useHydrated,
  useStoreVersion,
  useUser,
} from "@/lib/store";
import { teamInfo } from "@/lib/teams";
import type {
  AnswerValue,
  Contest,
  Question,
  ScorePick,
  Submission,
  UserWeekGrade,
} from "@/lib/types";

// --- Plain-language answers -------------------------------------------------

function answerLines(q: Question, a: AnswerValue | undefined, graded: boolean): string[] {
  const pays = graded ? "paid" : "pays";
  if (a == null) return [];
  switch (q.kind) {
    case "moneyline": {
      if (typeof a !== "string") return [];
      const opt = q.options.find((o) => o.team === a);
      if (!opt) return [];
      return [`Took the ${teamInfo(a).short} to win (${pays} ${signedPts(opt.points)})`];
    }
    case "spread": {
      if (typeof a !== "string") return [];
      const fav = a === q.favorite;
      const side = fav
        ? `${teamInfo(q.favorite).short} −${fmtPts(q.line)}`
        : `${teamInfo(q.dog).short} +${fmtPts(q.line)}`;
      return [`Took the ${side} (${pays} ${signedPts(fav ? q.favoritePoints : q.dogPoints)})`];
    }
    case "overUnder": {
      if (typeof a !== "string") return [];
      if (a === "exact") {
        return [
          `Straight Money on ${fmtPts(q.line)}: ${q.label} (${pays} ${signedPts(q.exactPoints ?? 0)})`,
        ];
      }
      const over = a === "over";
      return [
        `${over ? "Over" : "Under"} ${fmtPts(q.line)}: ${q.label} (${pays} ${signedPts(over ? q.overPoints : q.underPoints)})`,
      ];
    }
    case "prop": {
      if (typeof a !== "string") return [];
      const opt = q.options.find((o) => o.key === a);
      return [`${q.question}: ${opt?.label ?? a} (${pays} ${signedPts(q.points)})`];
    }
    case "pickem": {
      if (typeof a !== "object") return [];
      const picks = a as Record<string, string>;
      return q.games
        .filter((g) => picks[g.id])
        .map(
          (g) =>
            `${teamInfo(g.away).short} at ${teamInfo(g.home).short}: took the ${teamInfo(picks[g.id]).short}`,
        );
    }
  }
}

/** "Score: BUF 30-27", winner's score first, the way Mother Superior reads them. */
function scorePickText(p: ScorePick): string {
  const lionsWin = p.winner === "DET";
  const hi = lionsWin ? p.lions : p.opp;
  const lo = lionsWin ? p.opp : p.lions;
  return `Score: ${p.winner} ${fmtScore(hi, lo)}`;
}

// --- One week of the ledger -------------------------------------------------

function WeekCard({
  contest,
  sub,
  grade,
  graded,
}: {
  contest: Contest;
  sub?: Submission;
  grade?: UserWeekGrade;
  graded: boolean;
}) {
  const game = gameForWeek(contest.week);
  const open = contest.status === "open";
  const when = game ? fmtDateTime(game.dateUTC) : `locks ${fmtDateTime(contest.lockAtUTC)}`;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-edge p-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-fog">
            Week {contest.week} · {when}
          </div>
          <h3 className="display mt-1 text-2xl">{contest.title}</h3>
          {game ? (
            <div className="mt-2 flex items-center gap-2 text-sm text-silver">
              <TeamLogo abbr="DET" size={24} />
              <span className="font-semibold">Lions</span>
              <span className="text-fog">{game.home || game.neutral ? "vs" : "at"}</span>
              <TeamLogo abbr={game.opponent} size={24} />
              <span className="font-semibold">{teamInfo(game.opponent).short}</span>
              {game.neutral && <Pill className="ml-1">{game.city}</Pill>}
            </div>
          ) : (
            <div className="mt-2">
              <Pill>Around the league</Pill>
            </div>
          )}
        </div>
        <div className="text-right">
          {graded ? (
            <>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-fog">
                Week total
              </div>
              <div className={`display text-4xl ${grade ? "" : "opacity-50"}`}>
                {grade ? signedPts(grade.total) : "0"}
              </div>
            </>
          ) : open ? (
            <Pill tone="blue">Open</Pill>
          ) : contest.status === "locked" ? (
            <Pill>Locked</Pill>
          ) : (
            <Pill>Draft</Pill>
          )}
        </div>
      </div>

      <div className="p-5">
        {sub ? (
          <>
            <ul className="space-y-1 text-sm text-silver">
              {contest.questions.flatMap((q) =>
                answerLines(q, sub.answers[q.id], graded).map((line, i) => (
                  <li key={`${q.id}-${i}`}>{line}</li>
                )),
              )}
              {sub.scorePick && <li>{scorePickText(sub.scorePick)}</li>}
            </ul>
            <div className="mt-2 text-xs text-fog">Submitted {fmtDateTime(sub.submittedAtUTC)}</div>
          </>
        ) : graded ? (
          <p className="text-sm text-fog">No pick. Zero points. Mother Superior remembers.</p>
        ) : null}

        {graded && grade && (
          <div className="mt-4 border-t border-edge pt-3">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-fog">
              Mother Superior’s math
            </div>
            <div className="mt-2 space-y-1">
              {grade.items.map((item, i) => (
                <div key={i} className="flex items-baseline justify-between gap-4 text-sm">
                  <span
                    className={
                      item.kind === "bonus"
                        ? "text-gold"
                        : item.kind === "penalty"
                          ? "text-loss"
                          : "text-silver"
                    }
                  >
                    {item.label}
                  </span>
                  <span
                    className={`font-semibold ${
                      item.kind === "bonus"
                        ? "text-gold"
                        : item.kind === "penalty"
                          ? "text-loss"
                          : item.points > 0
                            ? "text-win"
                            : "text-fog"
                    }`}
                  >
                    {signedPts(item.points)}
                  </span>
                </div>
              ))}
              {grade.items.length === 0 && (
                <p className="text-sm text-fog">
                  Nothing gradable. Mother Superior found nothing to pay.
                </p>
              )}
            </div>
          </div>
        )}

        {open && (
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-edge pt-3 text-sm">
            {sub ? (
              <>
                <Pill tone="win">Locked in</Pill>
                <span className="text-fog">Editable until kickoff.</span>
                <Link href="/" className="font-bold text-sky hover:underline">
                  Edit your pick →
                </Link>
              </>
            ) : (
              <>
                <span className="text-fog">No pick yet. Don’t be an idiot.</span>
                <Link href="/" className="font-bold text-sky hover:underline">
                  Make your pick →
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

// --- Page -------------------------------------------------------------------

export default function MyPicksPage() {
  const hydrated = useHydrated();
  useStoreVersion();
  const user = useUser();

  if (!user) {
    return (
      <div className="space-y-6">
        <SectionTitle kicker="My picks">The Ledger</SectionTitle>
        <EmptyState title="Nobody’s signed in">
          <p>No name, no picks, no points. Mother Superior can’t grade a ghost.</p>
          <Link href="/login/" className="mt-3 inline-block font-bold text-sky hover:underline">
            Enter the Pool →
          </Link>
        </EmptyState>
      </div>
    );
  }

  if (user.isAdmin) {
    return (
      <div className="space-y-6">
        <SectionTitle kicker="My picks">The House Doesn’t Play</SectionTitle>
        <EmptyState title="Mother Superior doesn’t pick. Mother Superior grades.">
          <p>
            The Commissioner sets the lines, keeps the books, and remembers everything. There’s no
            ledger here because the house never loses.
          </p>
          <Link href="/admin/" className="mt-3 inline-block font-bold text-gold hover:underline">
            Go run the pool →
          </Link>
        </EmptyState>
      </div>
    );
  }

  // Baked data until hydration, then the localStorage-aware readers.
  const contests = hydrated ? effectiveContests() : CONTESTS;
  const resultsFor = (week: number) => (hydrated ? effectiveResults(week) : resultsForWeek(week));
  const subsFor = (week: number) =>
    hydrated ? effectiveSubmissions(week) : submissionsForWeek(week);

  // Graded weeks are derived, never hardcoded.
  const gradedInputs: SeasonInput[] = [];
  for (const c of contests) {
    if (c.status !== "graded") continue;
    const results = resultsFor(c.week);
    if (!results) continue;
    gradedInputs.push({ contest: c, results, subs: subsFor(c.week) });
  }

  const standings = computeStandings(
    PLAYERS.map((p) => p.id),
    gradedInputs,
  );
  const me = standings.find((r) => r.userId === user.id);
  const bonuses = me?.bonuses ?? { closest: 0, exacto: 0, perfecto: 0, kod: 0 };

  const weeks = contests
    .filter(
      (c) =>
        c.status === "graded" ||
        c.status === "open" ||
        subsFor(c.week).some((s) => s.userId === user.id),
    )
    .sort((a, b) => b.week - a.week);

  return (
    <div className="space-y-6">
      <SectionTitle kicker="My picks">The Ledger</SectionTitle>

      <Card accent className="p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky">
              Season so far
            </div>
            <div className="mt-2 flex items-center gap-2.5">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ background: user.avatarColor }}
              />
              <span className="display text-3xl">
                {hydrated ? publicName(user) : user.nickname}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-fog">Points</div>
            <div className="display text-5xl">{fmtPts(me?.total ?? 0)}</div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-edge pt-4">
          <div className="flex flex-wrap gap-2">
            <Pill tone={bonuses.closest > 0 ? "gold" : "default"}>
              Closest-To ×{bonuses.closest}
            </Pill>
            <Pill tone={bonuses.exacto > 0 ? "gold" : "default"}>Exacto ×{bonuses.exacto}</Pill>
            <Pill tone={bonuses.perfecto > 0 ? "gold" : "default"}>
              Perfecto ×{bonuses.perfecto}
            </Pill>
            <Pill tone={bonuses.kod > 0 ? "loss" : "default"}>Kiss of Death ×{bonuses.kod}</Pill>
          </div>
          <div className="ml-auto flex items-baseline gap-2 text-sm">
            <span className="font-semibold text-silver">
              {`Rank ${me ? ordinal(me.rank) : "TBD"} of ${PLAYERS.length} players`}
            </span>
            <span className="text-fog">·</span>
            <Link href="/nums/" className="font-semibold text-sky transition hover:text-chalk">
              See the Nums →
            </Link>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        {weeks.map((contest) => {
          const results = resultsFor(contest.week);
          const subs = subsFor(contest.week);
          const sub = subs.find((s) => s.userId === user.id);
          const graded = contest.status === "graded" && results != null;
          const grade =
            contest.status === "graded" && results && sub
              ? gradeWeek(contest, results, subs).find((g) => g.userId === user.id)
              : undefined;
          return (
            <WeekCard
              key={contest.week}
              contest={contest}
              sub={sub}
              grade={grade}
              graded={graded}
            />
          );
        })}
      </div>
    </div>
  );
}
