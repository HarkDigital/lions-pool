"use client";

// ---------------------------------------------------------------------------
// Admin: the weekly contest builder. Mother builds the slate here every
// week — questions, the points divide, the lock time — then flips it open.
// Saves overlay localStorage via lib/store; players see it instantly.
// ---------------------------------------------------------------------------

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type {
  Contest,
  ContestStatus,
  MoneylineQ,
  OverUnderQ,
  PickemGame,
  PickemQ,
  PropQ,
  Question,
  SpreadQ,
} from "@/lib/types";
import { CONTESTS, CURRENT_WEEK } from "@/lib/demo-data";
import {
  effectiveContest,
  effectiveContests,
  saveContest,
  useHydrated,
  useStoreVersion,
} from "@/lib/store";
import { gameForWeek } from "@/lib/schedule";
import { TEAMS, teamInfo } from "@/lib/teams";
import { fmtDateTime, fmtPts } from "@/lib/format";
import { AdminGate } from "@/components/AdminGate";
import { TeamLogo } from "@/components/TeamLogo";
import { Btn, Card, Pill, PointsChip, SectionTitle, STATUS_TONE } from "@/components/ui";

const INPUT =
  "w-full rounded-lg border border-edge bg-panel-2 px-3 py-2 text-sm text-chalk outline-none transition focus:border-honolulu/60";
const LABEL = "mb-1 block text-xs font-semibold uppercase tracking-wider text-fog";

const STATUSES: ContestStatus[] = ["draft", "open", "locked", "graded"];
const KIND_LABEL: Record<Question["kind"], string> = {
  moneyline: "Moneyline",
  spread: "Spread",
  overUnder: "Over/Under",
  prop: "Prop",
  pickem: "Pick’em",
};

const DEFAULT_WEEK = CONTESTS.find((c) => c.status === "draft")?.week ?? CURRENT_WEEK;

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(v: string): string {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toISOString();
}

function nextQuestionId(week: number, questions: Question[]): string {
  let n = questions.length + 1;
  while (questions.some((q) => q.id === `w${week}-q${n}`)) n++;
  return `w${week}-q${n}`;
}

function makeQuestion(kind: Question["kind"], week: number, existing: Question[]): Question {
  const id = nextQuestionId(week, existing);
  const opp = gameForWeek(week)?.opponent ?? "GB";
  switch (kind) {
    case "moneyline":
      return {
        id,
        kind: "moneyline",
        options: [
          { team: "DET", points: 5 },
          { team: opp, points: 12 },
        ],
      };
    case "spread":
      return {
        id,
        kind: "spread",
        favorite: "DET",
        dog: opp,
        line: 6.5,
        favoritePoints: 8,
        dogPoints: 8,
      };
    case "overUnder":
      return {
        id,
        kind: "overUnder",
        label: "combined score",
        line: 44.5,
        overPoints: 8,
        underPoints: 8,
        source: "total",
      };
    case "prop":
      return {
        id,
        kind: "prop",
        question: "More passing yards",
        options: [
          { key: "optA", label: "Option A" },
          { key: "optB", label: "Option B" },
        ],
        points: 5,
      };
    case "pickem":
      return {
        id,
        kind: "pickem",
        games: [{ id: "g1", away: "CHI", home: "GB" }],
        pointsPerCorrect: 4,
        allCorrectTotal: 25,
        allWrongTotal: 30,
      };
  }
}

function questionLabel(q: Question): string {
  switch (q.kind) {
    case "moneyline":
      return `Moneyline: ${q.options.map((o) => teamInfo(o.team).short).join(" vs ")}`;
    case "spread":
      return `Spread: ${teamInfo(q.favorite).short} −${fmtPts(q.line)}`;
    case "overUnder":
      return `O/U ${fmtPts(q.line)}: ${q.label}`;
    case "prop":
      return q.question;
    case "pickem":
      return `Pick’em (${q.games.length} games)`;
  }
}

// --- Small form primitives ---------------------------------------------------

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className={LABEL}>{label}</span>
      {children}
    </label>
  );
}

function TeamSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select className={INPUT} value={value} onChange={(e) => onChange(e.target.value)}>
      {Object.keys(TEAMS).map((abbr) => (
        <option key={abbr} value={abbr}>
          {abbr} — {TEAMS[abbr].short}
        </option>
      ))}
    </select>
  );
}

function NumInput({
  value,
  onChange,
  step = 0.5,
  min,
}: {
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
}) {
  return (
    <input
      type="number"
      className={INPUT}
      value={Number.isFinite(value) ? value : ""}
      step={step}
      min={min}
      onChange={(e) => {
        const n = Number(e.target.value);
        onChange(e.target.value === "" || Number.isNaN(n) ? 0 : n);
      }}
    />
  );
}

function OptNumInput({
  value,
  onChange,
  step = 0.5,
  placeholder,
}: {
  value: number | undefined;
  onChange: (n: number | undefined) => void;
  step?: number;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      className={INPUT}
      value={value ?? ""}
      step={step}
      placeholder={placeholder}
      onChange={(e) => {
        const n = Number(e.target.value);
        onChange(e.target.value === "" || Number.isNaN(n) ? undefined : n);
      }}
    />
  );
}

// --- Per-kind question editors ----------------------------------------------

function MoneylineEditor({ q, onChange }: { q: MoneylineQ; onChange: (q: MoneylineQ) => void }) {
  const setOpt = (i: number, patch: Partial<MoneylineQ["options"][number]>) =>
    onChange({ ...q, options: q.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {q.options.map((o, i) => (
        <div key={i} className="rounded-lg border border-edge p-3">
          <Field label={`Team ${i + 1}`}>
            <TeamSelect value={o.team} onChange={(team) => setOpt(i, { team })} />
          </Field>
          <Field label="Pays" className="mt-2">
            <NumInput value={o.points} onChange={(points) => setOpt(i, { points })} />
          </Field>
        </div>
      ))}
    </div>
  );
}

function SpreadEditor({ q, onChange }: { q: SpreadQ; onChange: (q: SpreadQ) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Favorite">
        <TeamSelect value={q.favorite} onChange={(favorite) => onChange({ ...q, favorite })} />
      </Field>
      <Field label="Dog">
        <TeamSelect value={q.dog} onChange={(dog) => onChange({ ...q, dog })} />
      </Field>
      <Field label="Line (favorite must cover)">
        <NumInput value={q.line} onChange={(line) => onChange({ ...q, line })} min={0} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Favorite pays">
          <NumInput
            value={q.favoritePoints}
            onChange={(favoritePoints) => onChange({ ...q, favoritePoints })}
          />
        </Field>
        <Field label="Dog pays">
          <NumInput value={q.dogPoints} onChange={(dogPoints) => onChange({ ...q, dogPoints })} />
        </Field>
      </div>
    </div>
  );
}

function OverUnderEditor({ q, onChange }: { q: OverUnderQ; onChange: (q: OverUnderQ) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="What is being counted" className="sm:col-span-2">
        <input
          className={INPUT}
          value={q.label}
          placeholder="combined score, Goff passing yards, ..."
          onChange={(e) => onChange({ ...q, label: e.target.value })}
        />
      </Field>
      <Field label="The number">
        <NumInput value={q.line} onChange={(line) => onChange({ ...q, line })} />
      </Field>
      <Field label="Where the actual comes from">
        <select
          className={INPUT}
          value={q.source}
          onChange={(e) => onChange({ ...q, source: e.target.value as OverUnderQ["source"] })}
        >
          <option value="total">Combined final score (auto-graded)</option>
          <option value="lionsMargin">Lions margin (auto-graded)</option>
          <option value="stat">Stat — entered at grading time</option>
        </select>
      </Field>
      <Field label="Over pays">
        <NumInput value={q.overPoints} onChange={(overPoints) => onChange({ ...q, overPoints })} />
      </Field>
      <Field label="Under pays">
        <NumInput
          value={q.underPoints}
          onChange={(underPoints) => onChange({ ...q, underPoints })}
        />
      </Field>
      <Field label="Straight Money pays (optional — exactly on the number)" className="sm:col-span-2">
        <OptNumInput
          value={q.exactPoints}
          onChange={(exactPoints) => onChange({ ...q, exactPoints })}
          placeholder="Leave blank for no straight-money option"
        />
      </Field>
    </div>
  );
}

function PropEditor({ q, onChange }: { q: PropQ; onChange: (q: PropQ) => void }) {
  const setOpt = (i: number, patch: Partial<PropQ["options"][number]>) =>
    onChange({ ...q, options: q.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  return (
    <div className="grid gap-3">
      <Field label="The question">
        <input
          className={INPUT}
          value={q.question}
          onChange={(e) => onChange({ ...q, question: e.target.value })}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        {q.options.map((o, i) => (
          <div key={i} className="rounded-lg border border-edge p-3">
            <Field label={`Option ${i + 1} label`}>
              <input
                className={INPUT}
                value={o.label}
                onChange={(e) => setOpt(i, { label: e.target.value })}
              />
            </Field>
            <Field label="Key (stored on picks)" className="mt-2">
              <input
                className={INPUT}
                value={o.key}
                onChange={(e) => setOpt(i, { key: e.target.value })}
              />
            </Field>
          </div>
        ))}
      </div>
      <Field label="Pays (either side)" className="max-w-40">
        <NumInput value={q.points} onChange={(points) => onChange({ ...q, points })} />
      </Field>
    </div>
  );
}

function PickemEditor({ q, onChange }: { q: PickemQ; onChange: (q: PickemQ) => void }) {
  const setGame = (i: number, patch: Partial<PickemGame>) =>
    onChange({ ...q, games: q.games.map((g, j) => (j === i ? { ...g, ...patch } : g)) });
  const removeGame = (i: number) => {
    // A pick’em with zero games would leave players nothing to answer and the
    // slate unsubmittable — the last game stays.
    if (q.games.length <= 1) return;
    onChange({ ...q, games: q.games.filter((_, j) => j !== i) });
  };
  const addGame = () => {
    let n = q.games.length + 1;
    while (q.games.some((g) => g.id === `g${n}`)) n++;
    onChange({ ...q, games: [...q.games, { id: `g${n}`, away: "CHI", home: "GB" }] });
  };
  return (
    <div className="space-y-3">
      {q.games.map((g, i) => (
        <div
          key={g.id}
          className="grid items-end gap-3 rounded-lg border border-edge p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
        >
          <Field label="Away">
            <TeamSelect value={g.away} onChange={(away) => setGame(i, { away })} />
          </Field>
          <Field label="Home">
            <TeamSelect value={g.home} onChange={(home) => setGame(i, { home })} />
          </Field>
          <Field label="Kickoff (optional)">
            <input
              type="datetime-local"
              className={INPUT}
              value={g.dateUTC ? isoToLocalInput(g.dateUTC) : ""}
              onChange={(e) =>
                setGame(i, { dateUTC: e.target.value ? localInputToIso(e.target.value) : undefined })
              }
            />
          </Field>
          <span
            title={
              q.games.length === 1
                ? "A pick’em with no games is just a shrug. Remove the whole question instead."
                : undefined
            }
          >
            <Btn
              kind="danger"
              onClick={() => removeGame(i)}
              disabled={q.games.length === 1}
              className="!px-3 !py-1.5 !text-xs"
            >
              Remove
            </Btn>
          </span>
        </div>
      ))}
      <Btn kind="ghost" onClick={addGame} className="!px-3 !py-1.5 !text-xs">
        + Add game
      </Btn>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Per correct pick">
          <NumInput
            value={q.pointsPerCorrect}
            onChange={(pointsPerCorrect) => onChange({ ...q, pointsPerCorrect })}
          />
        </Field>
        <Field label="All correct pays (total, optional)">
          <OptNumInput
            value={q.allCorrectTotal}
            onChange={(allCorrectTotal) => onChange({ ...q, allCorrectTotal })}
            placeholder="e.g. 25"
          />
        </Field>
        <Field label="All wrong pays (total, optional)">
          <OptNumInput
            value={q.allWrongTotal}
            onChange={(allWrongTotal) => onChange({ ...q, allWrongTotal })}
            placeholder="e.g. 30"
          />
        </Field>
      </div>
    </div>
  );
}

function QuestionCard({
  q,
  onChange,
  onRemove,
}: {
  q: Question;
  onChange: (q: Question) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-edge-2 bg-panel-2/50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Pill tone="blue">{KIND_LABEL[q.kind]}</Pill>
          <span className="font-mono text-xs text-fog">{q.id}</span>
        </div>
        <Btn kind="danger" onClick={onRemove} className="!px-3 !py-1 !text-xs">
          Remove
        </Btn>
      </div>
      <Field label="Heading (optional — shown above the question)" className="mb-3">
        <input
          className={INPUT}
          value={q.title ?? ""}
          placeholder="e.g. Straight bet: winner + score"
          onChange={(e) => onChange({ ...q, title: e.target.value || undefined } as Question)}
        />
      </Field>
      {q.kind === "moneyline" && <MoneylineEditor q={q} onChange={onChange} />}
      {q.kind === "spread" && <SpreadEditor q={q} onChange={onChange} />}
      {q.kind === "overUnder" && <OverUnderEditor q={q} onChange={onChange} />}
      {q.kind === "prop" && <PropEditor q={q} onChange={onChange} />}
      {q.kind === "pickem" && <PickemEditor q={q} onChange={onChange} />}
    </div>
  );
}

// --- The slate, roughly as players see it -----------------------------------

function QuestionPreview({ q }: { q: Question }) {
  return (
    <div className="rounded-lg border border-edge bg-panel-2/60 p-3">
      {q.title && <div className="mb-2 text-xs font-semibold text-silver">{q.title}</div>}
      {q.kind === "moneyline" && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-silver">
          {q.options.map((o, i) => (
            <span key={i} className="flex items-center gap-2">
              <TeamLogo abbr={o.team} size={22} /> {teamInfo(o.team).short} to win{" "}
              <PointsChip points={o.points} />
            </span>
          ))}
        </div>
      )}
      {q.kind === "spread" && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-silver">
          <span className="flex items-center gap-2">
            <TeamLogo abbr={q.favorite} size={22} /> {teamInfo(q.favorite).short} −{fmtPts(q.line)}{" "}
            <PointsChip points={q.favoritePoints} />
          </span>
          <span className="flex items-center gap-2">
            <TeamLogo abbr={q.dog} size={22} /> {teamInfo(q.dog).short} +{fmtPts(q.line)}{" "}
            <PointsChip points={q.dogPoints} />
          </span>
        </div>
      )}
      {q.kind === "overUnder" && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-silver">
          <span className="text-fog">
            {q.label} — the number is {fmtPts(q.line)}:
          </span>
          <span className="flex items-center gap-2">
            Over <PointsChip points={q.overPoints} />
          </span>
          <span className="flex items-center gap-2">
            Under <PointsChip points={q.underPoints} />
          </span>
          {q.exactPoints != null && (
            <span className="flex items-center gap-2">
              Straight Money <PointsChip points={q.exactPoints} />
            </span>
          )}
        </div>
      )}
      {q.kind === "prop" && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-silver">
          <span className="text-fog">{q.question}:</span>
          {q.options.map((o) => (
            <span key={o.key} className="flex items-center gap-2">
              {o.label} <PointsChip points={q.points} />
            </span>
          ))}
        </div>
      )}
      {q.kind === "pickem" && (
        <div className="space-y-2 text-sm text-silver">
          {q.games.map((g) => (
            <div key={g.id} className="flex flex-wrap items-center gap-2">
              <TeamLogo abbr={g.away} size={20} /> {g.away}
              <span className="text-fog">@</span>
              <TeamLogo abbr={g.home} size={20} /> {g.home}
              {g.dateUTC && <span className="ml-2 text-xs text-fog">{fmtDateTime(g.dateUTC)}</span>}
            </div>
          ))}
          <div className="text-xs text-fog">
            +{fmtPts(q.pointsPerCorrect)} per correct
            {q.allCorrectTotal != null && <> · run the table: {fmtPts(q.allCorrectTotal)} total</>}
            {q.allWrongTotal != null && <> · perfectly wrong: {fmtPts(q.allWrongTotal)} total</>}
          </div>
        </div>
      )}
    </div>
  );
}

function SlatePreview({ contest }: { contest: Contest }) {
  const game = gameForWeek(contest.week);
  return (
    <Card accent className="p-5 sm:p-6">
      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky">
        Preview — what the players see
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="display text-2xl">{contest.title}</h3>
        <Pill tone={STATUS_TONE[contest.status]}>{contest.status}</Pill>
      </div>
      <div className="mt-1 text-xs text-fog">
        Week {contest.week}
        {game && (
          <>
            {" "}
            · {game.home ? "vs" : "@"} {teamInfo(game.opponent).short}
          </>
        )}{" "}
        · locks {fmtDateTime(contest.lockAtUTC)}
      </div>
      {contest.blurb && <p className="mt-3 text-sm text-silver">{contest.blurb}</p>}
      {contest.motherSays && (
        <div className="mt-3">
          <Pill tone="gold">Mother Says: {contest.motherSays}</Pill>
        </div>
      )}
      <div className="mt-4 space-y-3">
        {contest.questions.map((q) => (
          <QuestionPreview key={q.id} q={q} />
        ))}
      </div>
      {contest.comboBonus && (
        <p className="mt-3 text-xs text-gold">
          Sweep all {contest.comboBonus.questionIds.length} checked questions for +
          {fmtPts(contest.comboBonus.allCorrectBonus)} on top.
        </p>
      )}
      {contest.scoreBonuses && (
        <p className="mt-3 text-xs text-fog">
          Team. Win. Score. — Closest-To, Exacto, Perfecto, and the Kiss of Death are in play.
        </p>
      )}
    </Card>
  );
}

// --- The editor for one week ------------------------------------------------

function WeekEditor({
  draft,
  onChange,
  onSave,
  savedNote,
}: {
  draft: Contest;
  onChange: (c: Contest) => void;
  onSave: () => void;
  savedNote: boolean;
}) {
  const game = gameForWeek(draft.week);
  const set = (patch: Partial<Contest>) => onChange({ ...draft, ...patch });

  const addQuestion = (kind: Question["kind"]) =>
    set({ questions: [...draft.questions, makeQuestion(kind, draft.week, draft.questions)] });

  const removeQuestion = (idx: number) => {
    const removed = draft.questions[idx];
    const questions = draft.questions.filter((_, i) => i !== idx);
    let comboBonus = draft.comboBonus;
    if (comboBonus) {
      const ids = comboBonus.questionIds.filter((id) => id !== removed.id);
      comboBonus = ids.length > 0 ? { ...comboBonus, questionIds: ids } : undefined;
    }
    onChange({ ...draft, questions, comboBonus });
  };

  const toggleCombo = (on: boolean) =>
    set({
      comboBonus: on
        ? { questionIds: draft.questions.map((q) => q.id), allCorrectBonus: 5 }
        : undefined,
    });

  const toggleComboQuestion = (id: string, on: boolean) => {
    if (!draft.comboBonus) return;
    const ids = on
      ? [...draft.comboBonus.questionIds, id]
      : draft.comboBonus.questionIds.filter((x) => x !== id);
    set({ comboBonus: { ...draft.comboBonus, questionIds: ids } });
  };

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="display text-2xl">Week {draft.week} slate</h3>
        <div className="flex items-center gap-3">
          {game && (
            <span className="flex items-center gap-1.5 text-xs text-fog">
              <TeamLogo abbr="DET" size={18} /> {game.home ? "vs" : "@"}{" "}
              <TeamLogo abbr={game.opponent} size={18} /> {teamInfo(game.opponent).short}
            </span>
          )}
          <Pill tone={STATUS_TONE[draft.status]}>{draft.status}</Pill>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" className="sm:col-span-2">
          <input
            className={INPUT}
            value={draft.title}
            onChange={(e) => set({ title: e.target.value })}
          />
        </Field>
        <Field label="Blurb — the announcement email" className="sm:col-span-2">
          <textarea
            className={`${INPUT} min-h-24`}
            value={draft.blurb ?? ""}
            placeholder="Set the tone. Explain the slate. Remind them not to be idiots."
            onChange={(e) => set({ blurb: e.target.value || undefined })}
          />
        </Field>
        <Field label="Mother Says (her own pick)">
          <input
            className={INPUT}
            value={draft.motherSays ?? ""}
            placeholder="LIONS WIN 31-13"
            onChange={(e) => set({ motherSays: e.target.value || undefined })}
          />
        </Field>
        <Field label="Status">
          <select
            className={INPUT}
            value={draft.status}
            onChange={(e) => set({ status: e.target.value as ContestStatus })}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Picks lock at (your clock — stored as UTC)">
          <input
            type="datetime-local"
            className={INPUT}
            value={isoToLocalInput(draft.lockAtUTC)}
            onChange={(e) => {
              if (e.target.value) set({ lockAtUTC: localInputToIso(e.target.value) });
            }}
          />
        </Field>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-sm font-semibold text-silver">
            <input
              type="checkbox"
              className="h-4 w-4 accent-honolulu"
              checked={draft.scoreBonuses}
              onChange={(e) => set({ scoreBonuses: e.target.checked })}
            />
            Score bonuses (Team. Win. Score.)
          </label>
        </div>
      </div>
      {game && (
        <p className="mt-2 text-xs text-fog">
          The Lions play this week, so score bonuses default on — Closest-To, Exacto, Perfecto, and
          the Kiss of Death all apply to the winner + score every player submits.
        </p>
      )}

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="display text-xl">Questions</h4>
          <span className="text-xs text-fog">{draft.questions.length} on the slate</span>
        </div>
        <div className="space-y-4">
          {draft.questions.map((q, i) => (
            <QuestionCard
              key={q.id}
              q={q}
              onChange={(next) =>
                set({ questions: draft.questions.map((x, j) => (j === i ? next : x)) })
              }
              onRemove={() => removeQuestion(i)}
            />
          ))}
          {draft.questions.length === 0 && (
            <p className="rounded-lg border border-dashed border-edge-2 p-4 text-sm text-fog">
              No questions yet. A slate with no questions is just a newsletter. Add one.
            </p>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-fog">
            Add question:
          </span>
          {(Object.keys(KIND_LABEL) as Question["kind"][]).map((kind) => (
            <Btn
              key={kind}
              kind="ghost"
              className="!px-3 !py-1.5 !text-xs"
              onClick={() => addQuestion(kind)}
            >
              + {KIND_LABEL[kind]}
            </Btn>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-gold/30 bg-gold/5 p-4">
        <label className="flex items-center gap-2 text-sm font-bold text-gold">
          <input
            type="checkbox"
            className="h-4 w-4 accent-gold"
            checked={!!draft.comboBonus}
            onChange={(e) => toggleCombo(e.target.checked)}
          />
          Combo bonus — sweep a set of questions, get extra
        </label>
        {draft.comboBonus && (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap gap-2">
              {draft.questions.map((q) => (
                <label
                  key={q.id}
                  className="flex items-center gap-2 rounded-lg border border-edge px-3 py-1.5 text-xs text-silver"
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-gold"
                    checked={draft.comboBonus!.questionIds.includes(q.id)}
                    onChange={(e) => toggleComboQuestion(q.id, e.target.checked)}
                  />
                  <span className="font-mono text-fog">{q.id}</span> {questionLabel(q)}
                </label>
              ))}
            </div>
            <Field label="Sweep bonus pays" className="max-w-40">
              <NumInput
                value={draft.comboBonus.allCorrectBonus}
                onChange={(allCorrectBonus) =>
                  set({ comboBonus: { ...draft.comboBonus!, allCorrectBonus } })
                }
              />
            </Field>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-edge pt-4">
        <Btn onClick={onSave} className="!px-6">
          Save Week {draft.week}
        </Btn>
        {savedNote && (
          <span className="text-sm font-semibold text-win">
            Saved to this browser (demo). Live version publishes to everyone.
          </span>
        )}
      </div>
    </Card>
  );
}

// --- Page --------------------------------------------------------------------

function ContestBuilder() {
  const hydrated = useHydrated();
  useStoreVersion();
  const contests = hydrated ? effectiveContests() : CONTESTS;

  const [selectedWeek, setSelectedWeek] = useState<number>(DEFAULT_WEEK);
  const [draft, setDraft] = useState<Contest | null>(null);
  const [savedNote, setSavedNote] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    const c = effectiveContest(selectedWeek);
    if (!c) {
      setDraft(null);
      return;
    }
    // The draft mirrors the stored contest verbatim — a saved scoreBonuses:false
    // stays false. The game-week default lives where contests are created
    // (lib/demo-data.ts), not here.
    setDraft(clone(c));
    setSavedNote(false);
  }, [hydrated, selectedWeek]);

  const handleSave = () => {
    if (!draft) return;
    saveContest(clone(draft));
    setSavedNote(true);
  };

  const handleEdit = (c: Contest) => {
    setDraft(c);
    setSavedNote(false);
  };

  return (
    <div className="space-y-6">
      <SectionTitle kicker="Admin · Weekly duty">Contest Builder</SectionTitle>
      <p className="max-w-2xl text-sm text-fog">
        Every week Mother builds the slate: pick the questions, set the divide, post it. Team. Win.
        Score. Don’t be an idiot.
      </p>

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Week rail (top strip on mobile) */}
        <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {contests.map((c) => {
            const g = gameForWeek(c.week);
            const active = c.week === selectedWeek;
            return (
              <button
                key={c.week}
                onClick={() => setSelectedWeek(c.week)}
                className={`flex shrink-0 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition ${
                  active
                    ? "border-honolulu/60 bg-honolulu/10"
                    : "border-edge bg-panel hover:border-edge-2"
                }`}
              >
                <span className="flex items-baseline gap-2">
                  <span className="display text-lg">Wk {c.week}</span>
                  <span className="text-xs text-fog">
                    {g ? `${g.home ? "vs" : "@"} ${g.opponent}` : "Bye"}
                  </span>
                </span>
                <Pill tone={STATUS_TONE[c.status]}>{c.status}</Pill>
              </button>
            );
          })}
        </div>

        {/* Editor + preview */}
        <div className="min-w-0 space-y-6">
          {hydrated && draft ? (
            <>
              <WeekEditor
                draft={draft}
                onChange={handleEdit}
                onSave={handleSave}
                savedNote={savedNote}
              />
              <SlatePreview contest={draft} />
            </>
          ) : (
            <Card className="p-6 text-sm text-fog">Pulling up the slate...</Card>
          )}

          <div className="rounded-xl border border-honolulu/40 bg-honolulu/5 p-4 text-sm text-fog">
            <span className="font-bold text-sky">Workflow:</span> build the slate here, flip it to
            open, and when the final whistle blows take the numbers to the{" "}
            <Link href="/admin/grading/" className="text-sky underline">
              Grading Console
            </Link>
            . The engine does the rest.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminContestsPage() {
  return (
    <AdminGate>
      <ContestBuilder />
    </AdminGate>
  );
}
