"use client";

// ---------------------------------------------------------------------------
// /admin/mother/ — Mother Superior's Picks. If the week's slate isn't built,
// this nudges you to the Contest Builder. Once it is, Mother Superior fills
// out the exact same pick form the players use; that pick becomes the house
// line and feeds the "Mother Superior Says" strip on This Week. It is never a
// graded submission and never touches the Nums.
// ---------------------------------------------------------------------------

import { useState } from "react";
import { AdminGate } from "@/components/AdminGate";
import { AreaLink } from "@/components/AreaLink";
import { PickForm } from "@/components/PickForm";
import { Card, LoadingCard, Pill, SectionTitle, STATUS_TONE } from "@/components/ui";
import { fmtDateTime, fmtScore } from "@/lib/format";
import { gameForWeek } from "@/lib/schedule";
import {
  currentWeek,
  effectiveContest,
  effectiveContests,
  mothersSubmission,
  publishMothersLine,
  useHydrated,
  useStoreVersion,
} from "@/lib/store";
import { teamInfo } from "@/lib/teams";
import { TIE, type Contest, type Submission } from "@/lib/types";

export default function MotherPicksPage() {
  return (
    <AdminGate>
      <Inner />
    </AdminGate>
  );
}

/** The "Mother Superior Says" line, built from the house-line pick. */
function composeSays(sub: Submission): string {
  const p = sub.scorePick;
  if (!p) return "";
  if (p.winner === TIE) return `TIE ${fmtScore(p.lions, p.opp)}`;
  const hi = p.winner === "DET" ? p.lions : p.opp;
  const lo = p.winner === "DET" ? p.opp : p.lions;
  return `${teamInfo(p.winner).short.toUpperCase()} WIN ${fmtScore(hi, lo)}`;
}

function Inner() {
  useStoreVersion();
  const hydrated = useHydrated();
  const [week, setWeek] = useState(() => currentWeek());

  if (!hydrated) return <LoadingCard label="Opening the office" />;

  const contests = effectiveContests();
  const contest = effectiveContest(week);
  const game = gameForWeek(week);
  const slateReady = !!contest && contest.questions.length > 0;

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
            {mothersSubmission(c.week) && <span className="ml-1 text-win">✓</span>}
          </button>
        ))}
      </div>

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

      {slateReady ? (
        <MotherPick contest={contest!} />
      ) : (
        <Card className="border-dashed p-6 text-center sm:p-8">
          <div className="display text-2xl text-fog">This slate isn&rsquo;t built yet</div>
          <p className="mx-auto mt-2 max-w-lg text-sm text-fog">
            Set Week {week} in the Contest Builder first: the questions, the divide, the lock time.
            Once the slate exists, Mother Superior makes the house pick right here, on the same form
            the pool uses.
          </p>
          <AreaLink
            href="/admin/contests/"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-honolulu px-5 py-2.5 text-sm font-bold text-white transition hover:bg-honolulu-deep"
          >
            Build the slate
          </AreaLink>
        </Card>
      )}
    </div>
  );
}

/** Renders the players' pick form in house-line mode for the built slate. */
function MotherPick({ contest }: { contest: Contest }) {
  useStoreVersion();
  const existing = mothersSubmission(contest.week);
  return (
    <PickForm
      contest={contest}
      houseLine
      houseSubmission={existing}
      onHouseSave={(sub) => publishMothersLine(contest, sub, composeSays(sub))}
    />
  );
}
