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

// --- Pick reminders ---------------------------------------------------------
// Two small tables, created on first use (the app's DB user owns the schema):
// each account's opt-in choice (no row = never asked), and one row per
// (account, week) reminder, which is what keeps a week from sending twice.

let reminderTables: Promise<void> | null = null;

function ensureReminderTables(): Promise<void> {
  reminderTables ??= (async () => {
    await db().query(
      `CREATE TABLE IF NOT EXISTS email_prefs (
         user_id VARCHAR(191) NOT NULL PRIMARY KEY,
         reminders TINYINT(1) NOT NULL,
         updated_at VARCHAR(40) NOT NULL
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    );
    await db().query(
      `CREATE TABLE IF NOT EXISTS reminder_log (
         user_id VARCHAR(191) NOT NULL,
         week INT NOT NULL,
         sent_at VARCHAR(40) NOT NULL,
         PRIMARY KEY (user_id, week)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    );
  })().catch((e) => {
    reminderTables = null; // retry on the next call rather than latch a failure
    throw e;
  });
  return reminderTables;
}

/** true = opted in, false = opted out, null = never asked. */
export async function dbGetReminderPref(userId: string): Promise<boolean | null> {
  await ensureReminderTables();
  const [rows] = await db().query("SELECT reminders FROM email_prefs WHERE user_id = :u", {
    u: userId,
  });
  const arr = rows as Record<string, unknown>[];
  return arr.length ? !!arr[0].reminders : null;
}

export async function dbSetReminderPref(userId: string, on: boolean): Promise<void> {
  await ensureReminderTables();
  await db().query(
    `INSERT INTO email_prefs (user_id, reminders, updated_at) VALUES (:u, :on, :at)
     ON DUPLICATE KEY UPDATE reminders = :on, updated_at = :at`,
    { u: userId, on: on ? 1 : 0, at: new Date().toISOString() },
  );
}

export async function dbGetReminderOptIns(): Promise<string[]> {
  await ensureReminderTables();
  const [rows] = await db().query("SELECT user_id FROM email_prefs WHERE reminders = 1");
  return (rows as Record<string, unknown>[]).map((r) => r.user_id as string);
}

/** `${userId}:${week}` for every reminder already sent. */
export async function dbGetRemindersSent(): Promise<Set<string>> {
  await ensureReminderTables();
  const [rows] = await db().query("SELECT user_id, week FROM reminder_log");
  return new Set((rows as Record<string, unknown>[]).map((r) => `${r.user_id}:${r.week}`));
}

/** Reserve one (account, week) reminder. False if it was already taken, so
 * two overlapping runs can never both send it. */
export async function dbClaimReminder(userId: string, week: number): Promise<boolean> {
  await ensureReminderTables();
  const [res] = await db().query(
    "INSERT IGNORE INTO reminder_log (user_id, week, sent_at) VALUES (:u, :w, :at)",
    { u: userId, w: week, at: new Date().toISOString() },
  );
  return (res as mysql.ResultSetHeader).affectedRows === 1;
}

/** Give a claim back after a failed send, so the next run retries it. */
export async function dbReleaseReminder(userId: string, week: number): Promise<void> {
  await db().query("DELETE FROM reminder_log WHERE user_id = :u AND week = :w", {
    u: userId,
    w: week,
  });
}
