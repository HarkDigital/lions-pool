"use client";

// ---------------------------------------------------------------------------
// "This Week": the home page. Hero for the open week, Mother Superior's
// announcement (expandable past 100 words), the slate board, the pick form,
// and a top-3 recap.
// ---------------------------------------------------------------------------

import { AreaLink as Link } from "@/components/AreaLink";
import { ExpandableText } from "@/components/ExpandableText";
import type { ContestStatus, Question } from "@/lib/types";
import {

  bonusValues,  currentWeek,
  effectiveContest,
  effectiveContests,
  effectiveResults,
  effectiveSubmissions,
  poolParticipant,
  poolPlayers,
  publicName,
  useHydrated,
  useStoreVersion,
} from "@/lib/store";
import { gameForWeek } from "@/lib/schedule";
import { teamInfo } from "@/lib/teams";
import { computeStandings, type SeasonInput } from "@/lib/scoring";
import { fmtDateTime, fmtGameDay, fmtKickoff, fmtPts } from "@/lib/format";
import {
  Card,
  EmptyState,
  LoadingCard,
  Pill,
  PointsChip,
  STATUS_TONE,
  SectionTitle,
} from "@/components/ui";
import { TeamLogo } from "@/components/TeamLogo";
import { PickForm } from "@/components/PickForm";

function statusPill(status: ContestStatus) {
  return <Pill tone={STATUS_TONE[status]}>{status.toUpperCase()}</Pill>;
}

function QHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-fog">{children}</div>
  );
}

function BoardRow({ label, points }: { label: React.ReactNode; points: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-sm text-silver">{label}</span>
      <PointsChip points={points} />
    </div>
  );
}

/** Read-only board view of one question: the payouts, nothing clickable. */
function BoardQuestion({ q }: { q: Question }) {
  switch (q.kind) {
    case "moneyline":
      return (
        <>
          <QHeader>{q.title ?? "Moneyline: the points divide"}</QHeader>
          <div className="mt-3 space-y-2">
            {q.options.map((o) => (
              <BoardRow
                key={o.team}
                label={
                  <>
                    <TeamLogo abbr={o.team} size={24} /> {teamInfo(o.team).name} to win
                  </>
                }
                points={o.points}
              />
            ))}
          </div>
        </>
      );
    case "spread":
      return (
        <>
          <QHeader>{q.title ?? `The spread: ${q.favorite} −${fmtPts(q.line)}`}</QHeader>
          <div className="mt-3 space-y-2">
            <BoardRow
              label={
                <>
                  <TeamLogo abbr={q.favorite} size={24} /> {teamInfo(q.favorite).short} −
                  {fmtPts(q.line)}
                </>
              }
              points={q.favoritePoints}
            />
            <BoardRow
              label={
                <>
                  <TeamLogo abbr={q.dog} size={24} /> {teamInfo(q.dog).short} +{fmtPts(q.line)} (or
                  outright)
                </>
              }
              points={q.dogPoints}
            />
          </div>
        </>
      );
    case "overUnder":
      return (
        <>
          <QHeader>
            {q.title ?? `Over/Under ${fmtPts(q.line)}: ${q.label}`}
          </QHeader>
          <div className="mt-3 space-y-2">
            <BoardRow label={<>OVER {fmtPts(q.line)}</>} points={q.overPoints} />
            <BoardRow label={<>UNDER {fmtPts(q.line)}</>} points={q.underPoints} />
            {q.exactPoints != null && (
              <BoardRow
                label={<>STRAIGHT MONEY: exactly {fmtPts(q.line)}</>}
                points={q.exactPoints}
              />
            )}
          </div>
          {q.source !== "stat" && (
            <p className="mt-2 text-xs text-fog">
              The score you set automatically decides your Over/Under pick.
            </p>
          )}
        </>
      );
    case "prop":
      return (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <QHeader>{q.title ?? q.question}</QHeader>
            <PointsChip points={q.points} />
          </div>
          <p className="mt-2 text-sm text-silver">{q.options.map((o) => o.label).join(" or ")}</p>
        </>
      );
    case "pickem":
      return (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <QHeader>{q.title ?? `Pick'em: ${q.games.length} games`}</QHeader>
            <span className="text-xs font-semibold text-fog">
              +{fmtPts(q.pointsPerCorrect)} per correct
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {q.games.map((g) => (
              <div key={g.id} className="flex items-center gap-1.5 text-sm text-silver">
                <TeamLogo abbr={g.away} size={22} /> {teamInfo(g.away).short}
                <span className="text-fog">@</span>
                <TeamLogo abbr={g.home} size={22} /> {teamInfo(g.home).short}
              </div>
            ))}
          </div>
          {(q.allCorrectTotal != null || q.allWrongTotal != null) && (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-fog">
              {q.allCorrectTotal != null && (
                <>
                  Run the table: <PointsChip points={q.allCorrectTotal} /> total.
                </>
              )}
              {q.allWrongTotal != null && (
                <>
                  Perfectly wrong: <PointsChip points={q.allWrongTotal} /> total.
                </>
              )}
            </p>
          )}
        </>
      );
  }
}

export default function HomePage() {
  const hydrated = useHydrated();
  useStoreVersion();

  // The prerender is area-agnostic: no data-bearing UI until the URL says
  // which pool (live vs demo) this is.
  if (!hydrated) return <LoadingCard />;

  const week = currentWeek();
  const contest = effectiveContest(week);
  const players = poolPlayers();

  // Graded weeks are derived, never hardcoded.
  const gradedWeeks: SeasonInput[] = effectiveContests()
    .filter((c) => c.status === "graded")
    .flatMap((c) => {
      const results = effectiveResults(c.week);
      if (!results) return [];
      return [{ contest: c, results, subs: effectiveSubmissions(c.week) }];
    });
  const lastGraded = gradedWeeks.reduce((m, w) => Math.max(m, w.contest.week), 0);
  const top3 =
    gradedWeeks.length > 0
      ? computeStandings(
          players.map((p) => p.id),
          gradedWeeks,
          bonusValues(),
        ).slice(0, 3)
      : [];

  if (!contest) {
    return (
      <EmptyState title="No contest this week">
        Mother Superior will post the slate when Mother Superior is ready.
      </EmptyState>
    );
  }

  const isDraft = contest.status === "draft";
  const game = gameForWeek(contest.week);
  const away = game ? (game.home ? game.opponent : "DET") : null;
  const home = game ? (game.home ? "DET" : game.opponent) : null;


  return (
    <div className="space-y-10">
      {/* --- Hero -------------------------------------------------------- */}
      <Card accent className="stripes overflow-hidden">
        <div className="p-6 sm:p-10">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-sky">
            Week {contest.week}
          </div>
          <h1 className="display mt-1 text-4xl sm:text-6xl">
            {away && home ? `${teamInfo(away).short} at ${teamInfo(home).short}` : contest.title}
          </h1>
          {away && home && <p className="mt-1 text-sm font-semibold text-fog">{contest.title}</p>}

          {game && away && home && (
            <div className="mt-8 flex flex-wrap items-center gap-6 sm:gap-10">
              <div className="flex items-center gap-5 sm:gap-8">
                <div className="flex flex-col items-center gap-2">
                  <TeamLogo abbr={away} size={104} />
                  <div className="display text-xl sm:text-2xl">{teamInfo(away).short}</div>
                </div>
                <div className="display text-3xl text-fog sm:text-4xl">@</div>
                <div className="flex flex-col items-center gap-2">
                  <TeamLogo abbr={home} size={104} />
                  <div className="display text-xl sm:text-2xl">{teamInfo(home).short}</div>
                </div>
              </div>
              <div className="space-y-1 text-sm text-silver">
                <div className="font-bold text-chalk">
                  {fmtGameDay(game.dateUTC)} · {fmtKickoff(game.dateUTC, game.timeTBD)}
                </div>
                <div>
                  {game.venue}, {game.city}
                  {game.country ? `, ${game.country}` : ""}
                </div>
                <div className="text-fog">On {game.broadcast}</div>
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-edge pt-4 text-sm text-silver">
            {statusPill(contest.status)}
            <span>Picks lock at kickoff: {fmtDateTime(contest.lockAtUTC)}</span>
          </div>
        </div>
      </Card>

      {isDraft ? (
        /* --- Draft week: the slate hasn't been posted yet ---------------- */
        <Card className="p-6">
          <div className="display text-2xl text-fog">
            Mother Superior hasn&apos;t posted this slate yet
          </div>
          <p className="mt-2 text-sm text-fog">
            The slate lands in your inbox when Mother Superior says it does.
          </p>
        </Card>
      ) : (
        <>
          {/* --- Mother Superior's word ------------------------------------ */}
          {(contest.blurb || contest.motherSays) && (
            <Card className="overflow-hidden">
              {contest.blurb && (
                <div className="px-6 py-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky">
                    From the Commissioner
                  </div>
                  <div className="mt-2">
                    <ExpandableText text={contest.blurb} words={100} />
                  </div>
                </div>
              )}
              {contest.motherSays && (
                <div className="flex flex-wrap items-center gap-3 border-t border-gold/30 bg-gold/5 px-6 py-3">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-gold">
                    Mother Superior Says
                  </span>
                  <span className="display text-xl">{contest.motherSays}</span>
                </div>
              )}
            </Card>
          )}

          {/* --- The slate ------------------------------------------------- */}
          <section>
            <SectionTitle kicker="The points divide">This week&apos;s slate</SectionTitle>
            <Card className="mt-4 divide-y divide-edge overflow-hidden">
              {contest.questions.map((q) => (
                <div key={q.id} className="p-5 sm:p-6">
                  <BoardQuestion q={q} />
                </div>
              ))}
            </Card>
          </section>

          {/* --- The pick form --------------------------------------------- */}
          <PickForm contest={contest} />
        </>
      )}

      {/* --- Top-3 recap --------------------------------------------------- */}
      {top3.length > 0 && (
        <section>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionTitle kicker={`Through Week ${lastGraded}`}>The Nums so far</SectionTitle>
            <Link
              href="/nums/"
              className="text-sm font-semibold text-sky transition hover:text-chalk"
            >
              Full Nums →
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {top3.map((row) => {
              const p = poolParticipant(row.userId);
              if (!p) return null;
              return (
                <Link
                  key={row.userId}
                  href="/nums/"
                  className="flex items-center gap-4 rounded-xl border border-edge bg-panel p-4 transition hover:border-honolulu/60 hover:bg-panel-2"
                >
                  <span className="display text-4xl text-fog">{row.rank}</span>
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: p.avatarColor }}
                    />
                    <span className="truncate text-sm font-bold text-silver">
                      {publicName(p)}
                    </span>
                  </span>
                  <span className="display text-2xl">{fmtPts(row.total)}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
