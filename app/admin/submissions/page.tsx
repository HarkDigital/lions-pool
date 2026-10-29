"use client";

// ---------------------------------------------------------------------------
// /admin/submissions/ — the inbox. Every submission for any week, translated
// out of pick-speak into plain language, with live grading detail on the
// weeks that are already in the books.
// ---------------------------------------------------------------------------

import { Fragment, useState } from "react";
import { AdminGate } from "@/components/AdminGate";
import { SortTh, sortRows, useSort } from "@/components/sort";
import { TeamLogo } from "@/components/TeamLogo";
import { Btn, Card, EmptyState, Pill, STATUS_DOT, STATUS_TONE, SectionTitle } from "@/components/ui";
import { fmtDateTime, fmtPts, fmtScore, isPickUm, signedPts, spreadSideText } from "@/lib/format";
import { downloadCsv, toCsv } from "@/lib/csv";
import { ALL_WEEKS } from "@/lib/schedule";
import { gradeWeek, isBlankPick } from "@/lib/scoring";
import { teamInfo } from "@/lib/teams";
import {
  bonusValues,
  effectiveContests,
  effectiveResults,
  effectiveSubmissions,
  memberEmails,
  memberNames,
  poolParticipant,
  poolPlayers,
  publicName,
  rosterLoaded,
  useInboxWeek,
} from "@/lib/store";
import { NO_PICK } from "@/lib/types";
import type { Contest, ContestStatus, Question, ScorePick, Submission, UserWeekGrade } from "@/lib/types";

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
    if (a === NO_PICK) return "No pick";
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
          return `${spreadSideText(teamInfo(q.favorite).short, q.line, true)} (pays ${fmtPts(q.favoritePoints)})`;
        if (a === q.dog)
          return `${spreadSideText(teamInfo(q.dog).short, q.line, false)} (pays ${fmtPts(q.dogPoints)})`;
        return a;
      }
      case "overUnder": {
        if (typeof a !== "string") return "No answer";
        if (a === "over")
          return `Over ${fmtPts(q.line)} on ${q.label} (pays ${fmtPts(q.overPoints)})`;
        if (a === "under")
          return `Under ${fmtPts(q.line)} on ${q.label} (pays ${fmtPts(q.underPoints)})`;
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
          if (winner === NO_PICK) {
            picks.push(`No pick on ${teamInfo(g.away).short} at ${teamInfo(g.home).short}`);
            continue;
          }
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

// --- CSV export --------------------------------------------------------------

/** Column header for one question: its title, else a short description. */
function questionHeader(q: Question): string {
  if (q.title) return q.title;
  switch (q.kind) {
    case "moneyline":
      return `Moneyline: ${q.options.map((o) => teamInfo(o.team).short).join(" vs ")}`;
    case "spread":
      return isPickUm(q.line)
        ? `Pick Um: ${teamInfo(q.favorite).short} vs ${teamInfo(q.dog).short}`
        : `Spread: ${teamInfo(q.favorite).short} −${fmtPts(q.line)}`;
    case "overUnder":
      return `O/U ${fmtPts(q.line)}: ${q.label}`;
    case "prop":
      return q.question;
    case "pickem":
      return `Pickum (${q.games.length} games)`;
  }
}

/**
 * One row per submission: who, when, the score pick, one column per slate
 * question in plain language, and the week total once graded. The office's
 * export, so real names and emails ride along.
 */
function buildCsv(
  contest: Contest,
  subs: Submission[],
  grades: Map<string, UserWeekGrade> | null,
): string {
  const header = [
    "Week",
    "Nickname",
    "Name",
    "Email",
    "Submitted (UTC)",
    "Winner",
    "Lions score",
    "Opponent score",
    ...contest.questions.map(questionHeader),
    ...(grades ? ["Week total"] : []),
  ];
  const rows = subs.map((s) => {
    const p = poolParticipant(s.userId);
    const g = grades?.get(s.userId);
    return [
      contest.week,
      p ? publicName(p) : s.userId,
      p?.name ?? "",
      p ? memberEmails(p).join("; ") : "",
      s.submittedAtUTC,
      s.scorePick?.winner ?? (contest.scoreBonuses && !isBlankPick(s) ? "No score" : ""),
      s.scorePick?.lions ?? "",
      s.scorePick?.opp ?? "",
      ...(isBlankPick(s) ? contest.questions.map(() => "No pick (0-0)") : answerLines(contest, s)),
      ...(grades ? [g ? g.total : isBlankPick(s) ? 0 : ""] : []),
    ];
  });
  return toCsv([header, ...rows]);
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

// --- Search -----------------------------------------------------------------

const SEARCH_INPUT =
  "w-full rounded-lg border border-edge bg-panel-2 px-3 py-1.5 text-xs text-chalk outline-none transition placeholder:text-fog focus:border-honolulu/60 sm:w-56";

/** Case-insensitive match on anything the office knows a player by. */
function matchesQuery(sub: Submission, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const p = poolParticipant(sub.userId);
  const haystack = [
    sub.userId,
    p ? publicName(p) : "",
    p?.nickname,
    // Either person on a shared entry should find it: both names, both
    // addresses, and both account ids.
    ...(p ? memberNames(p) : []),
    ...(p ? memberEmails(p) : []),
    ...(p?.memberIds ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

// --- Page -------------------------------------------------------------------

type SortKey = "player" | "submitted" | "answers" | "scorePick" | "total";

function SubmissionsInner() {
  // Opens on the latest ungraded week with picks, not the next one to lock.
  const [week, setWeek] = useInboxWeek();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const { sort, toggle, setSort } = useSort<SortKey>();

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

  // Who still owes a pick: the playing roster minus anyone with a submission
  // on file. Admins are excluded to match effectiveSubmissions(), which drops
  // office rows, so the Commissioner never shows up as a ghost.
  const rosterReady = rosterLoaded();
  const players = poolPlayers().filter((p) => !p.isAdmin);
  const rosterIds = new Set(players.map((p) => p.id));
  // Deleting a member in Clerk does not delete the picks they already filed,
  // so a row can outlive its account. Such a pick belongs to nobody: it is
  // never graded, and it must not count against the roster either, or
  // "submitted" and "yet to submit" stop adding up.
  const filed = rosterReady ? subs.filter((s) => rosterIds.has(s.userId)) : subs;
  const submittedIds = new Set(filed.map((s) => s.userId));
  const ghosts = players.filter((p) => !submittedIds.has(p.id));

  // Search narrows the table only; grading and the CSV still see the whole week.
  const shown = subs.filter((s) => matchesQuery(s, query));
  const searching = query.trim().length > 0;

  const sorted = sortRows<Submission, SortKey>(shown, sort, {
    player: (s) => {
      const p = poolParticipant(s.userId);
      return p ? publicName(p) : s.userId;
    },
    submitted: (s) => s.submittedAtUTC,
    // The cell lists the answers in slate order, so sort on that same text:
    // everyone who took the same side lands in one block. (A count is useless
    // here — most slates carry a single question, so it is 1 for the field.)
    answers: (s) => {
      if (isBlankPick(s) || !contest) return null;
      const lines = answerLines(contest, s).filter((line) => line !== "No answer");
      return lines.length > 0 ? lines.join(" · ") : null;
    },
    scorePick: (s) => (s.scorePick ? scorePickText(s.scorePick) : null),
    total: (s) => grades?.get(s.userId)?.total,
  });

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
                  setSort({ key: null, dir: "asc" });
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="display text-2xl">
                  Week {contest.week}: {contest.title}
                </h3>
                <Pill tone={STATUS_META[contest.status].tone}>
                  {STATUS_META[contest.status].label}
                </Pill>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search players…"
                  aria-label="Search submissions by player"
                  className={SEARCH_INPUT}
                />
                <Btn
                  kind="ghost"
                  disabled={subs.length === 0}
                  onClick={() =>
                    downloadCsv(
                      `lions-pool-week-${contest.week}-submissions.csv`,
                      buildCsv(contest, subs, grades),
                    )
                  }
                  className="px-3 py-1.5 text-xs"
                >
                  Export CSV ({subs.length})
                </Btn>
              </div>
            </div>
            <div className="mt-2 text-sm text-fog">
              {contest.status === "graded" || contest.status === "locked" ? "Locked" : "Locks"}{" "}
              {fmtDateTime(contest.lockAtUTC)}
            </div>
            {searching && subs.length > 0 && (
              <div className="mt-1 text-xs text-fog">
                {shown.length} of {subs.length} {subs.length === 1 ? "submission" : "submissions"} match
                {" "}“{query.trim()}”
              </div>
            )}
            {contest.blurb && <p className="mt-3 text-sm italic text-fog">{contest.blurb}</p>}
            <div className="mt-4 flex flex-wrap gap-x-10 gap-y-3 border-t border-edge pt-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.15em] text-fog">
                  Submitted
                </div>
                <div className="display mt-1 text-3xl">
                  {filed.length}
                  {rosterReady && players.length > 0 && (
                    <span className="ml-1 text-lg text-fog">/ {players.length}</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.15em] text-fog">
                  Yet to submit
                </div>
                <div
                  className={`display mt-1 text-3xl ${
                    !rosterReady ? "text-fog" : ghosts.length > 0 ? "text-gold" : "text-win"
                  }`}
                  title={ghosts.length > 0 ? ghosts.map(publicName).join(", ") : undefined}
                >
                  {rosterReady ? ghosts.length : "–"}
                </div>
                {rosterReady && (
                  <div className="mt-1 text-xs text-fog">
                    {players.length === 0
                      ? "Nobody on the roster yet."
                      : ghosts.length === 0
                        ? "A full inbox. Finally."
                        : ghosts.length === 1
                          ? `${publicName(ghosts[0])} still owes a pick.`
                          : ""}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {subs.length === 0 ? (
            <EmptyState title="Inbox empty. Suspicious.">
              {contest.status === "draft"
                ? "The slate isn't even posted yet. Nobody can be early to a party that doesn't exist."
                : "Not a single pick in for this week. Mother Superior notices these things."}
            </EmptyState>
          ) : shown.length === 0 ? (
            <EmptyState title="Nobody by that name.">
              No submission this week matches “{query.trim()}”. Try a nickname, real name, or email.
            </EmptyState>
          ) : (
            <Card className="overflow-hidden">
              <div className="table-scroll">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-edge text-xs uppercase tracking-wider text-fog">
                      <SortTh k="player" sort={sort} onSort={toggle} className="px-4 py-3">
                        Player
                      </SortTh>
                      <SortTh k="submitted" sort={sort} onSort={toggle} className="px-4 py-3">
                        Submitted
                      </SortTh>
                      <SortTh
                        k="answers"
                        sort={sort}
                        onSort={toggle}
                        className="px-4 py-3"
                      >
                        Answers
                      </SortTh>
                      <SortTh k="scorePick" sort={sort} onSort={toggle} className="px-4 py-3">
                        Score pick
                      </SortTh>
                      {isGraded && (
                        <SortTh
                          k="total"
                          sort={sort}
                          onSort={toggle}
                          className="px-4 py-3 text-right"
                          firstDir="desc"
                        >
                          Total
                        </SortTh>
                      )}
                      {isGraded && <th className="px-4 py-3" />}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((s) => {
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
                                    {p ? publicName(p) : "Deleted account"}
                                  </span>
                                  <span className="block text-xs text-fog">
                                    {p ? p.name : s.userId}
                                  </span>
                                </span>
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 align-top text-xs text-fog">
                              {fmtDateTime(s.submittedAtUTC)}
                            </td>
                            <td className="px-4 py-3 align-top">
                              <ul className="space-y-1 text-xs text-silver">
                                {isBlankPick(s) ? (
                                  <li className="text-fog">No pick (0-0). Zero points.</li>
                                ) : (
                                  answerLines(contest, s).map((line, i) => <li key={i}>{line}</li>)
                                )}
                              </ul>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 align-top">
                              {isBlankPick(s) ? (
                                <span className="text-xs text-fog">No pick (0-0)</span>
                              ) : s.scorePick ? (
                                <span className="inline-flex items-center gap-1.5 font-semibold text-silver">
                                  <TeamLogo abbr={s.scorePick.winner} size={18} />
                                  {scorePickText(s.scorePick)}
                                </span>
                              ) : (
                                <span className="text-xs text-fog">
                                  {contest.scoreBonuses ? "No score" : "-"}
                                </span>
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

    </div>
  );
}
