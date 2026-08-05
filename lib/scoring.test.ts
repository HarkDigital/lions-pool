// ---------------------------------------------------------------------------
// Adversarial tests for the grading engine. Every expectation here is
// hand-computed from the pool's ACTUAL rules (rules.md + 2025 Pool.md) —
// not from what scoring.ts happens to output. If the engine and the rules
// ever disagree, the rules win and the test stays red.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import {
  BONUS,
  computeStandings,
  gradeScoreBonuses,
  gradeWeek,
  rankProgression,
  type SeasonInput,
} from "./scoring";
import { playerSubmissions } from "./store";
import { TIE } from "./types";
import type {
  Contest,
  MoneylineQ,
  OverUnderQ,
  PickemQ,
  PropQ,
  Question,
  ScorePick,
  SpreadQ,
  Submission,
  UserWeekGrade,
  WeekResults,
} from "./types";
import { CONTESTS, PLAYERS, RESULTS, SUBMISSIONS } from "./demo-data";

// --- Tiny builders ----------------------------------------------------------

function makeContest(questions: Question[], overrides: Partial<Contest> = {}): Contest {
  return {
    week: 90,
    title: "Test slate",
    hasLionsGame: true,
    lockAtUTC: "2026-10-04T17:00Z",
    questions,
    scoreBonuses: false,
    status: "graded",
    ...overrides,
  };
}

function makeResults(
  lions: number | null,
  opp: number | null,
  values: WeekResults["values"] = {},
): WeekResults {
  return {
    week: 90,
    ...(lions != null ? { lionsScore: lions } : {}),
    ...(opp != null ? { oppScore: opp } : {}),
    values,
  };
}

function makeSub(
  userId: string,
  answers: Submission["answers"],
  scorePick?: ScorePick,
): Submission {
  return {
    userId,
    week: 90,
    submittedAtUTC: "2026-10-01T12:00:00Z",
    answers,
    ...(scorePick ? { scorePick } : {}),
  };
}

function gradeOne(contest: Contest, results: WeekResults, sub: Submission): UserWeekGrade {
  return gradeWeek(contest, results, [sub])[0];
}

function totalsByUser(grades: UserWeekGrade[]): Record<string, number> {
  return Object.fromEntries(grades.map((g) => [g.userId, g.total]));
}

function demoWeek(week: number): SeasonInput {
  const contest = CONTESTS.find((c) => c.week === week);
  const results = RESULTS.find((r) => r.week === week);
  if (!contest || !results) throw new Error(`demo data missing week ${week}`);
  return { contest, results, subs: SUBMISSIONS.filter((s) => s.week === week) };
}

// --- Bonus constants match the published rules ------------------------------

describe("bonus constants", () => {
  it("match the BONUS BREAKDOWN in rules.md exactly", () => {
    expect(BONUS).toEqual({ CLOSEST: 5, EXACTO: 8, PERFECTO: 20, KISS_OF_DEATH: -20 });
  });
});

// --- Moneyline --------------------------------------------------------------

const ML: MoneylineQ = {
  id: "ml",
  kind: "moneyline",
  options: [
    { team: "DET", points: 4.5 },
    { team: "NO", points: 16 },
  ],
};

describe("moneyline", () => {
  const contest = makeContest([ML]);

  it("pays the favorite its own (small) number, graded from the final score alone", () => {
    // No per-question value entered — the winner must come from 34-17.
    const g = gradeOne(contest, makeResults(34, 17), makeSub("a", { ml: "DET" }));
    expect(g.total).toBe(4.5);
    expect(g.items).toHaveLength(1);
    expect(g.items[0].kind).toBe("question");
    expect(g.items[0].label).toBe("Lions to win: hit");
  });

  it("wrong side gets ZERO POINTS — never negative", () => {
    const g = gradeOne(contest, makeResults(34, 17), makeSub("a", { ml: "NO" }));
    expect(g.total).toBe(0);
    expect(g.items).toHaveLength(1); // graded, just worth nothing
  });

  it("asymmetric payout: the longshot side pays its own bigger number when it hits", () => {
    // Saints steal one, 20–17.
    const g = gradeOne(contest, makeResults(17, 20), makeSub("a", { ml: "NO" }));
    expect(g.total).toBe(16);
  });

  it("the chalk pick scores nothing when the longshot lands", () => {
    const g = gradeOne(contest, makeResults(17, 20), makeSub("a", { ml: "DET" }));
    expect(g.total).toBe(0);
  });
});

// --- Spread -----------------------------------------------------------------

describe("spread", () => {
  const DET_FAV: SpreadQ = {
    id: "sp",
    kind: "spread",
    favorite: "DET",
    dog: "CHI",
    line: 10.5,
    favoritePoints: 13,
    dogPoints: 6,
  };
  const detFav = makeContest([DET_FAV]);

  it("DET as favorite covers: margin 14 beats the 10.5 line", () => {
    const g = gradeOne(detFav, makeResults(31, 17), makeSub("a", { sp: "DET" }));
    expect(g.total).toBe(13);
  });

  it("favorite wins but does not cover: dog +line cashes for dogPoints", () => {
    // DET 24–20: wins by 4, needed 11.
    expect(gradeOne(detFav, makeResults(24, 20), makeSub("a", { sp: "CHI" })).total).toBe(6);
    expect(gradeOne(detFav, makeResults(24, 20), makeSub("b", { sp: "DET" })).total).toBe(0);
  });

  it("dog outright win also cashes the dog side", () => {
    const g = gradeOne(detFav, makeResults(17, 20), makeSub("a", { sp: "CHI" }));
    expect(g.total).toBe(6);
  });

  it("landing exactly on a whole-number line is a push: zero for BOTH sides", () => {
    const PUSH: SpreadQ = {
      id: "sp2",
      kind: "spread",
      favorite: "DET",
      dog: "GB",
      line: 7,
      favoritePoints: 10,
      dogPoints: 10,
    };
    const c = makeContest([PUSH]);
    const fav = gradeOne(c, makeResults(27, 20), makeSub("a", { sp2: "DET" }));
    const dog = gradeOne(c, makeResults(27, 20), makeSub("b", { sp2: "GB" }));
    expect(fav.total).toBe(0);
    expect(dog.total).toBe(0);
    expect(fav.items[0].label).toMatch(/Push/);
  });

  const DET_DOG: SpreadQ = {
    id: "sp3",
    kind: "spread",
    favorite: "BUF",
    dog: "DET",
    line: 2.5,
    favoritePoints: 8,
    dogPoints: 8,
  };
  const detDog = makeContest([DET_DOG]);

  it("DET as dog: favorite covers when the opponent wins by more than the line", () => {
    // BUF 30, DET 27 — margin 3 > 2.5.
    expect(gradeOne(detDog, makeResults(27, 30), makeSub("a", { sp3: "BUF" })).total).toBe(8);
    expect(gradeOne(detDog, makeResults(27, 30), makeSub("b", { sp3: "DET" })).total).toBe(0);
  });

  it("DET as dog covers in a loss when the margin stays inside the line", () => {
    // BUF 30, DET 28 — margin 2 < 2.5, Lions lose but cover.
    expect(gradeOne(detDog, makeResults(28, 30), makeSub("a", { sp3: "DET" })).total).toBe(8);
    expect(gradeOne(detDog, makeResults(28, 30), makeSub("b", { sp3: "BUF" })).total).toBe(0);
  });

  it("DET as dog wins outright: dog side cashes", () => {
    expect(gradeOne(detDog, makeResults(31, 24), makeSub("a", { sp3: "DET" })).total).toBe(8);
  });
});

// --- Derived spread ("Mother does the math" weeks) ---------------------------

describe("derived spread", () => {
  // 2025 Week 16 template: LIONS −13.5, no side declared — winner + score only.
  const DERIVED: SpreadQ = {
    id: "dsp",
    kind: "spread",
    favorite: "DET",
    dog: "NYG",
    line: 13.5,
    favoritePoints: 14,
    dogPoints: 12.5,
    derived: true,
  };
  const c = makeContest([DERIVED]);

  it("a blowout score pick lands on the favorite and cashes when the cover holds", () => {
    // DET 40–10 → margin 30 > 13.5 → favorite. Final 41–10: covered.
    const g = gradeOne(c, makeResults(41, 10), makeSub("a", {}, { winner: "DET", lions: 40, opp: 10 }));
    expect(g.total).toBe(14);
  });

  it("a tight score pick lands on the dog and cashes when the favorite misses the cover", () => {
    // DET 20–17 → margin 3 < 13.5 → dog +13.5. Final 20–17: no cover.
    const g = gradeOne(c, makeResults(20, 17), makeSub("a", {}, { winner: "DET", lions: 20, opp: 17 }));
    expect(g.total).toBe(12.5);
  });

  it("never trusts a stored side that contradicts the score", () => {
    // Stored answer says NYG +13.5, but the player's own score (DET 40–10)
    // puts them on the favorite. Final DET 20–17 (no cover): Mother's math
    // pays ZERO — the 12.5 dog points are impossible under the derived rules.
    const g = gradeOne(
      c,
      makeResults(20, 17),
      makeSub("a", { dsp: "NYG" }, { winner: "DET", lions: 40, opp: 10 }),
    );
    expect(g.total).toBe(0);
  });

  it("no score pick means the question simply is not graded", () => {
    const g = gradeOne(c, makeResults(20, 17), makeSub("a", { dsp: "NYG" }));
    expect(g.items).toHaveLength(0);
  });

  it("combo checks use the derived side too, not the stored answer", () => {
    const PROP2: PropQ = {
      id: "dpr",
      kind: "prop",
      question: "First touchdown scored by",
      options: [
        { key: "DET", label: "Lions" },
        { key: "NYG", label: "Giants" },
      ],
      points: 3,
    };
    const comboC = makeContest([DERIVED, PROP2], {
      comboBonus: { questionIds: ["dsp", "dpr"], allCorrectBonus: 5 },
    });
    // Score pick DET 40–10 → favorite; final 41–10 covers. Prop hits too.
    // Combo pays even though the stored spread answer says the dog:
    // 14 + 3 + 5 = 22.
    const g = gradeOne(
      comboC,
      makeResults(41, 10, { dpr: "DET" }),
      makeSub("a", { dsp: "NYG", dpr: "DET" }, { winner: "DET", lions: 40, opp: 10 }),
    );
    expect(g.total).toBe(22);
  });
});

// --- Over / Under -----------------------------------------------------------

describe("overUnder", () => {
  const TOTAL_OU: OverUnderQ = {
    id: "ou",
    kind: "overUnder",
    label: "combined score",
    line: 44.5,
    overPoints: 8,
    underPoints: 8,
    source: "total",
  };
  const totalC = makeContest([TOTAL_OU]);

  it("source=total: over hits when the combined score clears the line", () => {
    // 34 + 17 = 51 > 44.5
    expect(gradeOne(totalC, makeResults(34, 17), makeSub("a", { ou: "over" })).total).toBe(8);
    expect(gradeOne(totalC, makeResults(34, 17), makeSub("b", { ou: "under" })).total).toBe(0);
  });

  it("source=total: under hits when the combined score stays below", () => {
    // 20 + 17 = 37 < 44.5
    expect(gradeOne(totalC, makeResults(20, 17), makeSub("a", { ou: "under" })).total).toBe(8);
    expect(gradeOne(totalC, makeResults(20, 17), makeSub("b", { ou: "over" })).total).toBe(0);
  });

  const MARGIN_OU: OverUnderQ = {
    id: "mou",
    kind: "overUnder",
    label: "Lions margin of victory",
    line: 6.5,
    overPoints: 4,
    underPoints: 4,
    source: "lionsMargin",
  };
  const marginC = makeContest([MARGIN_OU]);

  it("source=lionsMargin: over/under against the winning margin", () => {
    // 30–20: margin 10 > 6.5
    expect(gradeOne(marginC, makeResults(30, 20), makeSub("a", { mou: "over" })).total).toBe(4);
    // 24–20: margin 4 < 6.5
    expect(gradeOne(marginC, makeResults(24, 20), makeSub("b", { mou: "under" })).total).toBe(4);
  });

  it("source=lionsMargin: a Lions LOSS is a negative margin, which is under", () => {
    // 17–21: margin −4 < 6.5
    expect(gradeOne(marginC, makeResults(17, 21), makeSub("a", { mou: "under" })).total).toBe(4);
    expect(gradeOne(marginC, makeResults(17, 21), makeSub("b", { mou: "over" })).total).toBe(0);
  });

  const STAT_OU: OverUnderQ = {
    id: "sou",
    kind: "overUnder",
    label: "Goff passing yards",
    line: 265.5,
    overPoints: 5,
    underPoints: 5,
    source: "stat",
  };
  const statC = makeContest([STAT_OU], { hasLionsGame: true });

  it("source=stat: graded from the admin-entered number, no game score needed", () => {
    expect(
      gradeOne(statC, makeResults(null, null, { sou: 289 }), makeSub("a", { sou: "over" })).total,
    ).toBe(5);
    expect(
      gradeOne(statC, makeResults(null, null, { sou: 240 }), makeSub("b", { sou: "under" })).total,
    ).toBe(5);
    expect(
      gradeOne(statC, makeResults(null, null, { sou: 240 }), makeSub("c", { sou: "over" })).total,
    ).toBe(0);
  });

  const MONEY_OU: OverUnderQ = {
    id: "xou",
    kind: "overUnder",
    label: "combined score in Munich",
    line: 47,
    overPoints: 10.5,
    underPoints: 10.5,
    source: "total",
  };
  const moneyC = makeContest([MONEY_OU]);

  it("landing exactly on a whole-number line pays ZERO to an over pick (and to under)", () => {
    // 47 is not over 47 and not under 47. Exact score calls cash through the
    // score bonuses, never through the O/U itself.
    expect(gradeOne(moneyC, makeResults(27, 20), makeSub("a", { xou: "over" })).total).toBe(0);
    expect(gradeOne(moneyC, makeResults(27, 20), makeSub("b", { xou: "under" })).total).toBe(0);
  });

  it("a legacy 'exact' answer grades as no answer, not a crash", () => {
    expect(gradeOne(moneyC, makeResults(28, 20), makeSub("a", { xou: "exact" })).total).toBe(0);
    expect(gradeOne(moneyC, makeResults(28, 20), makeSub("b", { xou: "over" })).total).toBe(10.5);
  });
});

// --- Prop -------------------------------------------------------------------

describe("prop", () => {
  const PROP: PropQ = {
    id: "pr",
    kind: "prop",
    question: "More passing yards",
    options: [
      { key: "goff", label: "Goff" },
      { key: "mayfield", label: "Mayfield" },
    ],
    points: 5,
  };
  const c = makeContest([PROP]);
  const r = makeResults(null, null, { pr: "goff" });

  it("hit pays the question's points", () => {
    expect(gradeOne(c, r, makeSub("a", { pr: "goff" })).total).toBe(5);
  });

  it("miss pays zero", () => {
    expect(gradeOne(c, r, makeSub("a", { pr: "mayfield" })).total).toBe(0);
  });
});

// --- Pick'em ----------------------------------------------------------------

describe("pickem", () => {
  const PICKEM: PickemQ = {
    id: "pk",
    kind: "pickem",
    games: [
      { id: "g1", away: "CHI", home: "ATL" },
      { id: "g2", away: "BAL", home: "CLE" },
      { id: "g3", away: "LAC", home: "KC" },
      { id: "g4", away: "DAL", home: "GB" },
      { id: "g5", away: "WSH", home: "SF" },
    ],
    pointsPerCorrect: 4,
    allCorrectTotal: 25,
    allWrongTotal: 30,
  };
  const c = makeContest([PICKEM], { hasLionsGame: false });
  const WINNERS = { g1: "ATL", g2: "BAL", g3: "KC", g4: "GB", g5: "SF" };
  const r = makeResults(null, null, { pk: WINNERS });

  it("partial credit: 3 of 5 correct pays 3 × 4 = 12", () => {
    const g = gradeOne(
      c,
      r,
      makeSub("a", { pk: { g1: "ATL", g2: "BAL", g3: "KC", g4: "DAL", g5: "WSH" } }),
    );
    expect(g.total).toBe(12);
  });

  it("4 of 5 is just 16 — the 25 bump is for running the table only", () => {
    const g = gradeOne(
      c,
      r,
      makeSub("a", { pk: { g1: "ATL", g2: "BAL", g3: "KC", g4: "GB", g5: "WSH" } }),
    );
    expect(g.total).toBe(16);
  });

  it("all 5 correct: allCorrectTotal REPLACES the 20-point sum with 25", () => {
    const g = gradeOne(c, r, makeSub("a", { pk: { ...WINNERS } }));
    expect(g.total).toBe(25);
    expect(g.items).toHaveLength(1);
    expect(g.items[0].label).toBe("Ran the table: 5/5 correct");
  });

  it("all 5 wrong: allWrongTotal REPLACES the zero with 30 — incompetence at scale", () => {
    const g = gradeOne(
      c,
      r,
      makeSub("a", { pk: { g1: "CHI", g2: "CLE", g3: "LAC", g4: "DAL", g5: "WSH" } }),
    );
    expect(g.total).toBe(30);
    expect(g.items[0].label).toBe("Perfectly wrong: 0/5. Mother Superior pays out for the sweep");
  });

  it("games missing a result are simply not graded — no credit, no penalty", () => {
    // Only g1–g4 are final; player went 2-for-4 on those, g5 is ignored.
    const partial = makeResults(null, null, { pk: { g1: "ATL", g2: "BAL", g3: "KC", g4: "GB" } });
    const g = gradeOne(
      c,
      partial,
      makeSub("a", { pk: { g1: "ATL", g2: "BAL", g3: "LAC", g4: "DAL", g5: "SF" } }),
    );
    expect(g.total).toBe(8);
  });

  it("one graded game right pays 4 — never the 25-point table-run total", () => {
    const oneFinal = makeResults(null, null, { pk: { g1: "ATL" } });
    const g = gradeOne(c, oneFinal, makeSub("a", { pk: { ...WINNERS } }));
    expect(g.total).toBe(4);
  });

  it("one graded game wrong pays 0 — never the 30-point perfectly-wrong total", () => {
    const oneFinal = makeResults(null, null, { pk: { g1: "ATL" } });
    const g = gradeOne(
      c,
      oneFinal,
      makeSub("a", { pk: { g1: "CHI", g2: "CLE", g3: "LAC", g4: "DAL", g5: "WSH" } }),
    );
    expect(g.total).toBe(0);
  });

  it("4-for-4 with one game not yet final pays 16 — the sweep waits for the full slate", () => {
    const partial = makeResults(null, null, { pk: { g1: "ATL", g2: "BAL", g3: "KC", g4: "GB" } });
    const g = gradeOne(c, partial, makeSub("a", { pk: { ...WINNERS } }));
    expect(g.total).toBe(16);
  });

  it("0-for-4 with one game not yet final pays 0 — the wrong-sweep waits too", () => {
    const partial = makeResults(null, null, { pk: { g1: "ATL", g2: "BAL", g3: "KC", g4: "GB" } });
    const g = gradeOne(
      c,
      partial,
      makeSub("a", { pk: { g1: "CHI", g2: "CLE", g3: "LAC", g4: "DAL", g5: "WSH" } }),
    );
    expect(g.total).toBe(0);
  });
});

// --- Combo bonus ------------------------------------------------------------

describe("combo bonus", () => {
  const combo = makeContest(
    [
      {
        id: "cml",
        kind: "moneyline",
        options: [
          { team: "DET", points: 5 },
          { team: "TB", points: 5 },
        ],
      },
      {
        id: "cqb",
        kind: "prop",
        question: "More passing yards",
        options: [
          { key: "goff", label: "Goff" },
          { key: "mayfield", label: "Mayfield" },
        ],
        points: 5,
      },
      {
        id: "crb",
        kind: "prop",
        question: "More rushing yards",
        options: [
          { key: "gibbs", label: "Gibbs" },
          { key: "irving", label: "Irving" },
        ],
        points: 5,
      },
      {
        id: "cwr",
        kind: "prop",
        question: "More receiving yards",
        options: [
          { key: "stbrown", label: "St. Brown" },
          { key: "evans", label: "Evans" },
        ],
        points: 5,
      },
    ],
    { comboBonus: { questionIds: ["cml", "cqb", "crb", "cwr"], allCorrectBonus: 5 } },
  );
  const r = makeResults(27, 20, { cqb: "goff", crb: "gibbs", cwr: "stbrown" });

  it("sweeping all four pays 4 × 5 plus the 5-point bonus = 25", () => {
    const g = gradeOne(
      combo,
      r,
      makeSub("a", { cml: "DET", cqb: "goff", crb: "gibbs", cwr: "stbrown" }),
    );
    expect(g.total).toBe(25);
    const bonus = g.items.find((i) => i.kind === "bonus");
    expect(bonus?.label).toBe("Swept all 4: combo bonus");
  });

  it("any single miss kills the combo: 3 of 4 is just 15", () => {
    const g = gradeOne(
      combo,
      r,
      makeSub("a", { cml: "DET", cqb: "goff", crb: "gibbs", cwr: "evans" }),
    );
    expect(g.total).toBe(15);
    expect(g.items.some((i) => i.kind === "bonus")).toBe(false);
  });
});

// --- Score bonuses (gradeScoreBonuses) --------------------------------------

describe("score bonuses", () => {
  const bonusC = makeContest([], { scoreBonuses: true });
  const pick = (userId: string, winner: string, lions: number, opp: number) =>
    makeSub(userId, {}, { winner, lions, opp });

  it("rules.md worked example: actual 32–7, one player 31–6, no exactos → +10 (5 per side)", () => {
    const map = gradeScoreBonuses(bonusC, makeResults(32, 7), [
      pick("closest", "DET", 31, 6),
      pick("mid", "DET", 24, 14),
      pick("far", "DET", 40, 21),
    ]);
    const items = map.get("closest") ?? [];
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.points === 5)).toBe(true);
    expect(items.reduce((t, i) => t + i.points, 0)).toBe(10);
    expect(map.get("mid")).toBeUndefined();
    expect(map.get("far")).toBeUndefined();
  });

  it("PERFECTO pays +20 as a single line — no exacto stacking on top", () => {
    const map = gradeScoreBonuses(bonusC, makeResults(32, 7), [pick("p", "DET", 32, 7)]);
    const items = map.get("p") ?? [];
    expect(items).toHaveLength(1);
    expect(items[0].points).toBe(20);
    expect(items[0].kind).toBe("bonus");
  });

  it("someone else's perfecto does NOT block another player's exacto — all correct picks cash", () => {
    const map = gradeScoreBonuses(bonusC, makeResults(32, 7), [
      pick("perf", "DET", 32, 7),
      pick("lionsSide", "DET", 32, 14),
      pick("oppSide", "DET", 21, 7),
      pick("nearMiss", "DET", 31, 6),
    ]);
    expect((map.get("perf") ?? []).reduce((t, i) => t + i.points, 0)).toBe(20);
    expect((map.get("lionsSide") ?? []).reduce((t, i) => t + i.points, 0)).toBe(8);
    expect((map.get("oppSide") ?? []).reduce((t, i) => t + i.points, 0)).toBe(8);
    // Both sides had an exact call, so closest-to pays nobody.
    expect(map.get("nearMiss")).toBeUndefined();
  });

  it("KISS OF DEATH: the exact reverse (winner wrong) costs −20 and stands alone", () => {
    const map = gradeScoreBonuses(bonusC, makeResults(34, 17), [
      pick("kiss", "NO", 17, 34),
      pick("fine", "DET", 34, 24), // exacto on the Lions side still cashes
      pick("near", "DET", 28, 16), // closest on the opponent side (off 1)
    ]);
    const kiss = map.get("kiss") ?? [];
    expect(kiss).toHaveLength(1);
    expect(kiss[0].points).toBe(-20);
    expect(kiss[0].kind).toBe("penalty");
    expect((map.get("fine") ?? []).reduce((t, i) => t + i.points, 0)).toBe(8);
    expect((map.get("near") ?? []).reduce((t, i) => t + i.points, 0)).toBe(5);
  });

  it("a kiss of death pick never wins closest-to and never blocks it — the kiss stands alone", () => {
    // Final 21–20. X's reversed 20–21 is off by 1 on BOTH sides, but the
    // kiss stands alone: X collects only the −20, and closest-to goes to
    // the legitimately-closest players (Z off 7 on the Lions, Y off 10 on
    // the opponent).
    const map = gradeScoreBonuses(bonusC, makeResults(21, 20), [
      pick("x", "CHI", 20, 21),
      pick("y", "DET", 35, 10),
      pick("z", "DET", 28, 3),
    ]);
    const x = map.get("x") ?? [];
    expect(x).toHaveLength(1);
    expect(x[0].points).toBe(-20);
    const y = map.get("y") ?? [];
    const z = map.get("z") ?? [];
    expect(y.map((i) => i.bonusType)).toEqual(["closest"]);
    expect(y[0].label).toMatch(/opponent/);
    expect(z.map((i) => i.bonusType)).toEqual(["closest"]);
    expect(z[0].label).toMatch(/Lions/);
  });

  it("a reversed-but-tied score is NOT a kiss of death — it is a perfecto", () => {
    // The reverse of 20–20 is 20–20. That is nailing the final score.
    const map = gradeScoreBonuses(bonusC, makeResults(20, 20), [pick("t", "DET", 20, 20)]);
    const items = map.get("t") ?? [];
    expect(items).toHaveLength(1);
    expect(items[0].points).toBe(20);
    expect(items.some((i) => i.points < 0)).toBe(false);
  });

  it("closest-to ties all cash, and each side is judged on its own", () => {
    // Actual 30–13. Both players are off by 2 on the Lions side (tie → both
    // +5); B alone is closest on the opponent side (off 4 vs 7).
    const map = gradeScoreBonuses(bonusC, makeResults(30, 13), [
      pick("a", "DET", 28, 20),
      pick("b", "DET", 32, 17),
    ]);
    expect((map.get("a") ?? []).reduce((t, i) => t + i.points, 0)).toBe(5);
    expect((map.get("b") ?? []).reduce((t, i) => t + i.points, 0)).toBe(10);
  });

  it("an exacto on one side blocks closest-to on THAT side only", () => {
    // Actual 32–7. A nails the Lions 32; nobody nails the 7, so the
    // opponent-side closest still pays out to B.
    const map = gradeScoreBonuses(bonusC, makeResults(32, 7), [
      pick("a", "DET", 32, 20),
      pick("b", "DET", 25, 9),
    ]);
    const aItems = map.get("a") ?? [];
    const bItems = map.get("b") ?? [];
    expect(aItems).toHaveLength(1);
    expect(aItems[0].points).toBe(8);
    expect(bItems).toHaveLength(1);
    expect(bItems[0].points).toBe(5);
    expect(bItems[0].label).toMatch(/opponent/);
  });

  it("picking the wrong team to win can still cash an exacto", () => {
    // Lions lose 27–30, but "w" said Lions win 27–24: Lions 27 was nailed.
    // (Second player takes the opponent-side closest so the exacto is isolated.)
    const map = gradeScoreBonuses(bonusC, makeResults(27, 30), [
      pick("w", "DET", 27, 24),
      pick("other", "CAR", 20, 29),
    ]);
    const items = map.get("w") ?? [];
    expect(items).toHaveLength(1);
    expect(items[0].points).toBe(8);
    expect(items[0].label).toMatch(/EXACTO/);
  });

  it("no bonuses at all when the contest does not take a score pick", () => {
    const off = makeContest([], { scoreBonuses: false });
    const map = gradeScoreBonuses(off, makeResults(32, 7), [pick("a", "DET", 32, 7)]);
    expect(map.size).toBe(0);
  });
});

// --- Tie picks (winner TIE, equal scores) ------------------------------------

describe("tie picks", () => {
  const contest = makeContest([ML], { scoreBonuses: true });

  it("a TIE score pick earns no moneyline points but still cashes an exacto", () => {
    // Final DET 34-17. The tie picker's 17-17 nails the opponent's 17; the
    // other player is closer on the Lions side, isolating the exacto.
    const grades = gradeWeek(contest, makeResults(34, 17), [
      makeSub("t", { ml: TIE }, { winner: TIE, lions: 17, opp: 17 }),
      makeSub("o", { ml: "DET" }, { winner: "DET", lions: 33, opp: 24 }),
    ]);
    const t = grades.find((g) => g.userId === "t")!;
    const o = grades.find((g) => g.userId === "o")!;
    // TIE is not a payable moneyline side: no question row, no points, no crash.
    expect(t.items.filter((i) => i.kind === "question")).toHaveLength(0);
    expect(t.items.map((i) => i.bonusType)).toEqual(["exacto"]);
    expect(t.total).toBe(BONUS.EXACTO);
    expect(o.items[0].label).toBe("Lions to win: hit");
  });

  it("a TIE score pick can win closest-to like anyone else", () => {
    // Final 23-20. The tie picker's 21-21 is closest on both sides.
    const map = gradeScoreBonuses(contest, makeResults(23, 20), [
      makeSub("t", {}, { winner: TIE, lions: 21, opp: 21 }),
      makeSub("o", {}, { winner: "DET", lions: 30, opp: 13 }),
    ]);
    const items = map.get("t") ?? [];
    expect(items.map((i) => i.bonusType)).toEqual(["closest", "closest"]);
    expect(items.reduce((s, i) => s + i.points, 0)).toBe(10);
  });

  it("a game that actually ends tied grades without crashing", () => {
    const grades = gradeWeek(contest, makeResults(20, 20), [
      makeSub("t", { ml: TIE }, { winner: TIE, lions: 20, opp: 20 }),
      makeSub("o", { ml: "DET" }, { winner: "DET", lions: 24, opp: 20 }),
    ]);
    const t = grades.find((g) => g.userId === "t")!;
    const o = grades.find((g) => g.userId === "o")!;
    // Nobody won, so the Lions moneyline is a miss worth zero.
    const oml = o.items.find((i) => i.kind === "question")!;
    expect(oml.points).toBe(0);
    expect(oml.label).toBe("Lions to win: miss");
    // Calling the tie on the nose is a perfecto like any other.
    expect(t.total).toBe(BONUS.PERFECTO);
  });
});

// --- Players only: Mother Superior doesn't pick, Mother Superior grades -------

describe("playerSubmissions", () => {
  const bonusC = makeContest([], { scoreBonuses: true });
  const pick = (userId: string, winner: string, lions: number, opp: number) =>
    makeSub(userId, {}, { winner, lions, opp });

  it("drops admin rows and keeps every player row", () => {
    const subs = [pick("mother", "DET", 34, 24), pick("bigcat", "DET", 32, 20)];
    expect(playerSubmissions(subs).map((s) => s.userId)).toEqual(["bigcat"]);
  });

  it("an admin scorePick can never suppress a real player's closest-to", () => {
    // Final 34–17. Mother's 34–24 would be a Lions-side exacto and would
    // suppress Closest-To for the field; filtered out, A's off-by-2 Lions
    // call and B's off-by-1 opponent call both cash +5, and no bonus is
    // ever awarded to "mother".
    const subs = playerSubmissions([
      pick("mother", "DET", 34, 24),
      pick("a", "DET", 32, 20),
      pick("b", "DET", 28, 16),
    ]);
    const map = gradeScoreBonuses(bonusC, makeResults(34, 17), subs);
    expect(map.has("mother")).toBe(false);
    expect((map.get("a") ?? []).map((i) => i.bonusType)).toEqual(["closest"]);
    expect((map.get("b") ?? []).map((i) => i.bonusType)).toEqual(["closest"]);
  });
});

// --- End-to-end gradeWeek on the baked demo weeks ---------------------------

describe("gradeWeek on demo data", () => {
  it("Week 1 (DET 34, NO 17): moneyline + exactos, hand-computed", () => {
    const { contest, results, subs } = demoWeek(1);
    expect(totalsByUser(gradeWeek(contest, results, subs))).toEqual({
      bigcat: 12.5, // 4.5 ML + 8 exacto (Lions 34)
      tina: 12.5, // 4.5 ML + 8 exacto (opp 17)
      denny: 12.5, // 4.5 ML + 8 exacto (opp 17)
      chops: 4.5,
      gary: 4.5,
      uncle: 4.5,
      intern: 0, // took the Saints
      muscle: 4.5,
      machine: 0, // took the Saints
      eddie: 4.5,
    });
  });

  it("Week 2 (BUF 30, DET 27): Tina's perfecto, Eddie's kiss of death, Muscle sat out", () => {
    const { contest, results, subs } = demoWeek(2);
    const grades = gradeWeek(contest, results, subs);
    // Polish Muscle never submitted for Week 2, so the engine grades 9 rows.
    expect(grades).toHaveLength(9);
    expect(grades.some((g) => g.userId === "muscle")).toBe(false);
    expect(totalsByUser(grades)).toEqual({
      tina: 28, // 8 spread + 20 perfecto (27-30)
      eddie: -20, // spread miss + exact reverse (30-27)
      denny: 16, // 8 spread + 8 exacto (Lions 27)
      bigcat: 8,
      machine: 8,
      gary: 0,
      chops: 8,
      uncle: 0,
      intern: 8,
    });
    const tina = grades.find((g) => g.userId === "tina");
    const eddie = grades.find((g) => g.userId === "eddie");
    const denny = grades.find((g) => g.userId === "denny");
    expect(tina?.items.some((i) => i.label === "PERFECTO: nailed the final score")).toBe(true);
    expect(
      eddie?.items.some((i) => i.label.startsWith("KISS OF DEATH") && i.points === -20),
    ).toBe(true);
    // Tina's perfecto must not rob Denny of his exacto.
    expect(denny?.items.some((i) => i.label === "EXACTO: called Lions 27 on the nose")).toBe(true);
  });

  it("Week 3 (DET 41, NYJ 10): no exactos, closest-to pays out — ties on both sides", () => {
    const { contest, results, subs } = demoWeek(3);
    const grades = gradeWeek(contest, results, subs);
    expect(totalsByUser(grades)).toEqual({
      gary: 8.5, // 3.5 ML + 5 closest Lions (38, off 3 — tied with uncle)
      uncle: 13.5, // 3.5 ML + 5 closest Lions (44) + 5 closest opp (13)
      chops: 8.5, // 3.5 ML + 5 closest opp (13, off 3 — tied with uncle)
      eddie: 3.5,
      tina: 3.5,
      bigcat: 3.5,
      denny: 3.5,
      muscle: 3.5,
      machine: 0, // took the Jets. The Jets.
      intern: 3.5,
    });
    const uncle = grades.find((g) => g.userId === "uncle");
    expect(uncle?.items.filter((i) => i.label.startsWith("CLOSEST"))).toHaveLength(2);
  });
});

// --- computeStandings on the actual demo season -----------------------------

describe("computeStandings on demo data", () => {
  // Graded weeks derived from status, never hardcoded elsewhere in the app;
  // here we additionally assert the demo clock's promise: exactly W1–W3.
  const gradedContests = CONTESTS.filter((c) => c.status === "graded");
  const weeks: SeasonInput[] = gradedContests.map((c) => demoWeek(c.week));
  const rows = computeStandings(
    PLAYERS.map((p) => p.id),
    weeks,
  );
  const row = (id: string) => rows.find((r) => r.userId === id)!;

  it("demo data has exactly weeks 1–3 graded, each with results on file", () => {
    expect(gradedContests.map((c) => c.week)).toEqual([1, 2, 3]);
    for (const c of gradedContests) {
      expect(RESULTS.some((r) => r.week === c.week)).toBe(true);
    }
  });

  it("season totals and ranks match the hand-computed board", () => {
    // W1 + W2 + W3, all computed by hand above.
    expect(rows.map((r) => [r.userId, r.rank, r.total])).toEqual([
      ["tina", 1, 44], // 12.5 + 28 + 3.5
      ["denny", 2, 32], // 12.5 + 16 + 3.5
      ["bigcat", 3, 24], // 12.5 + 8 + 3.5
      ["chops", 4, 21], // 4.5 + 8 + 8.5
      ["uncle", 5, 18], // 4.5 + 0 + 13.5
      ["gary", 6, 13], // 4.5 + 0 + 8.5
      ["intern", 7, 11.5], // 0 + 8 + 3.5
      ["machine", 8, 8], // 0 + 8 + 0
      ["muscle", 8, 8], // 4.5 + 3.5, no W2 pick (the Shame list remembers)
      ["eddie", 10, -12], // 4.5 − 20 + 3.5
    ]);
  });

  it("ties share a rank (standard competition ranking: two 8ths, no 9th)", () => {
    expect(row("machine").rank).toBe(8);
    expect(row("muscle").rank).toBe(8);
    expect(rows.some((r) => r.rank === 9)).toBe(false);
  });

  it("rank movement fields exist and reflect the through-week-2 board", () => {
    for (const r of rows) {
      expect(typeof r.rank).toBe("number");
      expect(r.prevRank).toBeDefined();
    }
    // Through W2: tina 40.5, denny 28.5, bigcat 20.5, chops 12.5,
    // intern 8 = machine 8, gary 4.5 = muscle 4.5 = uncle 4.5, eddie −15.5.
    expect(row("tina").prevRank).toBe(1);
    expect(row("uncle").prevRank).toBe(7); // climbed to 5th on double closest-to
    expect(row("intern").prevRank).toBe(5); // slid to 7th
    expect(row("eddie").prevRank).toBe(10);
  });

  it("weekly maps carry ONLY graded weeks the player actually entered", () => {
    for (const r of rows) {
      const expected = r.userId === "muscle" ? [1, 3] : [1, 2, 3];
      expect(Object.keys(r.weekly).map(Number).sort((a, b) => a - b)).toEqual(expected);
    }
    expect(row("tina").weekly).toEqual({ 1: 12.5, 2: 28, 3: 3.5 });
    expect(row("eddie").weekly).toEqual({ 1: 4.5, 2: -20, 3: 3.5 });
    // No Week 2 submission means no Week 2 entry at all — absent, not zero.
    expect(row("muscle").weekly).toEqual({ 1: 4.5, 3: 3.5 });
  });

  it("bonus tallies: Tina's perfecto leads, Eddie wears the kiss of death", () => {
    expect(row("tina").bonuses).toEqual({ closest: 0, exacto: 1, perfecto: 1, kod: 0 });
    expect(row("eddie").bonuses).toEqual({ closest: 0, exacto: 0, perfecto: 0, kod: 1 });
    expect(row("denny").bonuses).toEqual({ closest: 0, exacto: 2, perfecto: 0, kod: 0 });
    expect(row("bigcat").bonuses).toEqual({ closest: 0, exacto: 1, perfecto: 0, kod: 0 });
    expect(row("uncle").bonuses).toEqual({ closest: 2, exacto: 0, perfecto: 0, kod: 0 });
    expect(row("chops").bonuses).toEqual({ closest: 1, exacto: 0, perfecto: 0, kod: 0 });
    expect(row("gary").bonuses).toEqual({ closest: 1, exacto: 0, perfecto: 0, kod: 0 });
    expect(row("machine").bonuses).toEqual({ closest: 0, exacto: 0, perfecto: 0, kod: 0 });
    expect(row("muscle").bonuses).toEqual({ closest: 0, exacto: 0, perfecto: 0, kod: 0 });
    expect(row("intern").bonuses).toEqual({ closest: 0, exacto: 0, perfecto: 0, kod: 0 });
  });
});

// --- rankProgression on the actual demo season -------------------------------

describe("rankProgression on demo data", () => {
  const weeks: SeasonInput[] = CONTESTS.filter((c) => c.status === "graded").map((c) =>
    demoWeek(c.week),
  );
  const ids = PLAYERS.map((p) => p.id);
  const prog = rankProgression(ids, weeks);

  it("returns one column per graded week, in week order", () => {
    expect(prog.map((c) => c.week)).toEqual([1, 2, 3]);
  });

  it("every column carries all players and matches computeStandings on that prefix", () => {
    prog.forEach((col, i) => {
      const rows = computeStandings(ids, weeks.slice(0, i + 1));
      expect(Object.keys(col.ranks).sort()).toEqual([...ids].sort());
      for (const r of rows) {
        expect(col.ranks[r.userId].rank).toBe(r.rank);
        expect(col.ranks[r.userId].total).toBe(r.total);
        expect(col.ranks[r.userId].weekPts).toBe(r.weekly[col.week]);
      }
    });
  });

  it("week 1: the exacto crowd shares the lead at 12.5", () => {
    expect(prog[0].ranks["bigcat"].rank).toBe(1);
    expect(prog[0].ranks["tina"].rank).toBe(1);
    expect(prog[0].ranks["bigcat"].total).toBe(12.5);
    expect(prog[0].ranks["tina"].total).toBe(12.5);
  });

  it("the final column IS the full-season board", () => {
    const finalRows = computeStandings(ids, weeks);
    const last = prog[prog.length - 1];
    for (const r of finalRows) {
      expect(last.ranks[r.userId].rank).toBe(r.rank);
      expect(last.ranks[r.userId].total).toBe(r.total);
    }
    expect(last.ranks["tina"]).toEqual({ rank: 1, total: 44, weekPts: 3.5 });
  });

  it("a skipped week leaves weekPts undefined, not zero", () => {
    // Muscle ghosted Week 2: cumulative total holds at 4.5, no week points.
    expect(prog[1].ranks["muscle"].weekPts).toBeUndefined();
    expect(prog[1].ranks["muscle"].total).toBe(4.5);
  });
});

describe("configurable bonus values", () => {
  const contest: Contest = {
    week: 1,
    title: "t",
    hasLionsGame: true,
    lockAtUTC: "2026-09-13T17:00Z",
    questions: [],
    scoreBonuses: true,
    status: "graded",
  };
  const results: WeekResults = { week: 1, lionsScore: 30, oppScore: 20, values: {} };
  const custom = { closest: 3, exacto: 10, perfecto: 50, kod: -40 };

  it("pays custom exacto/perfecto/kod/closest through gradeWeek", () => {
    const subs: Submission[] = [
      makeSub("perf", {}, { winner: "DET", lions: 30, opp: 20 }),
      makeSub("ex", {}, { winner: "DET", lions: 30, opp: 13 }),
      makeSub("kiss", {}, { winner: "NO", lions: 20, opp: 30 }),
      makeSub("near", {}, { winner: "DET", lions: 27, opp: 21 }),
    ];
    const grades = new Map(gradeWeek(contest, results, subs, custom).map((g) => [g.userId, g]));
    expect(grades.get("perf")!.total).toBe(50);
    expect(grades.get("ex")!.total).toBe(10);
    expect(grades.get("kiss")!.total).toBe(-40);
    // near: opp 21 off by 1 is the closest opp score (nobody exact on 20 besides perfecto?
    // perfecto sets both exact flags, so no closest awards at all here.
    expect(grades.get("near")!.total).toBe(0);
  });

  it("defaults stay rules.md values when no override is passed", () => {
    const subs: Submission[] = [makeSub("perf", {}, { winner: "DET", lions: 30, opp: 20 })];
    expect(gradeWeek(contest, results, subs)[0].total).toBe(20);
  });

  it("threads through computeStandings and rankProgression", () => {
    const subs: Submission[] = [makeSub("perf", {}, { winner: "DET", lions: 30, opp: 20 })];
    const weeks = [{ contest, results, subs }];
    expect(computeStandings(["perf"], weeks, custom)[0].total).toBe(50);
    expect(rankProgression(["perf"], weeks, custom)[0].ranks["perf"].total).toBe(50);
  });
});
