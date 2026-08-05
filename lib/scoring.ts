// ---------------------------------------------------------------------------
// The grading engine. Pure functions only — the demo runs this in the
// browser against mock data, and the production app will run the exact same
// code on the server against real results.
// ---------------------------------------------------------------------------

import type {
  Contest,
  LineItem,
  MoneylineQ,
  OverUnderQ,
  PickemQ,
  PropQ,
  Question,
  SpreadQ,
  Submission,
  TeamAbbr,
  UserWeekGrade,
  WeekResults,
} from "./types";
import { teamInfo } from "./teams";
import { fmtPts } from "./format";

// --- Score-pick bonus values (rules.md) ------------------------------------
export const BONUS = {
  CLOSEST: 5, // per team score, only when nobody nailed that score exactly
  EXACTO: 8, // nailed one team's score
  PERFECTO: 20, // nailed the entire final score
  KISS_OF_DEATH: -20, // picked the exact reverse of the final score
} as const;

/**
 * Season-configurable bonus payouts (Mother Superior sets them in the admin
 * Settings). Defaults mirror BONUS; every grading entry point accepts an
 * override and threads it through, so changing a value re-scores the whole
 * season on the next render.
 */
export interface BonusValues {
  closest: number;
  exacto: number;
  perfecto: number;
  kod: number;
}

export const DEFAULT_BONUS_VALUES: BonusValues = {
  closest: BONUS.CLOSEST,
  exacto: BONUS.EXACTO,
  perfecto: BONUS.PERFECTO,
  kod: BONUS.KISS_OF_DEATH,
};

// --- Per-question grading ---------------------------------------------------

/** Winner's team abbr for the week's Lions game, from the final score. */
function lionsGameWinner(contest: Contest, results: WeekResults): string | null {
  if (results.lionsScore == null || results.oppScore == null) return null;
  if (results.lionsScore === results.oppScore) return "TIE";
  if (results.lionsScore > results.oppScore) return "DET";
  // Find the non-Lions team among the contest's moneyline/spread questions,
  // falling back to any recorded value.
  for (const q of contest.questions) {
    if (q.kind === "moneyline") {
      const opp = q.options.find((o) => o.team !== "DET");
      if (opp) return opp.team;
    }
    if (q.kind === "spread") return q.favorite === "DET" ? q.dog : q.favorite;
  }
  return "OPP";
}

function gradeMoneyline(
  q: MoneylineQ,
  answer: string | undefined,
  contest: Contest,
  results: WeekResults,
): LineItem | null {
  const actual =
    (results.values[q.id] as string | undefined) ?? lionsGameWinner(contest, results);
  if (!actual || answer == null) return null;
  const opt = q.options.find((o) => o.team === answer);
  if (!opt) return null;
  const correct = answer === actual;
  return {
    label: `${teamInfo(answer).short} to win: ${correct ? "hit" : "miss"}`,
    points: correct ? opt.points : 0,
    kind: "question",
  };
}

/**
 * Mother Superior's math for derived-spread weeks: the side a winner+score pick lands
 * on. Shared with the pick form so the preview, the stored answer, and the
 * grade can never disagree.
 */
export function spreadSideFromScore(
  q: SpreadQ,
  pick: { lions: number; opp: number } | undefined,
): TeamAbbr | null {
  if (!pick) return null;
  const favScore = q.favorite === "DET" ? pick.lions : pick.opp;
  const dogScore = q.favorite === "DET" ? pick.opp : pick.lions;
  return favScore - dogScore > q.line ? q.favorite : q.dog;
}

function gradeSpread(
  q: SpreadQ,
  answer: string | undefined,
  results: WeekResults,
  scorePick?: Submission["scorePick"],
): LineItem | null {
  if (results.lionsScore == null || results.oppScore == null) return null;
  // Derived weeks never trust a stored side — the score IS the pick, so a
  // side that contradicts the player's own score is impossible by design.
  const picked = q.derived ? spreadSideFromScore(q, scorePick) : answer;
  if (picked == null) return null;
  const favScore = q.favorite === "DET" ? results.lionsScore : results.oppScore;
  const dogScore = q.favorite === "DET" ? results.oppScore : results.lionsScore;
  const margin = favScore - dogScore;
  if (margin === q.line) {
    return { label: `Push on the ${fmtPts(q.line)} line`, points: 0, kind: "question" };
  }
  const favCovers = margin > q.line;
  const pickedFav = picked === q.favorite;
  const correct = pickedFav === favCovers;
  const label = pickedFav
    ? `${teamInfo(q.favorite).short} −${fmtPts(q.line)}: ${correct ? "covered" : "no cover"}`
    : `${teamInfo(q.dog).short} +${fmtPts(q.line)}: ${correct ? "covered" : "no cover"}`;
  return {
    label,
    points: correct ? (pickedFav ? q.favoritePoints : q.dogPoints) : 0,
    kind: "question",
  };
}

function actualForOverUnder(q: OverUnderQ, results: WeekResults): number | null {
  if (q.source === "total") {
    if (results.lionsScore == null || results.oppScore == null) return null;
    return results.lionsScore + results.oppScore;
  }
  if (q.source === "lionsMargin") {
    if (results.lionsScore == null || results.oppScore == null) return null;
    return results.lionsScore - results.oppScore;
  }
  const v = results.values[q.id];
  return typeof v === "number" ? v : null;
}

function gradeOverUnder(
  q: OverUnderQ,
  answer: string | undefined,
  results: WeekResults,
): LineItem | null {
  const actual = actualForOverUnder(q, results);
  if (actual == null || answer == null) return null;
  // Over and under are the only sides; an actual landing exactly on the
  // line pays neither. (Legacy "exact" answers grade as no answer.)
  if (answer !== "over" && answer !== "under") return null;
  const correct = answer === "over" ? actual > q.line : actual < q.line;
  const points = correct ? (answer === "over" ? q.overPoints : q.underPoints) : 0;
  const word = answer === "over" ? "Over" : "Under";
  return {
    label: `${word} ${fmtPts(q.line)} (${q.label}: ${fmtPts(actual)}): ${correct ? "hit" : "miss"}`,
    points,
    kind: "question",
  };
}

function gradeProp(q: PropQ, answer: string | undefined, results: WeekResults): LineItem | null {
  const actual = results.values[q.id];
  if (typeof actual !== "string" || answer == null) return null;
  const picked = q.options.find((o) => o.key === answer);
  const correct = answer === actual;
  return {
    label: `${q.question} → ${picked?.label ?? answer}: ${correct ? "hit" : "miss"}`,
    points: correct ? q.points : 0,
    kind: "question",
  };
}

function gradePickem(
  q: PickemQ,
  answer: Record<string, string> | undefined,
  results: WeekResults,
): LineItem[] {
  const actual = results.values[q.id];
  if (!answer || typeof actual !== "object" || actual == null) return [];
  const winners = actual as Record<string, string>;
  const graded = q.games.filter((g) => winners[g.id] && answer[g.id]);
  if (graded.length === 0) return [];
  const correct = graded.filter((g) => answer[g.id] === winners[g.id]).length;
  const n = graded.length;
  // The sweep totals are about the FULL slate (2025 Week 15: all five games),
  // not whatever subset happens to be graded so far.
  const fullSlate = n === q.games.length;
  const items: LineItem[] = [];
  if (fullSlate && correct === n && q.allCorrectTotal != null) {
    items.push({
      label: `Ran the table: ${n}/${n} correct`,
      points: q.allCorrectTotal,
      kind: "question",
    });
  } else if (fullSlate && correct === 0 && q.allWrongTotal != null) {
    items.push({
      label: `Perfectly wrong: 0/${n}. Mother Superior pays out for the sweep`,
      points: q.allWrongTotal,
      kind: "question",
    });
  } else {
    items.push({
      label: `Pick'em slate: ${correct}/${n} correct`,
      points: correct * q.pointsPerCorrect,
      kind: "question",
    });
  }
  return items;
}

function isQuestionCorrect(
  q: Question,
  sub: Submission,
  contest: Contest,
  results: WeekResults,
): boolean {
  const a = sub.answers[q.id];
  switch (q.kind) {
    case "moneyline": {
      const actual =
        (results.values[q.id] as string | undefined) ?? lionsGameWinner(contest, results);
      return typeof a === "string" && a === actual;
    }
    case "spread": {
      const item = gradeSpread(q, a as string | undefined, results, sub.scorePick);
      return !!item && item.points > 0;
    }
    case "overUnder": {
      const item = gradeOverUnder(q, a as string | undefined, results);
      return !!item && item.points > 0;
    }
    case "prop":
      return typeof a === "string" && a === results.values[q.id];
    case "pickem": {
      const winners = results.values[q.id];
      if (typeof a !== "object" || a == null || typeof winners !== "object" || winners == null)
        return false;
      return q.games.every(
        (g) => (a as Record<string, string>)[g.id] === (winners as Record<string, string>)[g.id],
      );
    }
  }
}

// --- Score-pick bonuses -----------------------------------------------------

/**
 * Grades the winner+score portion for every submission at once (Closest-To
 * is relative, so it can only be computed with the whole field in hand).
 * Returns userId -> bonus line items.
 */
export function gradeScoreBonuses(
  contest: Contest,
  results: WeekResults,
  subs: Submission[],
  bonus: BonusValues = DEFAULT_BONUS_VALUES,
): Map<string, LineItem[]> {
  const out = new Map<string, LineItem[]>();
  if (!contest.scoreBonuses || results.lionsScore == null || results.oppScore == null) return out;
  const L = results.lionsScore;
  const O = results.oppScore;

  const withPick = subs.filter((s) => s.scorePick);
  const add = (id: string, item: LineItem) => {
    if (!out.has(id)) out.set(id, []);
    out.get(id)!.push(item);
  };

  // Pass 1: perfecto / kiss of death / exacto, and note who nailed each side.
  let someoneExactLions = false;
  let someoneExactOpp = false;
  const perfecto = new Set<string>();
  const kod = new Set<string>();
  for (const s of withPick) {
    const p = s.scorePick!;
    if (p.lions === L && p.opp === O) {
      perfecto.add(s.userId);
      someoneExactLions = someoneExactOpp = true;
      add(s.userId, {
        label: "PERFECTO: nailed the final score",
        points: bonus.perfecto,
        kind: "bonus",
        bonusType: "perfecto",
      });
      continue;
    }
    if (p.lions === O && p.opp === L && L !== O) {
      kod.add(s.userId);
      add(s.userId, {
        label: "KISS OF DEATH: exact reverse of the final score",
        points: bonus.kod,
        kind: "penalty",
        bonusType: "kod",
      });
      // A reversed score can still nail one side when the game is close, but
      // per Mother Superior the kiss stands alone. Continue: no exacto stacking.
      continue;
    }
    if (p.lions === L) {
      someoneExactLions = true;
      add(s.userId, {
        label: `EXACTO: called Lions ${L} on the nose`,
        points: bonus.exacto,
        kind: "bonus",
        bonusType: "exacto",
      });
    }
    if (p.opp === O) {
      someoneExactOpp = true;
      add(s.userId, {
        label: `EXACTO: called the opponent's ${O} on the nose`,
        points: bonus.exacto,
        kind: "bonus",
        bonusType: "exacto",
      });
    }
  }

  // Pass 2: closest-to, one award per side, only when nobody was exact on
  // that side. Ties all cash. The kiss stands alone: a KOD pick can neither
  // win closest-to nor block the legitimately-closest player.
  const sides: Array<{ exact: boolean; actual: number; get: (p: { lions: number; opp: number }) => number; label: string }> = [
    { exact: someoneExactLions, actual: L, get: (p) => p.lions, label: "Lions" },
    { exact: someoneExactOpp, actual: O, get: (p) => p.opp, label: "opponent" },
  ];
  const inTheRunning = withPick.filter((s) => !kod.has(s.userId));
  for (const side of sides) {
    if (side.exact) continue;
    let best = Infinity;
    for (const s of inTheRunning) best = Math.min(best, Math.abs(side.get(s.scorePick!) - side.actual));
    if (!Number.isFinite(best)) continue;
    for (const s of inTheRunning) {
      const diff = Math.abs(side.get(s.scorePick!) - side.actual);
      if (diff === best) {
        add(s.userId, {
          label: `CLOSEST TO: ${side.label} score (off by ${diff})`,
          points: bonus.closest,
          kind: "bonus",
          bonusType: "closest",
        });
      }
    }
  }
  return out;
}

// --- Whole-week grading -----------------------------------------------------

export function gradeWeek(
  contest: Contest,
  results: WeekResults,
  subs: Submission[],
  bonus: BonusValues = DEFAULT_BONUS_VALUES,
): UserWeekGrade[] {
  const bonusMap = gradeScoreBonuses(contest, results, subs, bonus);
  return subs.map((sub) => {
    const items: LineItem[] = [];
    for (const q of contest.questions) {
      const a = sub.answers[q.id];
      switch (q.kind) {
        case "moneyline": {
          const item = gradeMoneyline(q, a as string | undefined, contest, results);
          if (item) items.push(item);
          break;
        }
        case "spread": {
          const item = gradeSpread(q, a as string | undefined, results, sub.scorePick);
          if (item) items.push(item);
          break;
        }
        case "overUnder": {
          const item = gradeOverUnder(q, a as string | undefined, results);
          if (item) items.push(item);
          break;
        }
        case "prop": {
          const item = gradeProp(q, a as string | undefined, results);
          if (item) items.push(item);
          break;
        }
        case "pickem":
          items.push(...gradePickem(q, a as Record<string, string> | undefined, results));
          break;
      }
    }
    if (contest.comboBonus) {
      const qs = contest.questions.filter((q) => contest.comboBonus!.questionIds.includes(q.id));
      if (qs.length > 0 && qs.every((q) => isQuestionCorrect(q, sub, contest, results))) {
        items.push({
          label: `Swept all ${qs.length}: combo bonus`,
          points: contest.comboBonus.allCorrectBonus,
          kind: "bonus",
        });
      }
    }
    items.push(...(bonusMap.get(sub.userId) ?? []));
    return {
      userId: sub.userId,
      week: contest.week,
      items,
      total: items.reduce((t, i) => t + i.points, 0),
    };
  });
}

// --- Season standings -------------------------------------------------------

export interface SeasonInput {
  contest: Contest;
  results: WeekResults;
  subs: Submission[];
}

/** One column of the season graph: everyone's rank/total after that week. */
export interface WeekRanks {
  week: number;
  ranks: Record<string, { rank: number; total: number; weekPts?: number }>;
}

/**
 * Standings recomputed after each successive graded week, for the season
 * movement graph. Cheap: one computeStandings call per prefix.
 */
export function rankProgression(
  userIds: string[],
  weeks: SeasonInput[],
  bonus: BonusValues = DEFAULT_BONUS_VALUES,
): WeekRanks[] {
  const sorted = [...weeks].sort((a, b) => a.contest.week - b.contest.week);
  return sorted.map((w, i) => {
    const rows = computeStandings(userIds, sorted.slice(0, i + 1), bonus);
    return {
      week: w.contest.week,
      ranks: Object.fromEntries(
        rows.map((r) => [r.userId, { rank: r.rank, total: r.total, weekPts: r.weekly[w.contest.week] }]),
      ),
    };
  });
}

export function computeStandings(
  userIds: string[],
  weeks: SeasonInput[],
  bonus: BonusValues = DEFAULT_BONUS_VALUES,
): import("./types").StandingsRow[] {
  const weekly = new Map<string, Record<number, number>>();
  const bonuses = new Map<string, { closest: number; exacto: number; perfecto: number; kod: number }>();
  for (const id of userIds) {
    weekly.set(id, {});
    bonuses.set(id, { closest: 0, exacto: 0, perfecto: 0, kod: 0 });
  }
  const graded = [...weeks].sort((a, b) => a.contest.week - b.contest.week);
  for (const w of graded) {
    for (const g of gradeWeek(w.contest, w.results, w.subs, bonus)) {
      if (!weekly.has(g.userId)) continue;
      weekly.get(g.userId)![w.contest.week] = g.total;
      const b = bonuses.get(g.userId)!;
      for (const item of g.items) {
        if (item.bonusType) b[item.bonusType]++;
      }
    }
  }
  const totalThrough = (id: string, uptoIdx: number) =>
    graded.slice(0, uptoIdx + 1).reduce((t, w) => t + (weekly.get(id)![w.contest.week] ?? 0), 0);

  const rankAt = (uptoIdx: number) => {
    const totals = userIds
      .map((id) => ({ id, total: totalThrough(id, uptoIdx) }))
      .sort((a, b) => b.total - a.total);
    const ranks = new Map<string, number>();
    totals.forEach((t, i) => {
      // standard competition ranking: ties share a rank
      const rank = i > 0 && totals[i - 1].total === t.total ? ranks.get(totals[i - 1].id)! : i + 1;
      ranks.set(t.id, rank);
    });
    return ranks;
  };

  const last = graded.length - 1;
  const nowRanks = rankAt(last);
  const prevRanks = graded.length > 1 ? rankAt(last - 1) : null;

  return userIds
    .map((id) => ({
      userId: id,
      rank: nowRanks.get(id) ?? userIds.length,
      prevRank: prevRanks?.get(id),
      total: totalThrough(id, last),
      weekly: weekly.get(id)!,
      bonuses: bonuses.get(id)!,
    }))
    .sort((a, b) => a.rank - b.rank || a.userId.localeCompare(b.userId));
}
