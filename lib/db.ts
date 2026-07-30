import "server-only";

// Server-only MariaDB access for the live pool. NEVER imported by client code
// (the client talks to /api/* instead). Complex objects live in JSON columns;
// we stringify on write and parse on read.

import mysql from "mysql2/promise";
import type { Contest, PaymentRecord, Submission, WeekResults } from "./types";
import { DEFAULT_BONUS_VALUES, type BonusValues } from "./scoring";

let pool: mysql.Pool | null = null;

function db(): mysql.Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
    pool = mysql.createPool({
      uri: process.env.DATABASE_URL,
      connectionLimit: 5,
      waitForConnections: true,
      namedPlaceholders: true,
    });
  }
  return pool;
}

const parse = <T>(v: unknown): T => (typeof v === "string" ? (JSON.parse(v) as T) : (v as T));

export async function dbPing(): Promise<boolean> {
  const [rows] = await db().query("SELECT 1 AS ok");
  return Array.isArray(rows) && (rows[0] as { ok: number }).ok === 1;
}

// --- Submissions ------------------------------------------------------------

export async function dbGetSubmissions(): Promise<Submission[]> {
  const [rows] = await db().query(
    "SELECT user_id, week, submitted_at, answers, score_pick FROM submissions",
  );
  return (rows as Record<string, unknown>[]).map((r) => ({
    userId: r.user_id as string,
    week: r.week as number,
    submittedAtUTC: r.submitted_at as string,
    answers: parse(r.answers),
    ...(r.score_pick != null ? { scorePick: parse(r.score_pick) } : {}),
  })) as Submission[];
}

export async function dbSaveSubmission(sub: Submission): Promise<void> {
  await db().query(
    `INSERT INTO submissions (user_id, week, submitted_at, answers, score_pick)
     VALUES (:u, :w, :at, :answers, :score)
     ON DUPLICATE KEY UPDATE submitted_at = :at, answers = :answers, score_pick = :score`,
    {
      u: sub.userId,
      w: sub.week,
      at: sub.submittedAtUTC,
      answers: JSON.stringify(sub.answers),
      score: sub.scorePick ? JSON.stringify(sub.scorePick) : null,
    },
  );
}

// --- Results ----------------------------------------------------------------

export async function dbGetResults(): Promise<WeekResults[]> {
  const [rows] = await db().query("SELECT week, lions_score, opp_score, values_json FROM results");
  return (rows as Record<string, unknown>[]).map((r) => ({
    week: r.week as number,
    lionsScore: (r.lions_score as number | null) ?? undefined,
    oppScore: (r.opp_score as number | null) ?? undefined,
    values: parse(r.values_json),
  })) as WeekResults[];
}

export async function dbSaveResults(r: WeekResults): Promise<void> {
  await db().query(
    `INSERT INTO results (week, lions_score, opp_score, values_json)
     VALUES (:w, :l, :o, :v)
     ON DUPLICATE KEY UPDATE lions_score = :l, opp_score = :o, values_json = :v`,
    {
      w: r.week,
      l: r.lionsScore ?? null,
      o: r.oppScore ?? null,
      v: JSON.stringify(r.values ?? {}),
    },
  );
}

// --- Contests ---------------------------------------------------------------

export async function dbGetContests(): Promise<Contest[]> {
  const [rows] = await db().query("SELECT week, data FROM contests");
  return (rows as Record<string, unknown>[]).map((r) => parse<Contest>(r.data));
}

export async function dbSaveContest(c: Contest): Promise<void> {
  await db().query(
    `INSERT INTO contests (week, data) VALUES (:w, :d)
     ON DUPLICATE KEY UPDATE data = :d`,
    { w: c.week, d: JSON.stringify(c) },
  );
}

// --- Payments ---------------------------------------------------------------

export async function dbGetPayments(): Promise<PaymentRecord[]> {
  const [rows] = await db().query("SELECT user_id, paid, marked_at, note FROM payments");
  return (rows as Record<string, unknown>[]).map((r) => ({
    userId: r.user_id as string,
    paid: !!r.paid,
    ...(r.marked_at ? { markedAtUTC: r.marked_at as string } : {}),
    ...(r.note ? { note: r.note as string } : {}),
  }));
}

export async function dbSavePayment(p: PaymentRecord): Promise<void> {
  await db().query(
    `INSERT INTO payments (user_id, paid, marked_at, note) VALUES (:u, :paid, :at, :note)
     ON DUPLICATE KEY UPDATE paid = :paid, marked_at = :at, note = :note`,
    { u: p.userId, paid: p.paid ? 1 : 0, at: p.markedAtUTC ?? null, note: p.note ?? null },
  );
}

// --- Settings (bonus values) ------------------------------------------------

export async function dbGetBonus(): Promise<BonusValues> {
  const [rows] = await db().query("SELECT value FROM settings WHERE name = 'bonus'");
  const arr = rows as Record<string, unknown>[];
  return arr.length ? { ...DEFAULT_BONUS_VALUES, ...parse<BonusValues>(arr[0].value) } : DEFAULT_BONUS_VALUES;
}

export async function dbSaveBonus(v: BonusValues): Promise<void> {
  await db().query(
    `INSERT INTO settings (name, value) VALUES ('bonus', :v)
     ON DUPLICATE KEY UPDATE value = :v`,
    { v: JSON.stringify(v) },
  );
}

// --- Mother Superior's house line -------------------------------------------

export async function dbGetMotherPicks(): Promise<Submission[]> {
  const [rows] = await db().query("SELECT data FROM mother_picks");
  return (rows as Record<string, unknown>[]).map((r) => parse<Submission>(r.data));
}

export async function dbSaveMotherPick(sub: Submission): Promise<void> {
  await db().query(
    `INSERT INTO mother_picks (week, data) VALUES (:w, :d)
     ON DUPLICATE KEY UPDATE data = :d`,
    { w: sub.week, d: JSON.stringify(sub) },
  );
}
