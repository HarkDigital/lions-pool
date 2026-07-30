// ---------------------------------------------------------------------------
// Demo season data: the 2026 schedule dressed with slates modeled on what
// Mother Superior actually ran in 2025 (see 2025 Pool.md). The demo clock is frozen
// at Thursday Oct 1, 2026: Weeks 1–3 graded, Week 4 open, Week 5+ drafts.
// Standings are computed live by lib/scoring.ts from this data — there is
// no hand-entered standings table anywhere.
// ---------------------------------------------------------------------------

import type { Contest, Participant, Submission, WeekResults } from "./types";

export const DEMO_NOW = "2026-10-01T16:00:00Z";
export const CURRENT_WEEK = 4;

// --- People ----------------------------------------------------------------

// `name` and `email` are the private identity: ADMIN-ONLY, never rendered on
// a public page. `nickname` is the only name the pool ever sees, and only
// Mother Superior can set or change it. Avatar colors are a CVD-validated
// 10-slot categorical palette (fixed assignment order; used as series colors
// in the season graph, so never reassign them by rank).
export const MOTHER: Participant = {
  id: "mother",
  name: "The Commissioner",
  nickname: "Mother Superior",
  avatarColor: "#0076b6",
  isAdmin: true,
};

export const PLAYERS: Participant[] = [
  { id: "tina", name: "Tina Kaczmarek", email: "tina@lionspool.demo", nickname: "Two-Point Tina", avatarColor: "#3987e5" },
  { id: "denny", name: "Dennis Coney", email: "denny@lionspool.demo", nickname: "Denny Coneys", avatarColor: "#d95926" },
  { id: "bigcat", name: "Dan Kowalski", email: "dank@lionspool.demo", nickname: "Big Cat", avatarColor: "#199e70" },
  { id: "chops", name: "Charlie McGraw", email: "chops@lionspool.demo", nickname: "Chops", avatarColor: "#c98500" },
  { id: "uncle", name: "Rich Spadafore", email: "rich@lionspool.demo", nickname: "Uncle Spread", avatarColor: "#d55181" },
  { id: "gary", name: "Gary Gervin", email: "gary@lionspool.demo", nickname: "Gravy Boat", avatarColor: "#008300" },
  { id: "intern", name: "Kyle Burton", email: "kyle@lionspool.demo", nickname: "The Intern", avatarColor: "#9085e9" },
  { id: "muscle", name: "Stan Wozniak", email: "stan@lionspool.demo", nickname: "Polish Muscle", avatarColor: "#e66767" },
  { id: "machine", name: "Marty Loveland", email: "marty@lionspool.demo", nickname: "The Machine", avatarColor: "#0891b2" },
  { id: "eddie", name: "Ed Sweeney", email: "eddie@lionspool.demo", nickname: "Sweaty Eddie", avatarColor: "#b45309" },
];

export const EVERYONE: Participant[] = [MOTHER, ...PLAYERS];

export function participant(id: string): Participant | undefined {
  return EVERYONE.find((p) => p.id === id);
}

// --- Contests: all 18 weeks ------------------------------------------------

export const CONTESTS: Contest[] = [
  {
    week: 1,
    title: "Old Reliable: Team / Win / Score",
    blurb:
      "Season opener at the Ford. The Saints are coming to Detroit to get their annual physical. You know the drill by now. TEAM, WIN, SCORE. Nothing cute. Nothing fresh. Don't be an idiot.",
    motherSays: "LIONS WIN 31-13",
    hasLionsGame: true,
    lockAtUTC: "2026-09-13T17:00Z",
    questions: [
      {
        id: "w1-ml",
        kind: "moneyline",
        options: [
          { team: "DET", points: 4.5 },
          { team: "NO", points: 16 },
        ],
      },
    ],
    scoreBonuses: true,
    status: "graded",
  },
  {
    week: 2,
    title: "Thursday Night Spread in Buffalo",
    blurb:
      "Short week, cold parking lots, folding tables. Mother Superior's line: BILLS −2.5. Take a side and give me your score. Eight points either way, so no whining about the divide.",
    motherSays: "LIONS WIN 27-24",
    hasLionsGame: true,
    lockAtUTC: "2026-09-18T00:15Z",
    questions: [
      {
        id: "w2-spread",
        kind: "spread",
        favorite: "BUF",
        dog: "DET",
        line: 2.5,
        favoritePoints: 8,
        dogPoints: 8,
      },
    ],
    scoreBonuses: true,
    status: "graded",
  },
  {
    week: 3,
    title: "Jets at the Ford: The Points Divide",
    blurb:
      "The Jets exist, technically, and they're coming to Detroit. Everybody on earth knows how this ends, so the divide is ugly on purpose. Longshots welcome. Ask The Machine how that's been going since 2019.",
    motherSays: "LIONS WIN 34-10",
    hasLionsGame: true,
    lockAtUTC: "2026-09-27T17:00Z",
    questions: [
      {
        id: "w3-ml",
        kind: "moneyline",
        options: [
          { team: "DET", points: 3.5 },
          { team: "NYJ", points: 16 },
        ],
      },
    ],
    scoreBonuses: true,
    status: "graded",
  },
  {
    week: 4,
    title: "Sunday Night in Charlotte + The Total",
    blurb:
      "Prime time against the Panthers. Same as always: TEAM, WIN, SCORE. This week your score does double duty: the combined total is OVER/UNDER 44.5. Your score pick decides your side automatically, so pick a score you actually believe in.",
    motherSays: "LIONS WIN 34-20",
    hasLionsGame: true,
    lockAtUTC: "2026-10-05T00:20Z",
    questions: [
      {
        id: "w4-ou",
        kind: "overUnder",
        label: "combined score, Lions vs Panthers",
        line: 44.5,
        overPoints: 8,
        underPoints: 8,
        source: "total",
      },
    ],
    scoreBonuses: true,
    status: "open",
  },
  {
    week: 5,
    title: "Desert Divide in Glendale",
    blurb: "Lions in the desert. The divide says everything about how Mother Superior feels about Arizona.",
    hasLionsGame: true,
    lockAtUTC: "2026-10-11T20:25Z",
    questions: [
      {
        id: "w5-ml",
        kind: "moneyline",
        options: [
          { team: "DET", points: 5 },
          { team: "ARI", points: 14 },
        ],
      },
    ],
    scoreBonuses: true,
    status: "draft",
  },
  {
    week: 6,
    title: "Bye Week Around-the-League Slate",
    blurb:
      "The boys get a week off. You don't. Five games, four points a pop. Run the table and the payout bumps to 25. Go 0-for-5, perfectly and beautifully wrong, and Mother Superior pays 30. That is not a typo. Incompetence at scale deserves a reward.",
    hasLionsGame: false,
    lockAtUTC: "2026-10-18T17:00Z",
    questions: [
      {
        id: "w6-pick",
        kind: "pickem",
        games: [
          { id: "g1", away: "CHI", home: "ATL", dateUTC: "2026-10-18T17:00Z" },
          { id: "g2", away: "BAL", home: "CLE", dateUTC: "2026-10-18T17:00Z" },
          { id: "g3", away: "LAC", home: "KC", dateUTC: "2026-10-18T20:25Z" },
          { id: "g4", away: "DAL", home: "GB", dateUTC: "2026-10-19T00:20Z" },
          { id: "g5", away: "WSH", home: "SF", dateUTC: "2026-10-20T00:15Z" },
        ],
        pointsPerCorrect: 4,
        allCorrectTotal: 25,
        allWrongTotal: 30,
      },
    ],
    scoreBonuses: false,
    status: "draft",
  },
  {
    week: 7,
    title: "Packers Week. Even Money.",
    blurb:
      "Green Bay at the Ford. Twelve points either way because this rivalry doesn't need Mother Superior's thumb on the scale. TEAM, WIN, SCORE.",
    hasLionsGame: true,
    lockAtUTC: "2026-10-25T20:25Z",
    questions: [
      {
        id: "w7-ml",
        kind: "moneyline",
        options: [
          { team: "DET", points: 12 },
          { team: "GB", points: 12 },
        ],
      },
    ],
    scoreBonuses: true,
    status: "draft",
  },
  {
    week: 8,
    title: "Vikings at the Ford",
    hasLionsGame: true,
    lockAtUTC: "2026-11-01T18:00Z",
    questions: [
      {
        id: "w8-ml",
        kind: "moneyline",
        options: [
          { team: "DET", points: 7 },
          { team: "MIN", points: 13 },
        ],
      },
    ],
    scoreBonuses: true,
    status: "draft",
  },
  {
    week: 9,
    title: "Miami Margin Call",
    blurb: "Will the Lions win by OVER or UNDER 6.5? Pick a side, then give me the score as always.",
    hasLionsGame: true,
    lockAtUTC: "2026-11-08T18:00Z",
    questions: [
      {
        id: "w9-ou",
        kind: "overUnder",
        label: "Lions margin of victory",
        line: 6.5,
        overPoints: 4,
        underPoints: 4,
        source: "lionsMargin",
      },
    ],
    scoreBonuses: true,
    status: "draft",
  },
  {
    week: 10,
    title: "Munich: Over / Under / Straight Money",
    blurb:
      "The Lions play the Patriots in Munich, Germany, at 9:30 in the morning like animals. THE NUMBER IS 47. Your score pick puts you Over, Under, or, if you land the combined total exactly on 47, Straight Money for the big payout.",
    hasLionsGame: true,
    lockAtUTC: "2026-11-15T14:30Z",
    questions: [
      {
        id: "w10-ou",
        kind: "overUnder",
        label: "combined score in Munich",
        line: 47,
        overPoints: 10.5,
        underPoints: 10.5,
        exactPoints: 21,
        source: "total",
      },
    ],
    scoreBonuses: true,
    status: "draft",
  },
  {
    week: 11,
    title: "Tampa Prop Pack",
    blurb:
      "Four answers, five points apiece. Sweep all four and Mother Superior adds five more. Go 0-for-4 and you get nothing, which you will have earned.",
    hasLionsGame: true,
    lockAtUTC: "2026-11-22T18:00Z",
    questions: [
      {
        id: "w11-ml",
        kind: "moneyline",
        title: "Who wins: Lions or Bucs? (score required as always)",
        options: [
          { team: "DET", points: 5 },
          { team: "TB", points: 5 },
        ],
      },
      {
        id: "w11-qb",
        kind: "prop",
        question: "More passing yards",
        options: [
          { key: "goff", label: "Goff" },
          { key: "mayfield", label: "Mayfield" },
        ],
        points: 5,
      },
      {
        id: "w11-rb",
        kind: "prop",
        question: "More rushing yards",
        options: [
          { key: "gibbs", label: "Gibbs" },
          { key: "irving", label: "Irving" },
        ],
        points: 5,
      },
      {
        id: "w11-wr",
        kind: "prop",
        question: "More receiving yards",
        options: [
          { key: "stbrown", label: "St. Brown" },
          { key: "evans", label: "Evans" },
        ],
        points: 5,
      },
    ],
    comboBonus: { questionIds: ["w11-ml", "w11-qb", "w11-rb", "w11-wr"], allCorrectBonus: 5 },
    scoreBonuses: true,
    status: "draft",
  },
  {
    week: 12,
    title: "Thanksgiving: Bears, Gravy, and a Fat Spread",
    blurb:
      "The Turkey Day game. Mother Superior's line: LIONS −10.5. Cover pays 13. Take the Bears plus the points (or outright) for 6. Eat something first, then pick like an adult.",
    hasLionsGame: true,
    lockAtUTC: "2026-11-26T18:00Z",
    questions: [
      {
        id: "w12-spread",
        kind: "spread",
        favorite: "DET",
        dog: "CHI",
        line: 10.5,
        favoritePoints: 13,
        dogPoints: 6,
      },
    ],
    scoreBonuses: true,
    status: "draft",
  },
  {
    week: 13,
    title: "Atlanta: Straight Bet + Prop Bets",
    blurb: "Straight bet on the winner, then three props at three points a pop.",
    hasLionsGame: true,
    lockAtUTC: "2026-12-06T18:00Z",
    questions: [
      {
        id: "w13-ml",
        kind: "moneyline",
        title: "Straight bet: winner + score",
        options: [
          { team: "DET", points: 8 },
          { team: "ATL", points: 10 },
        ],
      },
      {
        id: "w13-qb",
        kind: "prop",
        question: "More total yards",
        options: [
          { key: "goff", label: "Goff" },
          { key: "penix", label: "Penix" },
        ],
        points: 3,
      },
      {
        id: "w13-td",
        kind: "prop",
        question: "First touchdown scored by",
        options: [
          { key: "DET", label: "Lions" },
          { key: "ATL", label: "Falcons" },
        ],
        points: 3,
      },
      {
        id: "w13-ou",
        kind: "overUnder",
        label: "combined score",
        line: 48.5,
        overPoints: 3,
        underPoints: 3,
        source: "total",
        // Third of the "three props" — answered on its own, like 2025.
        answeredByPlayer: true,
      },
    ],
    scoreBonuses: true,
    status: "draft",
  },
  {
    week: 14,
    title: "Titans at the Ford",
    hasLionsGame: true,
    lockAtUTC: "2026-12-13T18:00Z",
    questions: [
      {
        id: "w14-ml",
        kind: "moneyline",
        options: [
          { team: "DET", points: 4 },
          { team: "TEN", points: 17 },
        ],
      },
    ],
    scoreBonuses: true,
    status: "draft",
  },
  {
    week: 15,
    title: "December Five-Game Slate (+ Lions Score for Bonuses)",
    blurb:
      "Five games, four points per correct pick. All five right pays 25. All five wrong pays 30, because perfection is perfection. Give me the Lions-Vikings score too, bonuses only.",
    hasLionsGame: true,
    // Locks at the slate's earliest kickoff (Saturday game), not the Lions game.
    lockAtUTC: "2026-12-20T01:20Z",
    questions: [
      {
        id: "w15-pick",
        kind: "pickem",
        games: [
          { id: "g1", away: "CHI", home: "BUF", dateUTC: "2026-12-20T01:20Z" },
          { id: "g2", away: "BAL", home: "PIT", dateUTC: "2026-12-20T18:00Z" },
          { id: "g3", away: "MIA", home: "GB", dateUTC: "2026-12-20T18:00Z" },
          { id: "g4", away: "DAL", home: "LAR", dateUTC: "2026-12-20T21:25Z" },
          { id: "g5", away: "NE", home: "KC", dateUTC: "2026-12-22T01:15Z" },
        ],
        pointsPerCorrect: 4,
        allCorrectTotal: 25,
        allWrongTotal: 30,
      },
    ],
    scoreBonuses: true,
    status: "draft",
  },
  {
    week: 16,
    title: "Monday Night Giants: Mother Superior Does the Math",
    blurb:
      "The spread is LIONS −13.5. Don't tell me a side. Give me the WINNER and the SCORE like always and Mother Superior will do the math on where you landed.",
    hasLionsGame: true,
    lockAtUTC: "2026-12-29T01:15Z",
    questions: [
      {
        id: "w16-spread",
        kind: "spread",
        favorite: "DET",
        dog: "NYG",
        line: 13.5,
        favoritePoints: 14,
        dogPoints: 12.5,
        // "Don't tell me a side" — the side comes from the score pick.
        derived: true,
      },
    ],
    scoreBonuses: true,
    status: "draft",
  },
  {
    week: 17,
    title: "Soldier Field Numbers Game",
    blurb: "Three numbers, five points each. Winner and score on top, just for bonuses.",
    motherSays: "WILLIAMS UNDER / GOFF OVER / LIONS WIN 30-17",
    hasLionsGame: true,
    lockAtUTC: "2027-01-03T21:25Z",
    questions: [
      {
        id: "w17-qb1",
        kind: "overUnder",
        label: "Caleb Williams passing yards",
        line: 224.5,
        overPoints: 5,
        underPoints: 5,
        source: "stat",
      },
      {
        id: "w17-qb2",
        kind: "overUnder",
        label: "Goff passing yards",
        line: 265.5,
        overPoints: 5,
        underPoints: 5,
        source: "stat",
      },
      {
        id: "w17-ou",
        kind: "overUnder",
        label: "combined score",
        line: 44.5,
        overPoints: 5,
        underPoints: 5,
        source: "total",
      },
    ],
    scoreBonuses: true,
    status: "draft",
  },
  {
    week: 18,
    title: "The Frozen Finale at Lambeau",
    blurb:
      "Season finale in Green Bay. The line: PACKERS −3.5. Either side pays 14.5. Winner and score, one last time. Don't be an idiot.",
    hasLionsGame: true,
    lockAtUTC: "2027-01-10T18:00Z",
    questions: [
      {
        id: "w18-spread",
        kind: "spread",
        favorite: "GB",
        dog: "DET",
        line: 3.5,
        favoritePoints: 14.5,
        dogPoints: 14.5,
        // "Winner and score, one last time" — Mother Superior does the math.
        derived: true,
      },
    ],
    scoreBonuses: true,
    status: "draft",
  },
];

export function contestForWeek(week: number): Contest | undefined {
  return CONTESTS.find((c) => c.week === week);
}

// --- Results for graded weeks ---------------------------------------------

export const RESULTS: WeekResults[] = [
  { week: 1, lionsScore: 34, oppScore: 17, values: {} },
  { week: 2, lionsScore: 27, oppScore: 30, values: {} },
  { week: 3, lionsScore: 41, oppScore: 10, values: {} },
];

// --- Submissions -----------------------------------------------------------
// Weeks 1–3: full field of ten. Week 4: six picks already in before the
// demo user shows up (theirs get layered on from localStorage).

const at = (week: number, iso: string) => iso;

export const SUBMISSIONS: Submission[] = [
  // ---- Week 1 (final: DET 34, NO 17) ----
  { userId: "bigcat", week: 1, submittedAtUTC: at(1, "2026-09-12T15:04:00Z"), answers: { "w1-ml": "DET" }, scorePick: { winner: "DET", lions: 34, opp: 20 } },
  { userId: "tina", week: 1, submittedAtUTC: at(1, "2026-09-11T22:41:00Z"), answers: { "w1-ml": "DET" }, scorePick: { winner: "DET", lions: 27, opp: 17 } },
  { userId: "denny", week: 1, submittedAtUTC: at(1, "2026-09-13T14:20:00Z"), answers: { "w1-ml": "DET" }, scorePick: { winner: "DET", lions: 35, opp: 17 } },
  { userId: "chops", week: 1, submittedAtUTC: at(1, "2026-09-13T02:11:00Z"), answers: { "w1-ml": "DET" }, scorePick: { winner: "DET", lions: 24, opp: 10 } },
  { userId: "gary", week: 1, submittedAtUTC: at(1, "2026-09-12T19:33:00Z"), answers: { "w1-ml": "DET" }, scorePick: { winner: "DET", lions: 38, opp: 24 } },
  { userId: "uncle", week: 1, submittedAtUTC: at(1, "2026-09-13T16:12:00Z"), answers: { "w1-ml": "DET" }, scorePick: { winner: "DET", lions: 28, opp: 13 } },
  { userId: "intern", week: 1, submittedAtUTC: at(1, "2026-09-13T16:58:00Z"), answers: { "w1-ml": "NO" }, scorePick: { winner: "NO", lions: 17, opp: 20 } },
  { userId: "muscle", week: 1, submittedAtUTC: at(1, "2026-09-13T12:02:00Z"), answers: { "w1-ml": "DET" }, scorePick: { winner: "DET", lions: 30, opp: 16 } },
  { userId: "machine", week: 1, submittedAtUTC: at(1, "2026-09-13T16:59:00Z"), answers: { "w1-ml": "NO" }, scorePick: { winner: "NO", lions: 20, opp: 24 } },
  { userId: "eddie", week: 1, submittedAtUTC: at(1, "2026-09-13T09:15:00Z"), answers: { "w1-ml": "DET" }, scorePick: { winner: "DET", lions: 31, opp: 13 } },

  // ---- Week 2 (final: BUF 30, DET 27) ----
  { userId: "tina", week: 2, submittedAtUTC: at(2, "2026-09-17T20:10:00Z"), answers: { "w2-spread": "BUF" }, scorePick: { winner: "BUF", lions: 27, opp: 30 } },
  { userId: "eddie", week: 2, submittedAtUTC: at(2, "2026-09-17T23:58:00Z"), answers: { "w2-spread": "DET" }, scorePick: { winner: "DET", lions: 30, opp: 27 } },
  { userId: "denny", week: 2, submittedAtUTC: at(2, "2026-09-17T18:22:00Z"), answers: { "w2-spread": "BUF" }, scorePick: { winner: "BUF", lions: 27, opp: 33 } },
  { userId: "bigcat", week: 2, submittedAtUTC: at(2, "2026-09-16T21:45:00Z"), answers: { "w2-spread": "BUF" }, scorePick: { winner: "BUF", lions: 20, opp: 27 } },
  { userId: "machine", week: 2, submittedAtUTC: at(2, "2026-09-17T23:40:00Z"), answers: { "w2-spread": "BUF" }, scorePick: { winner: "BUF", lions: 10, opp: 34 } },
  { userId: "gary", week: 2, submittedAtUTC: at(2, "2026-09-17T15:00:00Z"), answers: { "w2-spread": "DET" }, scorePick: { winner: "DET", lions: 24, opp: 21 } },
  // Polish Muscle ghosted Week 2 entirely. The Shame list remembers.
  { userId: "chops", week: 2, submittedAtUTC: at(2, "2026-09-17T22:05:00Z"), answers: { "w2-spread": "BUF" }, scorePick: { winner: "BUF", lions: 28, opp: 31 } },
  { userId: "uncle", week: 2, submittedAtUTC: at(2, "2026-09-17T21:30:00Z"), answers: { "w2-spread": "DET" }, scorePick: { winner: "DET", lions: 20, opp: 17 } },
  { userId: "intern", week: 2, submittedAtUTC: at(2, "2026-09-18T00:10:00Z"), answers: { "w2-spread": "BUF" }, scorePick: { winner: "BUF", lions: 23, opp: 24 } },

  // ---- Week 3 (final: DET 41, NYJ 10) ----
  { userId: "gary", week: 3, submittedAtUTC: at(3, "2026-09-26T17:30:00Z"), answers: { "w3-ml": "DET" }, scorePick: { winner: "DET", lions: 38, opp: 24 } },
  { userId: "uncle", week: 3, submittedAtUTC: at(3, "2026-09-27T15:45:00Z"), answers: { "w3-ml": "DET" }, scorePick: { winner: "DET", lions: 44, opp: 13 } },
  { userId: "chops", week: 3, submittedAtUTC: at(3, "2026-09-27T13:12:00Z"), answers: { "w3-ml": "DET" }, scorePick: { winner: "DET", lions: 27, opp: 13 } },
  { userId: "eddie", week: 3, submittedAtUTC: at(3, "2026-09-27T16:20:00Z"), answers: { "w3-ml": "DET" }, scorePick: { winner: "DET", lions: 31, opp: 17 } },
  { userId: "tina", week: 3, submittedAtUTC: at(3, "2026-09-25T19:02:00Z"), answers: { "w3-ml": "DET" }, scorePick: { winner: "DET", lions: 34, opp: 14 } },
  { userId: "bigcat", week: 3, submittedAtUTC: at(3, "2026-09-27T16:40:00Z"), answers: { "w3-ml": "DET" }, scorePick: { winner: "DET", lions: 35, opp: 20 } },
  { userId: "denny", week: 3, submittedAtUTC: at(3, "2026-09-27T12:00:00Z"), answers: { "w3-ml": "DET" }, scorePick: { winner: "DET", lions: 31, opp: 21 } },
  { userId: "muscle", week: 3, submittedAtUTC: at(3, "2026-09-27T14:55:00Z"), answers: { "w3-ml": "DET" }, scorePick: { winner: "DET", lions: 27, opp: 6 } },
  { userId: "machine", week: 3, submittedAtUTC: at(3, "2026-09-27T16:59:00Z"), answers: { "w3-ml": "NYJ" }, scorePick: { winner: "NYJ", lions: 17, opp: 20 } },
  { userId: "intern", week: 3, submittedAtUTC: at(3, "2026-09-27T10:30:00Z"), answers: { "w3-ml": "DET" }, scorePick: { winner: "DET", lions: 30, opp: 14 } },

  // ---- Week 4 (open — picks already in) ----
  { userId: "bigcat", week: 4, submittedAtUTC: at(4, "2026-09-30T20:15:00Z"), answers: { "w4-ou": "over" }, scorePick: { winner: "DET", lions: 31, opp: 20 } },
  { userId: "tina", week: 4, submittedAtUTC: at(4, "2026-09-30T13:41:00Z"), answers: { "w4-ou": "under" }, scorePick: { winner: "DET", lions: 27, opp: 17 } },
  { userId: "denny", week: 4, submittedAtUTC: at(4, "2026-10-01T02:22:00Z"), answers: { "w4-ou": "under" }, scorePick: { winner: "DET", lions: 30, opp: 13 } },
  { userId: "machine", week: 4, submittedAtUTC: at(4, "2026-10-01T11:05:00Z"), answers: { "w4-ou": "over" }, scorePick: { winner: "CAR", lions: 23, opp: 24 } },
  { userId: "gary", week: 4, submittedAtUTC: at(4, "2026-09-30T22:47:00Z"), answers: { "w4-ou": "over" }, scorePick: { winner: "DET", lions: 34, opp: 24 } },
  { userId: "chops", week: 4, submittedAtUTC: at(4, "2026-10-01T00:31:00Z"), answers: { "w4-ou": "under" }, scorePick: { winner: "DET", lions: 23, opp: 20 } },
];

export function submissionsForWeek(week: number): Submission[] {
  return SUBMISSIONS.filter((s) => s.week === week);
}

export function resultsForWeek(week: number): WeekResults | undefined {
  return RESULTS.find((r) => r.week === week);
}
