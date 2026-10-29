"use client";

// ---------------------------------------------------------------------------
// /admin/office/ — Office Entry. Some players never touch the website; their
// picks arrive by email. Mother Superior picks the week, picks the player,
// and types the pick in on the same form the pool uses. It saves under the
// player's own account like any other submission (the server already lets
// the office write for anyone, lock or no lock), so it grades, ranks, and
// shows on every surface exactly as if the player had filed it.
// ---------------------------------------------------------------------------

import { useState } from "react";
import { AdminGate } from "@/components/AdminGate";
import { AreaLink } from "@/components/AreaLink";
import { PickForm } from "@/components/PickForm";
import { Card, EmptyState, LoadingCard, Pill, SectionTitle, STATUS_TONE } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { gameForWeek } from "@/lib/schedule";
import {
  effectiveContest,
  effectiveContests,
  effectiveSubmissions,
  memberEmails,
  poolPlayers,
  rosterLoaded,
  useHydrated,
  useInboxWeek,
} from "@/lib/store";
import { teamInfo } from "@/lib/teams";
import type { Participant } from "@/lib/types";

export default function OfficeEntryPage() {
  return (
    <AdminGate>
      <Inner />
    </AdminGate>
  );
}

/** Admin-only display label: the nickname once granted, else the real name. */
function label(p: Participant): string {
  return p.nickname.trim() || p.name || p.email || "Unnamed member";
}

function Inner() {
  const hydrated = useHydrated();
  // Opens on the latest ungraded week with picks, not the next one to lock:
  // emailed picks keep arriving for a week after it locks.
  const [week, setWeek] = useInboxWeek();
  const [playerId, setPlayerId] = useState<string | null>(null);
  // Names with a pick already on file stay out of the way by default: the
  // list is a to-do list of who is still missing. "Show all" brings the
  // filed names back so a pick can be corrected.
  const [showAll, setShowAll] = useState(false);
  /** Who just got filed, and for which week: a one-line receipt after the
   * name leaves the rail. Shown only while that week is still selected. */
  const [justFiled, setJustFiled] = useState<{ player: Participant; week: number } | null>(null);

  if (!hydrated) return <LoadingCard label="Opening the office" />;

  const contests = effectiveContests();
  const contest = effectiveContest(week);
  const game = gameForWeek(week);
  // Every live week starts as a PREFILLED draft, so "has questions" is not
  // enough: the slate counts as created only once it has been posted (open,
  // locked, or graded). Emailed picks answer a posted slate, never a draft.
  const slateSet = !!contest && contest.questions.length > 0 && contest.status !== "draft";

  const players = [...poolPlayers()].sort((a, b) => label(a).localeCompare(label(b)));
  const subs = effectiveSubmissions(week);
  const hasSub = (id: string) => subs.some((s) => s.userId === id);
  const player = players.find((p) => p.id === playerId) ?? null;
  const filedCount = players.filter((p) => hasSub(p.id)).length;
  const missingCount = players.length - filedCount;
  // The selected name always stays visible, even once its pick lands, so the
  // form under it never loses its label mid-entry.
  const visible = showAll ? players : players.filter((p) => !hasSub(p.id) || p.id === playerId);

  return (
    <div className="space-y-8">
      <SectionTitle kicker="Mother Superior's Office">Office Entry</SectionTitle>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {contests.map((c) => (
          <button
            key={c.week}
            type="button"
            onClick={() => {
              setWeek(c.week);
              setJustFiled(null);
              setShowAll(false);
            }}
            className={`shrink-0 whitespace-nowrap rounded-lg border bg-pitch px-3 py-1.5 text-xs font-bold transition ${
              week === c.week
                ? "border-honolulu bg-honolulu/15 text-sky"
                : "border-edge text-fog hover:border-edge-2"
            }`}
          >
            Wk {c.week}
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

      {!slateSet ? (
        <Card className="border-dashed p-6 text-center sm:p-8">
          <div className="display text-2xl text-fog">No slate created</div>
          <p className="mx-auto mt-2 max-w-lg text-sm text-fog">
            Week {week} has not been set. Build it in the Contest Builder and flip it open;
            emailed picks get typed in here once the slate is posted.
          </p>
          <AreaLink
            href="/admin/contests/"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-honolulu px-5 py-2.5 text-sm font-bold text-white transition hover:bg-honolulu-deep"
          >
            Build the slate
          </AreaLink>
        </Card>
      ) : !rosterLoaded() ? (
        <LoadingCard label="Opening the roster file" />
      ) : players.length === 0 ? (
        <EmptyState title="Nobody to file under yet">
          Picks get filed under accounts. Create an account for each email address the picks
          arrive from (Clerk dashboard, Users, Create user) and the roster fills in here on its
          own. Nobody has to touch the website.
        </EmptyState>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-6 lg:items-start">
          {/* The list: a horizontal rail on phones, a vertical column on the
              left from lg up, with its own scroll so a long roster never
              pushes the form out of reach. */}
          <section
            aria-labelledby="office-list"
            className="min-w-0 lg:sticky lg:top-20 lg:flex lg:max-h-[calc(100svh-6rem)] lg:flex-col"
          >
            <h3 id="office-list" className="text-xs font-semibold uppercase tracking-[0.2em] text-fog">
              Whose pick arrived?
            </h3>
            <div className="mt-1 text-xs text-fog/80">
              {missingCount === 0
                ? "Every pick is in."
                : `${missingCount} still missing · ${filedCount} filed`}
            </div>
            {filedCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="mt-3 rounded-lg border border-edge bg-pitch px-3 py-1.5 text-xs font-bold text-silver transition hover:border-edge-2 hover:text-chalk lg:w-full"
              >
                {showAll ? "Hide filed picks" : `Show all (${players.length})`}
              </button>
            )}
            {visible.length === 0 ? (
              <p className="mt-3 text-sm text-fog">
                Every Week {week} pick is on file. Nothing to type. Show all to correct one.
              </p>
            ) : (
              <>
                <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 lg:-m-1 lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto lg:p-1 lg:[scrollbar-color:var(--color-edge-2)_transparent] lg:[scrollbar-width:thin]">
                  {visible.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setPlayerId(p.id);
                        setJustFiled(null);
                      }}
                      title={label(p)}
                      className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border bg-pitch px-3 py-1.5 text-left text-xs font-bold transition lg:w-full ${
                        playerId === p.id
                          ? "border-honolulu bg-honolulu/15 text-sky"
                          : "border-edge text-fog hover:border-edge-2"
                      }`}
                    >
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ background: p.avatarColor }}
                      />
                      <span className="min-w-0 lg:truncate">{label(p)}</span>
                      {hasSub(p.id) && <span className="text-win lg:ml-auto">✓</span>}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-fog">
                  {showAll
                    ? `A check means Week ${week} already has a pick on file; select a checked name to correct what is filed.`
                    : `Names with a Week ${week} pick already on file are hidden. Show all to correct one.`}
                </p>
              </>
            )}
          </section>

          <div className="min-w-0">
            {player ? (
              <div className="space-y-3">
                <p className="text-xs text-fog">
                  Filing under {label(player)}
                  {player.name && player.name !== label(player) ? `, ${player.name}` : ""}
                  {memberEmails(player).length > 0 ? ` (${memberEmails(player).join(", ")})` : ""}.
                  Check that against the email before
                  anything gets typed.
                </p>
                <PickForm
                  key={`${week}:${player.id}`}
                  contest={contest!}
                  proxyFor={player}
                  onSaved={(sub) => {
                    // Filed: the name drops off the list (behind Show all) and
                    // the form closes so the next email can be typed in. Only
                    // clears the selection if it is still this player.
                    setJustFiled({ player, week: sub.week });
                    setPlayerId((cur) => (cur === sub.userId ? null : cur));
                  }}
                />
              </div>
            ) : (
              <Card className="border-dashed p-6 text-center sm:p-8">
                {justFiled && justFiled.week === week ? (
                  <>
                    <div className="display text-2xl text-win">
                      Filed for {label(justFiled.player)}
                    </div>
                    <p className="mx-auto mt-2 max-w-lg text-sm text-fog">
                      Week {week} is on file.{" "}
                      {showAll
                        ? "The name stays listed with a check while Show all is on."
                        : "The name has moved behind Show all."}{" "}
                      Pick the next name from the list.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="display text-2xl text-fog">Pick a name from the list</div>
                    <p className="mx-auto mt-2 max-w-lg text-sm text-fog">
                      Choose who the email came from and the Week {week} form opens here.
                    </p>
                  </>
                )}
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
