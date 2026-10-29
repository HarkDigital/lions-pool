"use client";

// ---------------------------------------------------------------------------
// The heart of the site: the pick form. Renders any contest shape Mother
// Superior can build (winner + score, moneylines, spreads, over/unders
// (derived or stat), props, and multi-game pick'em slates) and saves through
// lib/store. Winner and score can never contradict: score edits drive the
// winner automatically, and a contradictory winner click swaps the scores.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AreaLink as Link } from "@/components/AreaLink";
import type {
  AnswerValue,
  Contest,
  MoneylineQ,
  OverUnderQ,
  Participant,
  Question,
  SpreadQ,
  Submission,
  PickemGame,
  TeamAbbr,
} from "@/lib/types";
import { NO_PICK, TIE } from "@/lib/types";
import { isContestOpen, mySubmission, saveSubmission, useStoreVersion, useUser } from "@/lib/store";
import { isBlankPick, isLionsPickemGame, spreadSideFromScore } from "@/lib/scoring";
import { gameForWeek, locksAtKickoff } from "@/lib/schedule";
import { teamInfo } from "@/lib/teams";
import { fmtDateTime, fmtLockEastern, fmtPts, fmtScore, spreadSideText, spreadTitle } from "@/lib/format";
import { Btn, Card, Pill, PointsChip } from "@/components/ui";
import { TeamLogo } from "@/components/TeamLogo";

// --- Local helpers ----------------------------------------------------------

type OUAnswer = "over" | "under";

interface Draft {
  winner: TeamAbbr | null;
  lions: string;
  opp: string;
  answers: Record<string, AnswerValue>;
  /** Office entry: the player sent picks but no Lions score. */
  noScore: boolean;
}

const EMPTY_DRAFT: Draft = { winner: null, lions: "", opp: "", answers: {}, noScore: false };

function draftFrom(sub: Submission): Draft {
  return {
    winner: sub.scorePick?.winner ?? null,
    lions: sub.scorePick != null ? String(sub.scorePick.lions) : "",
    opp: sub.scorePick != null ? String(sub.scorePick.opp) : "",
    answers: { ...sub.answers },
    // Only meaningful on a score week (the form checks): a saved pick with
    // no score on file was filed as "no score".
    noScore: sub.scorePick == null,
  };
}

/** Whole number 0 to 99, or null. */
function parseScore(raw: string): number | null {
  return /^\d{1,2}$/.test(raw.trim()) ? Number(raw.trim()) : null;
}

/** The non-Lions team for this week, from the questions or the schedule. */
function opponentAbbr(contest: Contest): TeamAbbr {
  for (const q of contest.questions) {
    if (q.kind === "moneyline") {
      const other = q.options.find((o) => o.team !== "DET");
      if (other) return other.team;
    }
    if (q.kind === "spread") return q.favorite === "DET" ? q.dog : q.favorite;
  }
  return gameForWeek(contest.week)?.opponent ?? "OPP";
}

function ouAnswerFromScore(
  q: OverUnderQ,
  lions: number,
  opp: number,
): { value: number; answer: OUAnswer | null } {
  const value = q.source === "lionsMargin" ? lions - opp : lions + opp;
  // Exactly on the line is neither side; the score bonuses reward exactness.
  if (value === q.line) return { value, answer: null };
  return { value, answer: value > q.line ? "over" : "under" };
}

function ouPays(q: OverUnderQ, answer: OUAnswer): number {
  return answer === "over" ? q.overPoints : q.underPoints;
}

// --- Small presentational bits ----------------------------------------------

function QHeader({ children }: { children: ReactNode }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-fog">{children}</div>
  );
}

function OptionBtn({
  selected,
  onClick,
  children,
  className = "",
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm font-semibold transition active:scale-[0.98] motion-reduce:active:scale-100 ${
        selected
          ? "border-honolulu bg-honolulu/15 text-chalk"
          : "border-edge bg-panel-2 text-silver hover:border-edge-2"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function ScoreInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-fog">
      {label}
      <input
        type="number"
        min={0}
        max={99}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-24 rounded-lg border border-edge bg-panel-2 px-3 py-2 text-lg font-bold text-chalk outline-none transition focus:border-honolulu"
      />
    </label>
  );
}

// --- Submitted summary -------------------------------------------------------

function answerLine(q: Question, sub: Submission): ReactNode {
  const a = sub.answers[q.id];
  const missing = <span className="text-fog">No answer</span>;
  if (a === NO_PICK) return <span className="text-fog">No pick. Zero points.</span>;
  switch (q.kind) {
    case "moneyline": {
      if (typeof a !== "string") return missing;
      if (a === TIE)
        return (
          <span className="text-silver">Called a tie. Score bonuses only; no winner points.</span>
        );
      const opt = q.options.find((o) => o.team === a);
      return (
        <>
          <span className="flex items-center gap-2 text-silver">
            <TeamLogo abbr={a} size={20} /> {teamInfo(a).short} to win
          </span>
          {opt && <PointsChip points={opt.points} />}
        </>
      );
    }
    case "spread": {
      if (typeof a !== "string") return missing;
      const pickedFav = a === q.favorite;
      return (
        <>
          <span className="flex items-center gap-2 text-silver">
            <TeamLogo abbr={a} size={20} /> {spreadSideText(teamInfo(a).short, q.line, pickedFav)}
          </span>
          <PointsChip points={pickedFav ? q.favoritePoints : q.dogPoints} />
        </>
      );
    }
    case "overUnder": {
      if (a !== "over" && a !== "under") return missing;
      const label = `${a === "over" ? "Over" : "Under"} ${fmtPts(q.line)}`;
      return (
        <>
          <span className="text-silver">
            {label} <span className="text-fog">({q.label})</span>
          </span>
          <PointsChip points={ouPays(q, a)} />
        </>
      );
    }
    case "prop": {
      if (typeof a !== "string") return missing;
      const opt = q.options.find((o) => o.key === a);
      const heading = (q.title && q.title.trim()) || q.question;
      return (
        <>
          <span className="text-silver">
            {heading ? `${heading}: ` : ""}
            <span className="font-semibold text-chalk">{opt?.label ?? a}</span>
          </span>
          <PointsChip points={q.points} />
        </>
      );
    }
    case "pickem": {
      const map = (typeof a === "object" && a != null ? a : {}) as Record<string, TeamAbbr>;
      return (
        <span className="flex flex-wrap gap-2">
          {q.games.map((g) => (
            <span
              key={g.id}
              className="inline-flex items-center gap-1 rounded-full border border-edge bg-panel-2 px-2 py-0.5 text-xs text-fog"
            >
              {g.away} @ {g.home} →{" "}
              <span className="font-bold text-chalk">
                {!map[g.id] || map[g.id] === NO_PICK ? "no pick" : map[g.id]}
              </span>
            </span>
          ))}
        </span>
      );
    }
  }
}

function SubmittedCard({
  contest,
  sub,
  canEdit,
  onEdit,
  houseLine = false,
  proxyName,
}: {
  contest: Contest;
  sub: Submission;
  canEdit: boolean;
  onEdit: () => void;
  houseLine?: boolean;
  /** Office entry: the display name of the player this pick was filed for. */
  proxyName?: string | null;
}) {
  return (
    <Card accent className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Pill tone="win">
            {houseLine
              ? "HOUSE LINE PUBLISHED"
              : isBlankPick(sub)
                ? "FILED AS NO PICK"
                : proxyName
                  ? "PICK IS ON FILE"
                  : "PICK IS IN"}
          </Pill>
          <span className="text-sm text-fog">
            {houseLine
              ? "The pool reads this as Mother Superior Says"
              : proxyName
                ? `Entered from the office for ${proxyName}`
                : locksAtKickoff(contest)
                  ? `Locked at kickoff: ${fmtDateTime(contest.lockAtUTC)}`
                  : `Locked: ${fmtDateTime(contest.lockAtUTC)}`}
          </span>
        </div>
        {canEdit && (
          <Btn kind="ghost" onClick={onEdit}>
            Edit
          </Btn>
        )}
      </div>
      <div className="space-y-4 p-5 sm:p-6">
        {isBlankPick(sub) ? (
          <div>
            <div className="display text-3xl text-fog">No pick (0-0)</div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-fog">
              Zero points this week
            </div>
          </div>
        ) : (
          <>
          {contest.scoreBonuses && !sub.scorePick && (
            <div>
              <div className="display text-3xl text-fog">No score sent</div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-fog">
                No score bonuses this week
              </div>
            </div>
          )}
          {sub.scorePick &&
            (sub.scorePick.winner === TIE ? (
              <div>
                <div className="display text-3xl">
                  Tie, {fmtScore(sub.scorePick.lions, sub.scorePick.opp)}
                </div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-fog">
                  Winner and score
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <TeamLogo abbr={sub.scorePick.winner} size={40} />
                <div>
                  <div className="display text-3xl">
                    {teamInfo(sub.scorePick.winner).short} win{" "}
                    {sub.scorePick.winner === "DET"
                      ? fmtScore(sub.scorePick.lions, sub.scorePick.opp)
                      : fmtScore(sub.scorePick.opp, sub.scorePick.lions)}
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-fog">
                    Winner and score
                  </div>
                </div>
              </div>
            ))}
          <ul className="space-y-2 text-sm">
            {contest.questions.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-3">
                {answerLine(q, sub)}
              </li>
            ))}
          </ul>
          <p className="text-xs text-fog">
            {houseLine ? "Published" : "Submitted"} {fmtDateTime(sub.submittedAtUTC)}.
            {canEdit &&
              (houseLine
                ? " Revise it whenever."
                : proxyName
                  ? " The office can edit this whenever."
                  : " You can edit until kickoff. After that, you live with it.")}
          </p>
          </>
        )}
      </div>
    </Card>
  );
}

// --- The form ----------------------------------------------------------------

export function PickForm({
  contest,
  houseLine = false,
  houseSubmission,
  onHouseSave,
  proxyFor,
  onSaved,
}: {
  contest: Contest;
  houseLine?: boolean;
  houseSubmission?: Submission;
  onHouseSave?: (sub: Submission) => void;
  /** Fires after a pick is saved to the store (not for the house line). Office
   * entry uses it to clear the selected name once the pick is on file. */
  onSaved?: (sub: Submission) => void;
  /**
   * Office entry: the player this pick is being filed for. Admin-only. The
   * form saves under this player's id like a normal submission, and the lock
   * does not apply (picks that arrive by email get typed in whenever).
   */
  proxyFor?: Participant;
}) {
  useStoreVersion();
  const user = useUser();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [showErrors, setShowErrors] = useState(false);
  /** In flight to the server; the button waits so a pick is never filed twice. */
  const [saving, setSaving] = useState(false);
  /** The server refused or never answered: say so instead of pretending. */
  const [saveError, setSaveError] = useState<string | null>(null);
  /** False once unmounted: a save that resolves after the office moved on to
   * the next name has nothing left to report (the cache already knows). */
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  /** Info-tone note shown when the form auto-reconciles winner and score. */
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  if (!user) {
    return (
      <Card accent className="p-6 text-center sm:p-8">
        <div className="display text-2xl">Make your pick</div>
        <p className="mt-2 text-sm text-fog">
          None of that happens from the bleachers.
        </p>
        <Link
          href="/login/"
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-honolulu px-5 py-2.5 text-sm font-bold text-white transition hover:bg-honolulu-deep"
        >
          Enter the pool to make your pick
        </Link>
      </Card>
    );
  }

  // Proxy entry is the office's move alone; a player never files for another.
  if (proxyFor && !user.isAdmin) return null;

  const existing = houseLine
    ? houseSubmission
    : mySubmission(contest.week, (proxyFor ?? user).id);
  // The office answers to nobody's clock: house line and proxy entry stay
  // editable past the lock (the server allows admin writes any time).
  const isOpen = houseLine || proxyFor ? true : isContestOpen(contest);
  const proxyName = proxyFor ? proxyFor.nickname.trim() || proxyFor.name || "this account" : null;

  if (existing && !editing) {
    return (
      <SubmittedCard
        contest={contest}
        sub={existing}
        canEdit={isOpen}
        houseLine={houseLine}
        proxyName={proxyName}
        onEdit={() => {
          setDraft(draftFrom(existing));
          setShowErrors(false);
          setSyncNotice(null);
          setEditing(true);
        }}
      />
    );
  }

  if (!isOpen) {
    return (
      <Card className="p-6">
        <div className="display text-2xl text-fog">
          {contest.status === "draft"
            ? "Mother Superior hasn't posted this slate"
            : "Picks are locked for this week"}
        </div>
        {contest.status === "draft" && (
          <p className="mt-2 text-sm text-fog">You will be notified.</p>
        )}
      </Card>
    );
  }

  // --- Form state derivations ------------------------------------------------

  const opp = opponentAbbr(contest);
  const needsScore = contest.scoreBonuses;
  /** Office entry on a score week, filed with no Lions score: everything the
   *  score would pick files as no pick, and the score bonuses skip them. */
  const noScore = !!proxyFor && needsScore && draft.noScore;
  const lionsN = parseScore(draft.lions);
  const oppN = parseScore(draft.opp);

  /** The Lions-game moneyline, if any: the winner buttons ARE its answer. */
  const lionsML = needsScore
    ? contest.questions.find(
        (q): q is MoneylineQ => q.kind === "moneyline" && q.options.some((o) => o.team === "DET"),
      )
    : undefined;

  const winnerChoices: { team: TeamAbbr; points?: number }[] = lionsML
    ? lionsML.options
    : [{ team: "DET" }, { team: opp }];

  const isDerivedOU = (q: OverUnderQ) => q.source !== "stat" && needsScore && !q.answeredByPlayer;

  /** The Lions game on a pick'em slate: the score picks it, so no buttons. */
  const isDerivedPickemGame = (g: PickemGame) => needsScore && isLionsPickemGame(g);

  /** "Mother Superior does the math" spreads: no side buttons, the score IS the pick. */
  const isDerivedSpread = (q: SpreadQ) => !!q.derived && needsScore;

  /**
   * Slate order on a score week: the spread(s) the player answers lead, then
   * the score entry, then everything else. The winner is never asked for
   * separately unless a Lions moneyline puts points on it; a complete score
   * already says who wins.
   */
  const leadSpreads = needsScore
    ? contest.questions.filter((q): q is SpreadQ => q.kind === "spread" && !isDerivedSpread(q))
    : [];
  const trailingQuestions = contest.questions.filter((q) => !leadSpreads.includes(q as SpreadQ));
  const showWinnerButtons = needsScore && lionsML != null;

  /** Winner implied by a complete score. Equal scores are a legal tie pick. */
  const scoreWinner = (l: number, o: number): TeamAbbr => (l === o ? TIE : l > o ? "DET" : opp);

  const isTiePick = lionsN != null && oppN != null && lionsN === oppN;

  /**
   * Lions-game spreads answer themselves from the score: once both numbers
   * are in, the side the score covers IS the pick, whatever was clicked. The
   * buttons still take a click before a score exists (or on a push, when
   * the score lands exactly on the line and picks nothing).
   */
  const scoreDrivesSpread = (q: SpreadQ) =>
    leadSpreads.includes(q) && (q.favorite === "DET" || q.dog === "DET");
  const spreadSide = (q: SpreadQ): TeamAbbr | undefined => {
    if (scoreDrivesSpread(q) && lionsN != null && oppN != null) {
      const implied = spreadSideFromScore(q, { lions: lionsN, opp: oppN });
      if (implied) return implied;
    }
    const clicked = draft.answers[q.id];
    return typeof clicked === "string" ? (clicked as TeamAbbr) : undefined;
  };

  const isAnswered = (q: Question): boolean => {
    switch (q.kind) {
      case "moneyline":
        return q === lionsML
          ? noScore || draft.winner != null
          : typeof draft.answers[q.id] === "string";
      case "spread":
        // Derived weeks only need the score; Mother Superior does the math on the side.
        if (isDerivedSpread(q)) return noScore || (lionsN != null && oppN != null);
        return spreadSide(q) != null;
      case "overUnder":
        if (isDerivedOU(q)) {
          if (noScore) return true;
          if (lionsN == null || oppN == null) return false;
          return ouAnswerFromScore(q, lionsN, oppN).answer != null;
        }
        return typeof draft.answers[q.id] === "string";
      case "pickem": {
        // A slate with zero games has nothing to answer; never brick the form.
        const a = draft.answers[q.id];
        const map = (typeof a === "object" && a != null ? a : {}) as Record<string, string>;
        return q.games.every((g) =>
          isDerivedPickemGame(g)
            ? noScore || (lionsN != null && oppN != null)
            : typeof map[g.id] === "string",
        );
      }
      default:
        return typeof draft.answers[q.id] === "string";
    }
  };

  // 0-0 is the office's "nothing arrived" and files as no pick. A player
  // typing it would forfeit their week, so the form refuses it from them.
  const blankEntry = !!proxyFor && needsScore && lionsN === 0 && oppN === 0;
  const problems: string[] = [];
  if (needsScore && !noScore) {
    if (showWinnerButtons && draft.winner == null) problems.push("Pick a winner.");
    if (lionsN == null || oppN == null)
      problems.push("Give Mother Superior both scores: whole numbers, 0 to 99.");
    else if (!proxyFor && lionsN === 0 && oppN === 0)
      problems.push("0-0 is not a score. Give Mother Superior a real one.");
  }
  if (!blankEntry && contest.questions.some((q) => !isAnswered(q)))
    problems.push("Answer everything on the slate. Mother Superior doesn't grade partial credit.");

  // --- State setters ----------------------------------------------------------

  /**
   * Winner and score can never contradict. Clicking a side that disagrees
   * with a complete score swaps the two numbers to match the click; a tied
   * score ignores the click (the tie note right below explains why).
   */
  const setWinner = (team: TeamAbbr) => {
    if (lionsN != null && oppN != null) {
      if (lionsN === oppN) return;
      if (scoreWinner(lionsN, oppN) !== team) {
        setDraft((d) => ({ ...d, winner: team, lions: d.opp, opp: d.lions }));
        setSyncNotice("Scores swapped to match your winner.");
        return;
      }
    }
    setDraft((d) => ({ ...d, winner: team }));
    setSyncNotice(null);
  };

  /**
   * Score edits drive the winner: a complete, unequal score selects the
   * higher side automatically; an equal score clears the selection to TIE.
   */
  const applyScores = (nextLions: string, nextOpp: string) => {
    const l = parseScore(nextLions);
    const o = parseScore(nextOpp);
    const derived = l != null && o != null ? scoreWinner(l, o) : null;
    const prev = draft.winner;
    setDraft((d) => ({ ...d, lions: nextLions, opp: nextOpp, winner: derived ?? d.winner }));
    setSyncNotice(
      derived != null && derived !== TIE && prev != null && prev !== TIE && derived !== prev
        ? `Winner changed to ${teamInfo(derived).short} based on your score.`
        : null,
    );
  };

  /** Office entry: no score sent. Clears the score so nothing derives from it. */
  const setNoScore = (on: boolean) => {
    setDraft((d) => ({ ...d, noScore: on, ...(on ? { lions: "", opp: "", winner: null } : {}) }));
    setSyncNotice(null);
  };

  const setAnswer = (qid: string, value: string) =>
    setDraft((d) => ({ ...d, answers: { ...d.answers, [qid]: value } }));

  const setPickemPick = (qid: string, gameId: string, team: TeamAbbr) =>
    setDraft((d) => {
      const cur = d.answers[qid];
      const map: Record<string, TeamAbbr> = typeof cur === "object" && cur != null ? { ...cur } : {};
      map[gameId] = team;
      return { ...d, answers: { ...d.answers, [qid]: map } };
    });

  const pickemPick = (qid: string, gameId: string): TeamAbbr | undefined => {
    const cur = draft.answers[qid];
    return typeof cur === "object" && cur != null ? cur[gameId] : undefined;
  };

  const save = async () => {
    if (saving) return;
    // Re-check the clock: a player form left open past the lock refuses to
    // submit. The house line and office entry have no lock.
    if (!houseLine && !proxyFor && !isContestOpen(contest)) {
      setEditing(false);
      return;
    }
    if (problems.length > 0) {
      setShowErrors(true);
      return;
    }
    const answers: Record<string, AnswerValue> = {};
    for (const q of contest.questions) {
      if (noScore && q.kind === "moneyline" && q === lionsML) {
        answers[q.id] = NO_PICK;
        continue;
      }
      if (noScore && q.kind === "spread" && isDerivedSpread(q)) {
        answers[q.id] = NO_PICK;
        continue;
      }
      if (noScore && q.kind === "overUnder" && isDerivedOU(q)) {
        answers[q.id] = NO_PICK;
        continue;
      }
      if (q.kind === "moneyline" && q === lionsML) {
        // A tie pick stores TIE: it matches neither side at grading, by design.
        answers[q.id] = scoreWinner(lionsN!, oppN!);
        continue;
      }
      if (q.kind === "spread") {
        answers[q.id] = isDerivedSpread(q)
          ? spreadSideFromScore(q, { lions: lionsN!, opp: oppN! })!
          : spreadSide(q)!;
        continue;
      }
      if (q.kind === "pickem" && q.games.some(isDerivedPickemGame)) {
        const cur = draft.answers[q.id];
        const map: Record<string, TeamAbbr> =
          typeof cur === "object" && cur != null ? { ...cur } : {};
        // A tie score stores TIE: it matches neither side unless the game ties.
        for (const g of q.games)
          if (isDerivedPickemGame(g)) map[g.id] = noScore ? NO_PICK : scoreWinner(lionsN!, oppN!);
        answers[q.id] = map;
        continue;
      }
      if (q.kind === "overUnder" && isDerivedOU(q)) {
        answers[q.id] = ouAnswerFromScore(q, lionsN!, oppN!).answer!;
        continue;
      }
      answers[q.id] = draft.answers[q.id];
    }
    const sub: Submission = {
      userId: (proxyFor ?? user).id,
      week: contest.week,
      submittedAtUTC: new Date().toISOString(),
      answers: blankEntry ? {} : answers,
      scorePick: needsScore && !noScore
        ? { winner: scoreWinner(lionsN!, oppN!), lions: lionsN!, opp: oppN! }
        : undefined,
    };
    if (houseLine && onHouseSave) {
      onHouseSave(sub);
      setShowErrors(false);
      setEditing(false);
      return;
    }
    setSaving(true);
    setSaveError(null);
    let ok = false;
    try {
      ok = await saveSubmission(sub);
    } catch {
      ok = false;
    }
    if (!alive.current) return;
    setSaving(false);
    if (!ok) {
      setSaveError("That did not save. Check the connection and try again.");
      return;
    }
    setShowErrors(false);
    setEditing(false);
    onSaved?.(sub);
  };

  // --- Per-question controls ---------------------------------------------------

  /** Office entry only: mark a question the player never sent. */
  const noPickBtn = (qid: string) =>
    proxyFor && (
      <OptionBtn
        selected={draft.answers[qid] === NO_PICK}
        onClick={() => setAnswer(qid, NO_PICK)}
        className="mt-2 w-full justify-center py-2 text-xs"
      >
        No pick (0 points)
      </OptionBtn>
    );

  const renderQuestion = (q: Question): ReactNode => {
    switch (q.kind) {
      case "moneyline": {
        if (q === lionsML) return null; // merged into the winner buttons above
        return (
          <section key={q.id}>
            <QHeader>{q.title ?? "Moneyline: the points divide"}</QHeader>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {q.options.map((o) => (
                <OptionBtn
                  key={o.team}
                  selected={draft.answers[q.id] === o.team}
                  onClick={() => setAnswer(q.id, o.team)}
                >
                  <span className="flex items-center gap-2">
                    <TeamLogo abbr={o.team} size={24} /> {teamInfo(o.team).short} to win
                  </span>
                  <PointsChip points={o.points} />
                </OptionBtn>
              ))}
            </div>
            {noPickBtn(q.id)}
          </section>
        );
      }
      case "spread": {
        if (isDerivedSpread(q)) {
          const side =
            lionsN != null && oppN != null
              ? spreadSideFromScore(q, { lions: lionsN, opp: oppN })
              : null;
          return (
            <section key={q.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <QHeader>
                  {q.title ??
                    `${spreadTitle(teamInfo(q.favorite).abbr, q.line)}. Mother Superior does the math`}
                </QHeader>
                <span className="flex flex-wrap items-center gap-2 text-xs font-semibold text-fog">
                  {spreadSideText(q.favorite, q.line, true)}{" "}
                  <PointsChip points={q.favoritePoints} /> {spreadSideText(q.dog, q.line, false)}{" "}
                  <PointsChip points={q.dogPoints} />
                </span>
              </div>
              <div className="mt-3 rounded-lg border border-honolulu/40 bg-honolulu/10 px-4 py-3 text-sm text-silver">
                {noScore ? (
                  <>No score sent: no pick.</>
                ) : side == null ? (
                  <>
                    Don&apos;t tell Mother Superior a side. Enter your score above; Mother
                    Superior does the math on where you landed.
                  </>
                ) : (
                  <span className="flex flex-wrap items-center gap-2">
                    Your score says: {fmtScore(lionsN!, oppN!)} →{" "}
                    <span className="font-bold text-chalk">
                      {side === q.favorite
                        ? spreadSideText(q.favorite, q.line, true)
                        : spreadSideText(q.dog, q.line, false)}
                    </span>
                    , pays{" "}
                    <PointsChip points={side === q.favorite ? q.favoritePoints : q.dogPoints} />
                  </span>
                )}
              </div>
            </section>
          );
        }
        return (
          <section key={q.id}>
            <QHeader>{q.title ?? spreadTitle(teamInfo(q.favorite).abbr, q.line)}</QHeader>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <OptionBtn
                selected={spreadSide(q) === q.favorite}
                onClick={() => setAnswer(q.id, q.favorite)}
              >
                <span className="flex items-center gap-2">
                  <TeamLogo abbr={q.favorite} size={24} /> {spreadSideText(q.favorite, q.line, true)}
                </span>
                <PointsChip points={q.favoritePoints} />
              </OptionBtn>
              <OptionBtn
                selected={spreadSide(q) === q.dog}
                onClick={() => setAnswer(q.id, q.dog)}
              >
                <span className="flex items-center gap-2">
                  <TeamLogo abbr={q.dog} size={24} /> {spreadSideText(q.dog, q.line, false)}
                </span>
                <PointsChip points={q.dogPoints} />
              </OptionBtn>
            </div>
            {(!scoreDrivesSpread(q) || noScore) && noPickBtn(q.id)}
          </section>
        );
      }
      case "overUnder": {
        if (isDerivedOU(q)) {
          const noun = q.source === "lionsMargin" ? "margin" : "total";
          const d =
            !noScore && lionsN != null && oppN != null ? ouAnswerFromScore(q, lionsN, oppN) : null;
          // Same buttons as a side pick, but the score selects them; a click
          // changes nothing.
          return (
            <section key={q.id}>
              <QHeader>{q.title ?? `Over/Under ${fmtPts(q.line)}: ${q.label}`}</QHeader>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {(["over", "under"] as const).map((side) => (
                  <OptionBtn
                    key={side}
                    selected={d?.answer === side}
                    onClick={() => {}}
                    className="cursor-default active:scale-100"
                  >
                    <span>
                      {side.toUpperCase()} {fmtPts(q.line)}
                    </span>
                    <PointsChip points={ouPays(q, side)} />
                  </OptionBtn>
                ))}
              </div>
              <p className="mt-2 text-xs text-fog">
                {noScore
                  ? "No score sent: no pick."
                  : d == null
                    ? "Your score picks the side automatically."
                    : d.answer == null
                      ? `Your score says ${fmtScore(lionsN!, oppN!)}: ${noun} ${fmtPts(d.value)}, exactly on the line, which pays neither side. Nudge a point.`
                      : `Your score says ${fmtScore(lionsN!, oppN!)}: ${noun} ${fmtPts(d.value)}.`}
              </p>
            </section>
          );
        }
        return (
          <section key={q.id}>
            <QHeader>{q.title ?? q.label}</QHeader>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <OptionBtn selected={draft.answers[q.id] === "over"} onClick={() => setAnswer(q.id, "over")}>
                <span>OVER {fmtPts(q.line)}</span>
                <PointsChip points={q.overPoints} />
              </OptionBtn>
              <OptionBtn selected={draft.answers[q.id] === "under"} onClick={() => setAnswer(q.id, "under")}>
                <span>UNDER {fmtPts(q.line)}</span>
                <PointsChip points={q.underPoints} />
              </OptionBtn>
            </div>
            {noPickBtn(q.id)}
          </section>
        );
      }
      case "prop":
        return (
          <section key={q.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <QHeader>{q.title ?? q.question}</QHeader>
              <PointsChip points={q.points} />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {q.options.map((o) => (
                <OptionBtn
                  key={o.key}
                  selected={draft.answers[q.id] === o.key}
                  onClick={() => setAnswer(q.id, o.key)}
                >
                  <span>{o.label}</span>
                </OptionBtn>
              ))}
            </div>
            {noPickBtn(q.id)}
          </section>
        );
      case "pickem":
        return (
          <section key={q.id}>
            <div className="flex flex-wrap items-center gap-2">
              <QHeader>
                {q.title ?? `Pickum: ${q.games.length} games`}
              </QHeader>
              <span className="text-xs font-semibold text-fog">
                +{fmtPts(q.pointsPerCorrect)} per correct
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {q.games.map((g) => {
                const picked = pickemPick(q.id, g.id);
                if (isDerivedPickemGame(g)) {
                  const w = lionsN != null && oppN != null ? scoreWinner(lionsN, oppN) : null;
                  return (
                    <div
                      key={g.id}
                      className="flex flex-wrap items-center gap-3 rounded-lg border border-edge bg-panel-2 px-3 py-2"
                    >
                      <span className="flex min-w-36 items-center gap-1.5 text-sm font-semibold text-silver">
                        <TeamLogo abbr={g.away} size={22} /> {g.away}
                        <span className="text-fog">@</span>
                        <TeamLogo abbr={g.home} size={22} /> {g.home}
                      </span>
                      <span className="text-xs text-fog">
                        {noScore ? (
                          "No score sent: no pick"
                        ) : w == null ? (
                          "Picked by your score"
                        ) : w === TIE ? (
                          "Your score says tie"
                        ) : (
                          <>
                            Your score picks{" "}
                            <span className="font-bold text-chalk">{teamInfo(w).short}</span>
                          </>
                        )}
                      </span>
                    </div>
                  );
                }
                return (
                  <div
                    key={g.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-edge bg-panel-2 px-3 py-2"
                  >
                    <span className="flex min-w-36 items-center gap-1.5 text-sm font-semibold text-silver">
                      <TeamLogo abbr={g.away} size={22} /> {g.away}
                      <span className="text-fog">@</span>
                      <TeamLogo abbr={g.home} size={22} /> {g.home}
                    </span>
                    <span className="flex gap-2">
                      <OptionBtn
                        selected={picked === g.away}
                        onClick={() => setPickemPick(q.id, g.id, g.away)}
                        className="px-3 py-1.5"
                      >
                        {g.away}
                      </OptionBtn>
                      <OptionBtn
                        selected={picked === g.home}
                        onClick={() => setPickemPick(q.id, g.id, g.home)}
                        className="px-3 py-1.5"
                      >
                        {g.home}
                      </OptionBtn>
                      {proxyFor && (
                        <OptionBtn
                          selected={picked === NO_PICK}
                          onClick={() => setPickemPick(q.id, g.id, NO_PICK)}
                          className="px-3 py-1.5 text-xs"
                        >
                          No pick
                        </OptionBtn>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
            {(q.allCorrectTotal != null || q.allWrongTotal != null) && (
              <p className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-semibold text-fog">
                {q.allCorrectTotal != null && (
                  <span className="inline-flex items-center gap-2">
                    All Correct: <PointsChip points={q.allCorrectTotal} />
                  </span>
                )}
                {q.allWrongTotal != null && (
                  <span className="inline-flex items-center gap-2">
                    All Incorrect: <PointsChip points={q.allWrongTotal} />
                  </span>
                )}
              </p>
            )}
          </section>
        );
    }
  };

  return (
    <Card accent className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge px-5 py-4 sm:px-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky">
            Week {contest.week}
          </div>
          <h3 className="display text-2xl">
            {houseLine
              ? existing
                ? "Edit the house line"
                : "Set the house line"
              : proxyName
                ? existing
                  ? `Edit the pick for ${proxyName}`
                  : `Enter the pick for ${proxyName}`
                : existing
                  ? "Edit your pick"
                  : "Make your pick"}
          </h3>
        </div>
        <Pill tone="blue">
          {houseLine
            ? "The house line"
            : proxyName
              ? "Office entry"
              : locksAtKickoff(contest)
                ? "Picks lock at kickoff"
                : `Picks lock ${fmtLockEastern(contest.lockAtUTC)}`}
        </Pill>
      </div>

      <div className="space-y-6 p-5 sm:p-6">
        {leadSpreads.map((q) => renderQuestion(q))}

        {needsScore && (
          <section>
            <QHeader>
              {showWinnerButtons ? (lionsML?.title ?? "Winner and score") : "The final score"}
            </QHeader>
            {showWinnerButtons && !noScore && (
              <>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {winnerChoices.map((o) => (
                    <OptionBtn
                      key={o.team}
                      selected={draft.winner === o.team}
                      onClick={() => setWinner(o.team)}
                    >
                      <span className="flex items-center gap-2">
                        <TeamLogo abbr={o.team} size={28} /> {teamInfo(o.team).short} win
                      </span>
                      {o.points != null && <PointsChip points={o.points} />}
                    </OptionBtn>
                  ))}
                </div>
              </>
            )}
            {!showWinnerButtons && (
              <p className="mt-2 text-xs text-fog">Your score picks the winner and the side.</p>
            )}
            {proxyName && (
              <p className="mt-2 text-xs text-fog">
                Nothing arrived? File 0-0: it counts as no pick, zero points, and the rest of the
                slate can stay blank.
              </p>
            )}
            {noScore ? (
              <p className="mt-4 rounded-lg border border-edge bg-panel-2 px-4 py-3 text-sm text-silver">
                No score sent. Their other picks still count; anything the score would pick is
                filed as no pick, and they sit out the score bonuses this week.
              </p>
            ) : (
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <ScoreInput
                  label="Lions"
                  value={draft.lions}
                  onChange={(v) => applyScores(v, draft.opp)}
                />
                <span className="display pb-1 text-2xl text-fog">-</span>
                <ScoreInput
                  label={teamInfo(opp).short}
                  value={draft.opp}
                  onChange={(v) => applyScores(draft.lions, v)}
                />
              </div>
            )}
            {proxyFor && (
              <OptionBtn
                selected={noScore}
                onClick={() => setNoScore(!noScore)}
                className="mt-3 py-2 text-xs"
              >
                {noScore ? "No score sent ✓ (tap to enter a score)" : "No score sent"}
              </OptionBtn>
            )}
            {isTiePick && (
              <p className="mt-3 rounded-lg border border-honolulu/40 bg-honolulu/10 px-4 py-3 text-sm text-silver">
                That score is a tie. Bold. A tie pick chases score bonuses only; no winner points.
              </p>
            )}
            {syncNotice && !isTiePick && showWinnerButtons && (
              <p className="mt-3 rounded-lg border border-honolulu/40 bg-honolulu/10 px-4 py-3 text-sm font-semibold text-sky">
                {syncNotice}
              </p>
            )}
          </section>
        )}

        {trailingQuestions.map((q) => renderQuestion(q))}

        {showErrors && problems.length > 0 && (
          <div className="rounded-lg border border-loss/40 bg-loss/10 px-4 py-3 text-sm font-semibold text-loss">
            <div className="text-xs font-bold uppercase tracking-[0.2em]">
              Don&apos;t be an idiot
            </div>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-edge pt-4">
          <Btn onClick={() => void save()} disabled={saving}>
            {saving
              ? "Saving…"
              : houseLine
                ? existing
                  ? "Update the house line"
                  : "Publish the house line"
                : proxyName
                  ? existing
                    ? "Update the pick"
                    : "File the pick"
                  : existing
                    ? "Update pick"
                    : "Submit Pick"}
          </Btn>
          {saveError && (
            <span role="alert" className="text-xs font-semibold text-loss">
              {saveError}
            </span>
          )}
          {existing && (
            <Btn kind="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Btn>
          )}
          {!houseLine && (
            <span className="text-xs text-fog">
              {proxyName
                ? `Filed under ${proxyName}.`
                : `Locks ${fmtDateTime(contest.lockAtUTC)}.`}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
