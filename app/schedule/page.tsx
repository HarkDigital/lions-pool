"use client";

// ---------------------------------------------------------------------------
// /schedule — the full 2026 Lions season, one card per week. Graded weeks
// show the final; the open week points at the pick form; everything else
// waits for Mother Superior to drop the slate. The prerender is
// area-agnostic: a LoadingCard until hydration, then contests and results
// come from the current area's store.
// ---------------------------------------------------------------------------

import { AreaLink as Link } from "@/components/AreaLink";
import type { Contest, ScheduleGame, WeekResults } from "@/lib/types";
import { ALL_WEEKS, BYE_WEEK, SEASON, gameForWeek } from "@/lib/schedule";
import {
  allEffectiveResults,
  effectiveContests,
  useHydrated,
  useStoreVersion,
} from "@/lib/store";
import { teamInfo } from "@/lib/teams";
import { fmtGameDay, fmtKickoff, fmtScore } from "@/lib/format";
import { Card, LoadingCard, Pill, STATUS_TONE, SectionTitle } from "@/components/ui";
import { TeamLogo } from "@/components/TeamLogo";

/** Right-rail status for a week: final score, open slate, or nothing yet. */
function StatusRail({
  contest,
  results,
}: {
  contest: Contest | undefined;
  results: WeekResults | undefined;
}) {
  if (
    contest?.status === "graded" &&
    results &&
    results.lionsScore != null &&
    results.oppScore != null
  ) {
    const lions = results.lionsScore;
    const opp = results.oppScore;
    const won = lions > opp;
    return (
      <div className="flex flex-col items-start gap-1.5 sm:items-end">
        <Pill tone={won ? "win" : "loss"}>
          {won ? "W" : lions === opp ? "T" : "L"} {fmtScore(lions, opp)}
        </Pill>
        <Link
          href="/nums/"
          className="text-xs font-semibold text-sky hover:underline"
        >
          See the Nums →
        </Link>
      </div>
    );
  }
  if (contest?.status === "open") {
    return (
      <div className="flex flex-col items-start gap-1.5 sm:items-end">
        <Pill tone={STATUS_TONE.open}>Slate open</Pill>
        <Link href="/" className="text-xs font-semibold text-sky hover:underline">
          Make your pick →
        </Link>
      </div>
    );
  }
  if (contest?.status === "locked") {
    return <Pill tone={STATUS_TONE.locked}>Locked, grading soon</Pill>;
  }
  return <Pill>Slate drops soon</Pill>;
}

/** The tiny week-number block on the left edge of every card. */
function WeekNumber({ week }: { week: number }) {
  return (
    <div className="w-12 shrink-0 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-fog">
        Week
      </div>
      <div className="display text-4xl leading-none">{week}</div>
    </div>
  );
}

function ByeCard({
  contest,
  results,
}: {
  contest: Contest | undefined;
  results: WeekResults | undefined;
}) {
  return (
    <Card className="border-dashed p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <WeekNumber week={BYE_WEEK} />
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-edge-2 bg-panel-2">
            <span className="display text-lg text-fog">BYE</span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="display text-2xl leading-tight">
            Bye Week: Around-the-League Slate
          </div>
          <div className="mt-1 text-sm text-silver">
            The Lions rest. You do not.
          </div>
          <div className="text-xs text-fog">
            No Lions game, but the pool still runs: a five-game slate from
            around the league. Attendance is not optional.
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Pill tone="gold">Pool still runs</Pill>
          </div>
        </div>
        <div className="shrink-0">
          <StatusRail contest={contest} results={results} />
        </div>
      </div>
    </Card>
  );
}

function GameCard({
  game,
  contest,
  results,
}: {
  game: ScheduleGame;
  contest: Contest | undefined;
  results: WeekResults | undefined;
}) {
  const opp = teamInfo(game.opponent);
  const isMunich = game.country === "Germany";
  const isThanksgiving = game.week === 12;
  return (
    <Card
      className={`p-4 sm:p-5 ${game.home ? "border-l-4 border-l-honolulu/70" : ""}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <WeekNumber week={game.week} />
          <TeamLogo abbr={game.opponent} size={56} className="shrink-0" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="display text-2xl leading-tight">
            <span className="text-fog">{game.home ? "vs" : "at"}</span>{" "}
            {opp.name}
          </div>
          <div className="mt-1 text-sm text-silver">
            {fmtGameDay(game.dateUTC)} · {fmtKickoff(game.dateUTC, game.timeTBD)}
          </div>
          <div className="text-xs text-fog">
            {game.venue} · {game.city}
            {game.country ? `, ${game.country}` : ""}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Pill>{game.broadcast}</Pill>
            {isMunich && <Pill tone="gold">International: Munich</Pill>}
            {isThanksgiving && <Pill tone="gold">Thanksgiving</Pill>}
          </div>
        </div>
        <div className="shrink-0">
          <StatusRail contest={contest} results={results} />
        </div>
      </div>
    </Card>
  );
}

export default function SchedulePage() {
  useStoreVersion();
  const hydrated = useHydrated();

  // Area comes from the URL at call time, so nothing is read until hydration.
  // In the live area every week starts as a draft: no chips, no W/L, every
  // card says "Slate drops soon" until Mother Superior opens it.
  const contests = hydrated ? effectiveContests() : [];
  const results = hydrated ? allEffectiveResults() : [];
  const contestFor = (week: number) => contests.find((c) => c.week === week);
  const resultsFor = (week: number) => results.find((r) => r.week === week);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionTitle kicker={`${SEASON} Season`}>Lions Schedule</SectionTitle>
        <Pill>All times Eastern</Pill>
      </div>

      {!hydrated ? (
        <div className="mt-6">
          <LoadingCard />
        </div>
      ) : (
        <>
          <div className="mt-6 space-y-3">
            {ALL_WEEKS.map((week) => {
              const contest = contestFor(week);
              const weekResults = resultsFor(week);
              if (week === BYE_WEEK) {
                return <ByeCard key={week} contest={contest} results={weekResults} />;
              }
              const game = gameForWeek(week);
              if (!game) return null;
              return (
                <GameCard
                  key={week}
                  game={game}
                  contest={contest}
                  results={weekResults}
                />
              );
            })}
          </div>

          <Card className="mt-8 p-4 text-xs text-fog">
            Schedule, venues, and team logos are sourced from the league. Kickoff
            times can flex late in the season. When the league moves a game, the
            slate moves with it, and Mother Superior does not send reminders.
            Don&apos;t be an idiot.
          </Card>
        </>
      )}
    </div>
  );
}
