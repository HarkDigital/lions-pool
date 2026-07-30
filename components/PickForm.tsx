"use client";

// ---------------------------------------------------------------------------
// The heart of the site: the pick form. Renders any contest shape Mother can
// build — TEAM/WIN/SCORE, moneylines, spreads, over/unders (derived or stat),
// props, and multi-game pick'em slates — and saves through lib/store.
// ---------------------------------------------------------------------------

import { useState, type ReactNode } from "react";
import Link from "next/link";
import type {
  AnswerValue,
  Contest,
  MoneylineQ,
  OverUnderQ,
  Question,
  Submission,
  TeamAbbr,
} from "@/lib/types";
import { mySubmission, saveSubmission, useStoreVersion, useUser } from "@/lib/store";
import { gameForWeek } from "@/lib/schedule";
import { teamInfo } from "@/lib/teams";
import { fmtDateTime, fmtPts } from "@/lib/format";
import { Btn, Card, Pill, PointsChip } from "@/components/ui";
import { TeamLogo } from "@/components/TeamLogo";

// --- Local helpers ----------------------------------------------------------

type OUAnswer = "over" | "under" | "exact";

interface Draft {
  winner: TeamAbbr | null;
  lions: string;
  opp: string;
  answers: Record<string, AnswerValue>;
}

const EMPTY_DRAFT: Draft = { winner: null, lions: "", opp: "", answers: {} };

function draftFrom(sub: Submission): Draft {
  return {
    winner: sub.scorePick?.winner ?? null,
    lions: sub.scorePick != null ? String(sub.scorePick.lions) : "",
    opp: sub.scorePick != null ? String(sub.scorePick.opp) : "",
    answers: { ...sub.answers },
  };
}

/** Whole number 0–99, or null. */
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
  if (value === q.line) return { value, answer: q.exactPoints != null ? "exact" : null };
  return { value, answer: value > q.line ? "over" : "under" };
}

function ouPays(q: OverUnderQ, answer: OUAnswer): number {
  if (answer === "over") return q.overPoints;
  if (answer === "under") return q.underPoints;
  return q.exactPoints ?? 0;
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
      className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm font-semibold transition ${
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
  switch (q.kind) {
    case "moneyline": {
      if (typeof a !== "string") return missing;
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
            <TeamLogo abbr={a} size={20} /> {teamInfo(a).short}{" "}
            {pickedFav ? `−${fmtPts(q.line)}` : `+${fmtPts(q.line)}`}
          </span>
          <PointsChip points={pickedFav ? q.favoritePoints : q.dogPoints} />
        </>
      );
    }
    case "overUnder": {
      if (a !== "over" && a !== "under" && a !== "exact") return missing;
      const label =
        a === "exact"
          ? `Straight money on ${fmtPts(q.line)}`
          : `${a === "over" ? "Over" : "Under"} ${fmtPts(q.line)}`;
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
      return (
        <>
          <span className="text-silver">
            {q.question}: <span className="font-semibold text-chalk">{opt?.label ?? a}</span>
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
              {g.away} @ {g.home} → <span className="font-bold text-chalk">{map[g.id] ?? "—"}</span>
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
}: {
  contest: Contest;
  sub: Submission;
  canEdit: boolean;
  onEdit: () => void;
}) {
  return (
    <Card accent className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Pill tone="win">PICK IS IN</Pill>
          <span className="text-sm text-fog">Locked at kickoff — {fmtDateTime(contest.lockAtUTC)}</span>
        </div>
        {canEdit && (
          <Btn kind="ghost" onClick={onEdit}>
            Edit
          </Btn>
        )}
      </div>
      <div className="space-y-4 p-5 sm:p-6">
        {sub.scorePick && (
          <div className="flex items-center gap-3">
            <TeamLogo abbr={sub.scorePick.winner} size={40} />
            <div>
              <div className="display text-3xl">
                {teamInfo(sub.scorePick.winner).short} win{" "}
                {sub.scorePick.winner === "DET"
                  ? `${sub.scorePick.lions}–${sub.scorePick.opp}`
                  : `${sub.scorePick.opp}–${sub.scorePick.lions}`}
              </div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-fog">
                Team · Win · Score
              </div>
            </div>
          </div>
        )}
        <ul className="space-y-2 text-sm">
          {contest.questions.map((q) => (
            <li key={q.id} className="flex flex-wrap items-center justify-between gap-3">
              {answerLine(q, sub)}
            </li>
          ))}
        </ul>
        <p className="text-xs text-fog">
          Submitted {fmtDateTime(sub.submittedAtUTC)}.
          {canEdit && " You can edit until kickoff. After that, you live with it."}
        </p>
      </div>
    </Card>
  );
}

// --- The form ----------------------------------------------------------------

export function PickForm({ contest }: { contest: Contest }) {
  useStoreVersion();
  const user = useUser();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [showErrors, setShowErrors] = useState(false);

  if (!user) {
    return (
      <Card accent className="p-6 text-center sm:p-8">
        <div className="display text-2xl">Make your pick</div>
        <p className="mt-2 text-sm text-fog">
          Team. Win. Score. None of that happens from the bleachers.
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

  const existing = mySubmission(contest.week, user.id);
  const isOpen = contest.status === "open";

  if (existing && !editing) {
    return (
      <SubmittedCard
        contest={contest}
        sub={existing}
        canEdit={isOpen}
        onEdit={() => {
          setDraft(draftFrom(existing));
          setShowErrors(false);
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
            ? "Mother hasn't posted this slate yet"
            : "Picks are locked for this week"}
        </div>
        <p className="mt-2 text-sm text-fog">
          {contest.status === "draft"
            ? "The slate lands in your inbox when Mother says it does."
            : "Late by a minute, you lost your pick. Simple. Be on time."}
        </p>
      </Card>
    );
  }

  // --- Form state derivations ------------------------------------------------

  const opp = opponentAbbr(contest);
  const needsScore = contest.scoreBonuses;
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

  const isDerivedOU = (q: OverUnderQ) => q.source !== "stat" && needsScore;

  const scoreConflict =
    needsScore &&
    draft.winner != null &&
    lionsN != null &&
    oppN != null &&
    (lionsN === oppN || (draft.winner === "DET" ? lionsN < oppN : oppN < lionsN));

  const isAnswered = (q: Question): boolean => {
    switch (q.kind) {
      case "moneyline":
        return q === lionsML ? draft.winner != null : typeof draft.answers[q.id] === "string";
      case "overUnder":
        if (isDerivedOU(q)) {
          if (lionsN == null || oppN == null) return false;
          return ouAnswerFromScore(q, lionsN, oppN).answer != null;
        }
        return typeof draft.answers[q.id] === "string";
      case "pickem": {
        const a = draft.answers[q.id];
        if (typeof a !== "object" || a == null) return false;
        return q.games.every((g) => typeof (a as Record<string, string>)[g.id] === "string");
      }
      default:
        return typeof draft.answers[q.id] === "string";
    }
  };

  const problems: string[] = [];
  if (needsScore) {
    if (draft.winner == null) problems.push("Pick a winner. TEAM. WIN. SCORE.");
    if (lionsN == null || oppN == null)
      problems.push("Give Mother both scores — whole numbers, 0 to 99.");
    if (scoreConflict)
      problems.push(
        lionsN === oppN
          ? "Ties don't exist here. Somebody wins."
          : "Your score has your winner losing. Make the numbers agree with the pick.",
      );
  }
  if (contest.questions.some((q) => !isAnswered(q)))
    problems.push("Answer everything on the slate. Mother doesn't grade partial credit.");

  // --- State setters ----------------------------------------------------------

  const setWinner = (team: TeamAbbr) => setDraft((d) => ({ ...d, winner: team }));

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

  const save = () => {
    if (problems.length > 0) {
      setShowErrors(true);
      return;
    }
    const answers: Record<string, AnswerValue> = {};
    for (const q of contest.questions) {
      if (q.kind === "moneyline" && q === lionsML) {
        answers[q.id] = draft.winner!;
        continue;
      }
      if (q.kind === "overUnder" && isDerivedOU(q)) {
        answers[q.id] = ouAnswerFromScore(q, lionsN!, oppN!).answer!;
        continue;
      }
      answers[q.id] = draft.answers[q.id];
    }
    saveSubmission({
      userId: user.id,
      week: contest.week,
      submittedAtUTC: new Date().toISOString(),
      answers,
      scorePick: needsScore
        ? { winner: draft.winner!, lions: lionsN!, opp: oppN! }
        : undefined,
    });
    setShowErrors(false);
    setEditing(false);
  };

  // --- Per-question controls ---------------------------------------------------

  const renderQuestion = (q: Question): ReactNode => {
    switch (q.kind) {
      case "moneyline": {
        if (q === lionsML) return null; // merged into the winner buttons above
        return (
          <section key={q.id}>
            <QHeader>{q.title ?? "Moneyline — the points divide"}</QHeader>
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
          </section>
        );
      }
      case "spread":
        return (
          <section key={q.id}>
            <QHeader>{q.title ?? `The spread: ${teamInfo(q.favorite).abbr} −${fmtPts(q.line)}`}</QHeader>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <OptionBtn
                selected={draft.answers[q.id] === q.favorite}
                onClick={() => setAnswer(q.id, q.favorite)}
              >
                <span className="flex items-center gap-2">
                  <TeamLogo abbr={q.favorite} size={24} /> {q.favorite} −{fmtPts(q.line)}
                </span>
                <PointsChip points={q.favoritePoints} />
              </OptionBtn>
              <OptionBtn
                selected={draft.answers[q.id] === q.dog}
                onClick={() => setAnswer(q.id, q.dog)}
              >
                <span className="flex items-center gap-2">
                  <TeamLogo abbr={q.dog} size={24} /> {q.dog} +{fmtPts(q.line)} (or outright)
                </span>
                <PointsChip points={q.dogPoints} />
              </OptionBtn>
            </div>
          </section>
        );
      case "overUnder": {
        if (isDerivedOU(q)) {
          const noun = q.source === "lionsMargin" ? "margin" : "total";
          const d = lionsN != null && oppN != null ? ouAnswerFromScore(q, lionsN, oppN) : null;
          return (
            <section key={q.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <QHeader>
                  {q.title ?? `Over/Under ${fmtPts(q.line)} — ${q.label}`}
                </QHeader>
                <span className="flex items-center gap-2 text-xs font-semibold text-fog">
                  OVER <PointsChip points={q.overPoints} /> UNDER{" "}
                  <PointsChip points={q.underPoints} />
                  {q.exactPoints != null && (
                    <>
                      STRAIGHT MONEY <PointsChip points={q.exactPoints} />
                    </>
                  )}
                </span>
              </div>
              <div className="mt-3 rounded-lg border border-honolulu/40 bg-honolulu/10 px-4 py-3 text-sm text-silver">
                {d == null ? (
                  <>Enter your winner and score above — your score picks your side here automatically.</>
                ) : d.answer == null ? (
                  <>
                    Your score says: {lionsN}–{oppN} → {noun} {fmtPts(d.value)} — that lands exactly
                    on the line and there is no straight-money option this week. Nudge a point.
                  </>
                ) : (
                  <span className="flex flex-wrap items-center gap-2">
                    Your score says: {lionsN}–{oppN} → {noun} {fmtPts(d.value)} →{" "}
                    <span className="font-bold text-chalk">
                      {d.answer === "exact"
                        ? `STRAIGHT MONEY on ${fmtPts(q.line)}`
                        : `${d.answer.toUpperCase()} ${fmtPts(q.line)}`}
                    </span>
                    , pays <PointsChip points={ouPays(q, d.answer)} />
                  </span>
                )}
              </div>
            </section>
          );
        }
        return (
          <section key={q.id}>
            <QHeader>{q.title ?? q.label}</QHeader>
            <div className={`mt-3 grid gap-2 ${q.exactPoints != null ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
              <OptionBtn selected={draft.answers[q.id] === "over"} onClick={() => setAnswer(q.id, "over")}>
                <span>OVER {fmtPts(q.line)}</span>
                <PointsChip points={q.overPoints} />
              </OptionBtn>
              <OptionBtn selected={draft.answers[q.id] === "under"} onClick={() => setAnswer(q.id, "under")}>
                <span>UNDER {fmtPts(q.line)}</span>
                <PointsChip points={q.underPoints} />
              </OptionBtn>
              {q.exactPoints != null && (
                <OptionBtn selected={draft.answers[q.id] === "exact"} onClick={() => setAnswer(q.id, "exact")}>
                  <span>STRAIGHT MONEY — exactly {fmtPts(q.line)}</span>
                  <PointsChip points={q.exactPoints} />
                </OptionBtn>
              )}
            </div>
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
          </section>
        );
      case "pickem":
        return (
          <section key={q.id}>
            <div className="flex flex-wrap items-center gap-2">
              <QHeader>
                {q.title ?? `Pick'em — ${q.games.length} games`}
              </QHeader>
              <span className="text-xs font-semibold text-fog">
                +{fmtPts(q.pointsPerCorrect)} per correct
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {q.games.map((g) => {
                const picked = pickemPick(q.id, g.id);
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
                    </span>
                  </div>
                );
              })}
            </div>
            {(q.allCorrectTotal != null || q.allWrongTotal != null) && (
              <p className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-fog">
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
          <h3 className="display text-2xl">{existing ? "Edit your pick" : "Make your pick"}</h3>
        </div>
        <Pill tone="blue">Picks lock at kickoff</Pill>
      </div>

      <div className="space-y-6 p-5 sm:p-6">
        {needsScore && (
          <section>
            <QHeader>{lionsML?.title ?? "Team · Win · Score"}</QHeader>
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
            {lionsML && (
              <p className="mt-2 text-xs text-fog">
                Your winner doubles as your moneyline answer. The divide is on the buttons.
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <ScoreInput
                label="Lions"
                value={draft.lions}
                onChange={(v) => setDraft((d) => ({ ...d, lions: v }))}
              />
              <span className="display pb-1 text-2xl text-fog">–</span>
              <ScoreInput
                label={teamInfo(opp).short}
                value={draft.opp}
                onChange={(v) => setDraft((d) => ({ ...d, opp: v }))}
              />
            </div>
            {scoreConflict && (
              <p className="mt-2 text-sm font-semibold text-loss">
                {lionsN === oppN
                  ? "Ties don't exist here. Somebody wins."
                  : `That score has the ${teamInfo(draft.winner!).short} losing. TEAM. WIN. SCORE — make them agree.`}
              </p>
            )}
          </section>
        )}

        {contest.questions.map((q) => renderQuestion(q))}

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
          <Btn onClick={save}>{existing ? "Update pick" : "Send it to Mother"}</Btn>
          {existing && (
            <Btn kind="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Btn>
          )}
          <span className="text-xs text-fog">
            Locks {fmtDateTime(contest.lockAtUTC)}. Late by a minute, you lost your pick.
          </span>
        </div>
      </div>
    </Card>
  );
}
