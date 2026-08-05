// ---------------------------------------------------------------------------
// Core domain types for The Lions Pool.
// Everything the contest builder, pick forms, grading engine, and admin
// screens share lives here.
// ---------------------------------------------------------------------------

export type TeamAbbr = string; // "DET", "GB", "NO", ...

// --- Schedule -------------------------------------------------------------

export interface ScheduleGame {
  week: number;
  dateUTC: string; // kickoff, ISO UTC
  home: boolean; // true = Lions home game
  neutral?: boolean; // e.g. Munich
  opponent: TeamAbbr;
  venue: string;
  city: string;
  country?: string; // set when not USA
  timeTBD?: boolean;
}

// --- Questions ------------------------------------------------------------
// A weekly contest is a list of questions. Each kind mirrors a slate style
// Mother has actually run (see 2025 Pool.md).

interface QBase {
  id: string;
  kind: string;
  /** Optional heading shown above the question on the pick form. */
  title?: string;
}

/** Pick the outright winner; each side pays its own points (the "points divide"). */
export interface MoneylineQ extends QBase {
  kind: "moneyline";
  options: { team: TeamAbbr; points: number }[];
}

/** Pick against Mother's spread. Favorite must win by more than `line`. */
export interface SpreadQ extends QBase {
  kind: "spread";
  favorite: TeamAbbr;
  dog: TeamAbbr;
  line: number; // positive, e.g. 7.5
  favoritePoints: number; // points for correctly taking the favorite to cover
  dogPoints: number; // points for correctly taking the dog (+line or outright win)
  /**
   * A "Mother does the math" week (2025 Weeks 16/18): players never declare
   * a side. The side is derived from their winner+score pick's margin
   * against the line — on the form AND in grading, so a stored side can
   * never contradict the score.
   */
  derived?: boolean;
}

/**
 * Over/under on some number. `source` tells the grader where the actual
 * number comes from:
 *  - "total": combined final score of the Lions game
 *  - "lionsMargin": Lions final score minus opponent final score
 *  - "stat": a number the admin enters at grading time (player props etc.)
 * A result landing exactly on the line pays neither side; exact score calls
 * are rewarded by the score bonuses (Exacto/Perfecto), not the O/U.
 */
export interface OverUnderQ extends QBase {
  kind: "overUnder";
  label: string;
  line: number;
  overPoints: number;
  underPoints: number;
  source: "total" | "lionsMargin" | "stat";
  /**
   * Ask the player directly even though the graded actual is derived from
   * the final score — an independently answered total prop (2025 Week 13).
   * Without this, a "total"/"lionsMargin" question on a score-bonuses week
   * is answered automatically by the player's score pick.
   */
  answeredByPlayer?: true;
}

/** Two-option prop bet ("Who has more passing yards — Goff or Hurts?"). */
export interface PropQ extends QBase {
  kind: "prop";
  question: string;
  options: { key: string; label: string }[];
  points: number;
}

export interface PickemGame {
  id: string;
  away: TeamAbbr;
  home: TeamAbbr;
  dateUTC?: string;
}

/**
 * Multi-game pick'em slate (bye weeks and the like).
 * `allCorrectTotal` / `allWrongTotal` REPLACE the per-game sum when a player
 * runs the table in either direction (2025 Week 15: 5 games x 4 pts, all
 * correct pays 25 total, all wrong pays 30 total).
 */
export interface PickemQ extends QBase {
  kind: "pickem";
  games: PickemGame[];
  pointsPerCorrect: number;
  allCorrectTotal?: number;
  allWrongTotal?: number;
}

export type Question = MoneylineQ | SpreadQ | OverUnderQ | PropQ | PickemQ;

/** Bonus for sweeping a set of questions (2025 Week 11: all 4 correct = +5). */
export interface ComboBonus {
  questionIds: string[];
  allCorrectBonus: number;
}

// --- Contest --------------------------------------------------------------

/** draft = Mother hasn't posted the slate yet. */
export type ContestStatus = "draft" | "open" | "locked" | "graded";

export interface Contest {
  week: number;
  title: string;
  /** Mother's announcement copy for the week. */
  blurb?: string;
  /** Mother's own pick, shown as flavor ("Mother Says: ..."). */
  motherSays?: string;
  hasLionsGame: boolean;
  lockAtUTC: string;
  questions: Question[];
  comboBonus?: ComboBonus;
  /**
   * When true (every Lions game), players also submit winner + exact score
   * and the Closest-To / Exacto / Perfecto / Kiss of Death bonuses apply.
   */
  scoreBonuses: boolean;
  status: ContestStatus;
}

// --- Picks ----------------------------------------------------------------

/** Sentinel winner for a predicted tie (equal scores). Ties are real in the
 * NFL regular season; a tie pick collects no winner points but stays fully
 * eligible for score bonuses. */
export const TIE = "TIE";

export interface ScorePick {
  winner: TeamAbbr; // team abbr, or TIE when lions === opp
  lions: number; // predicted Lions points
  opp: number; // predicted opponent points
}

/** Answer to one question: option key / team abbr, or per-game map for pick'em. */
export type AnswerValue = string | Record<string, TeamAbbr>;

export interface Submission {
  userId: string;
  week: number;
  submittedAtUTC: string;
  answers: Record<string, AnswerValue>; // questionId -> answer
  scorePick?: ScorePick;
}

// --- Results & grading ----------------------------------------------------

/**
 * What actually happened, entered by the admin (or, in production, pulled
 * from the scores API). `values` holds per-question actuals keyed by
 * question id: a number for "stat" over/unders, an option key for props,
 * a { gameId -> winner } map for pick'ems.
 */
export interface WeekResults {
  week: number;
  lionsScore?: number;
  oppScore?: number;
  values: Record<string, number | string | Record<string, TeamAbbr>>;
}

export type LineItemKind = "question" | "bonus" | "penalty";

export type ScoreBonusType = "closest" | "exacto" | "perfecto" | "kod";

export interface LineItem {
  label: string;
  points: number;
  kind: LineItemKind;
  /** Set on score-bonus items so tallies never depend on label wording. */
  bonusType?: ScoreBonusType;
}

export interface UserWeekGrade {
  userId: string;
  week: number;
  items: LineItem[];
  total: number;
}

// --- People ---------------------------------------------------------------

export interface Participant {
  id: string;
  /** Real name. ADMIN-ONLY: never render on a public page. */
  name: string;
  /** ADMIN-ONLY, same rule as `name`. */
  email?: string;
  /**
   * The only name the pool sees, on every public surface. Set by
   * Mother Superior alone; players cannot change it.
   */
  nickname: string;
  /** Hex accent used for the avatar chip and the season graph series. */
  avatarColor: string;
  isAdmin?: boolean;
}

/** Season buy-in bookkeeping, tracked by the Commissioner. */
export interface PaymentRecord {
  userId: string;
  paid: boolean;
  markedAtUTC?: string;
  note?: string;
}

export interface StandingsRow {
  userId: string;
  rank: number;
  prevRank?: number;
  total: number;
  weekly: Record<number, number>; // week -> points
  bonuses: { closest: number; exacto: number; perfecto: number; kod: number };
}
