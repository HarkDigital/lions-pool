import { describe, expect, it } from "vitest";
import {
  REMINDER_LEAD_MS,
  dueContests,
  planReminders,
  renderReminder,
  unsubToken,
  verifyUnsubToken,
  type ReminderAccount,
} from "./reminders";
import type { Contest, Submission } from "./types";

// Week 4 of the real schedule: Lions at Panthers, Sun Oct 4, 8:20 PM EDT.
const LOCK = "2026-10-05T00:20Z";
const LOCK_MS = Date.parse(LOCK);
const HOUR = 3_600_000;

function contest(overrides: Partial<Contest> = {}): Contest {
  return {
    week: 4,
    title: "Lions at Panthers",
    hasLionsGame: true,
    lockAtUTC: LOCK,
    questions: [
      {
        id: "w4-q1",
        kind: "moneyline",
        options: [
          { team: "DET", points: 5 },
          { team: "CAR", points: 9 },
        ],
      },
    ],
    scoreBonuses: true,
    status: "open",
    ...overrides,
  };
}

const acct = (id: string, extra: Partial<ReminderAccount> = {}): ReminderAccount => ({
  id,
  email: `${id}@example.com`,
  nickname: id.toUpperCase(),
  ...extra,
});

const pick = (userId: string, overrides: Partial<Submission> = {}): Submission => ({
  userId,
  week: 4,
  submittedAtUTC: "2026-10-01T12:00:00Z",
  answers: { "w4-q1": "DET" },
  scorePick: { winner: "DET", lions: 27, opp: 20 },
  ...overrides,
});

function plan(opts: {
  now?: number;
  contests?: Contest[];
  subs?: Submission[];
  accounts?: ReminderAccount[];
  optedIn?: string[];
  sent?: string[];
}) {
  const accounts = opts.accounts ?? [acct("a"), acct("b")];
  return planReminders({
    now: opts.now ?? LOCK_MS - 23 * HOUR,
    contests: opts.contests ?? [contest()],
    subs: opts.subs ?? [],
    accounts,
    optedIn: new Set(opts.optedIn ?? accounts.map((a) => a.id)),
    sent: new Set(opts.sent ?? []),
  }).map((p) => `${p.account.id}:${p.contest.week}`);
}

describe("dueContests: the 24-hour window", () => {
  it("opens exactly 24 hours before lock and closes at lock", () => {
    const c = [contest()];
    expect(dueContests(c, LOCK_MS - REMINDER_LEAD_MS - 1)).toHaveLength(0);
    expect(dueContests(c, LOCK_MS - REMINDER_LEAD_MS)).toHaveLength(1);
    expect(dueContests(c, LOCK_MS - 1)).toHaveLength(1);
    expect(dueContests(c, LOCK_MS)).toHaveLength(0);
  });

  it("never fires for a slate Mother Superior hasn't posted", () => {
    expect(dueContests([contest({ status: "draft" })], LOCK_MS - HOUR)).toHaveLength(0);
    expect(dueContests([contest({ questions: [] })], LOCK_MS - HOUR)).toHaveLength(0);
  });

  it("never fires for a locked or graded week", () => {
    expect(dueContests([contest({ status: "locked" })], LOCK_MS - HOUR)).toHaveLength(0);
    expect(dueContests([contest({ status: "graded" })], LOCK_MS - HOUR)).toHaveLength(0);
  });

  it("a slate posted late (2 hours out) is due at once", () => {
    expect(dueContests([contest()], LOCK_MS - 2 * HOUR)).toHaveLength(1);
  });
});

describe("planReminders: who gets one", () => {
  it("everyone opted in with no pick", () => {
    expect(plan({})).toEqual(["a:4", "b:4"]);
  });

  it("skips anyone who didn't opt in", () => {
    expect(plan({ optedIn: ["b"] })).toEqual(["b:4"]);
  });

  it("skips anyone whose pick is already in", () => {
    expect(plan({ subs: [pick("a")] })).toEqual(["b:4"]);
  });

  it("a pick for a different week doesn't count", () => {
    expect(plan({ subs: [pick("a", { week: 3 })] })).toEqual(["a:4", "b:4"]);
  });

  it("a blank 0-0 is no pick at all, so the reminder still goes", () => {
    const blank = pick("a", { answers: {}, scorePick: { winner: "TIE", lions: 0, opp: 0 } });
    expect(plan({ subs: [blank] })).toEqual(["a:4", "b:4"]);
  });

  it("never sends the same week twice", () => {
    expect(plan({ sent: ["a:4"] })).toEqual(["b:4"]);
  });

  it("never emails an offline placeholder account", () => {
    const accounts = [acct("a"), acct("x", { email: "sean@offline.thelionspool.com" })];
    expect(plan({ accounts })).toEqual(["a:4"]);
  });

  it("skips an account with no email", () => {
    expect(plan({ accounts: [acct("a", { email: "" })] })).toEqual([]);
  });

  it("shared entry: a pick under either account covers both", () => {
    const accounts = [acct("a"), acct("b", { entryOf: "a" }), acct("c")];
    expect(plan({ accounts, subs: [pick("a")] })).toEqual(["c:4"]);
    expect(plan({ accounts, subs: [pick("b")] })).toEqual(["c:4"]);
  });

  it("a link to a missing account is ignored, not trusted", () => {
    const accounts = [acct("a"), acct("b", { entryOf: "ghost" })];
    expect(plan({ accounts, subs: [pick("ghost")] })).toEqual(["a:4", "b:4"]);
  });

  it("nothing outside the window", () => {
    expect(plan({ now: LOCK_MS - 25 * HOUR })).toEqual([]);
    expect(plan({ now: LOCK_MS + HOUR })).toEqual([]);
  });
});

describe("unsubscribe tokens", () => {
  it("verifies its own token and rejects another account's", () => {
    const t = unsubToken("user_a", "s3cret");
    expect(verifyUnsubToken("user_a", t, "s3cret")).toBe(true);
    expect(verifyUnsubToken("user_b", t, "s3cret")).toBe(false);
    expect(verifyUnsubToken("user_a", t, "other")).toBe(false);
    expect(verifyUnsubToken("user_a", "short", "s3cret")).toBe(false);
  });
});

describe("renderReminder", () => {
  const email = renderReminder({
    contest: contest(),
    nickname: "Lil <Coke>",
    now: LOCK_MS - 24 * HOUR,
    unsubscribeUrl: "https://thelionspool.com/unsubscribe/?u=user_a&t=abc",
  });

  it("names the week, the lock, and the matchup", () => {
    expect(email.subject).toBe("Week 4 picks lock Sunday at 8:20 PM EDT: Lions @ Panthers");
    expect(email.text).toContain("Week 4 · Picks lock in 24 hours");
    expect(email.text).toContain("Mother Superior's slate is posted. Picks lock at kickoff.\n");
    expect(email.html).toContain("Bank of America Stadium, Charlotte, NC");
  });

  it("escapes the nickname", () => {
    expect(email.html).toContain("Lil &lt;Coke&gt;");
    expect(email.html).not.toContain("<Coke>");
  });

  it("carries the unsubscribe link in both parts", () => {
    expect(email.html).toContain("https://thelionspool.com/unsubscribe/?u=user_a&amp;t=abc");
    expect(email.text).toContain("https://thelionspool.com/unsubscribe/?u=user_a&t=abc");
  });

  it("follows the house style: no em or en dashes, no pronouns for Mother Superior", () => {
    for (const part of [email.subject, email.html, email.text]) {
      expect(part).not.toMatch(/[–—]/);
      expect(part).not.toMatch(/\b(she|her|herself)\b/i);
    }
  });

  it("a late slate says how many hours are actually left", () => {
    const late = renderReminder({
      contest: contest(),
      nickname: "",
      now: LOCK_MS - 90 * 60_000,
      unsubscribeUrl: "u",
    });
    expect(late.text).toContain("Picks lock in 2 hours");
    expect(late.text).toContain("You're not in yet\n");
  });

  it("a lock earlier than kickoff says when, not 'at kickoff'", () => {
    const early = renderReminder({
      contest: contest({ lockAtUTC: "2026-10-04T17:00Z" }),
      nickname: "",
      now: Date.parse("2026-10-04T12:00Z"),
      unsubscribeUrl: "u",
    });
    expect(early.text).toContain("Picks lock Sun, Oct 4 · 1:00 PM EDT");
  });

  it("a week without a Lions game uses the slate's own title", () => {
    const bye = renderReminder({
      contest: contest({ week: 6, hasLionsGame: false, title: "Bye Week Pick'em" }),
      nickname: "",
      now: LOCK_MS - HOUR,
      unsubscribeUrl: "u",
    });
    expect(bye.subject).toContain(": Bye Week Pick'em");
  });
});
