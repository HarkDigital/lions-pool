// Pick-reminder emails: who gets one, and what it says. Pure (no database, no
// network) so the rules are testable; app/api/cron/reminders does the IO.
//
// The rule: an account that opted in gets ONE email per week, once the week's
// slate is posted (status "open") and its picks lock within 24 hours, unless
// the account's entry already has a real pick on file. A slate Mother Superior
// posts late, inside that window, goes out on the first cron tick after it's
// posted.

import { createHmac, timingSafeEqual } from "node:crypto";
import { fmtDateTime, fmtKickoff } from "./format";
import { gameForWeek } from "./schedule";
import { isBlankPick } from "./scoring";
import { teamInfo } from "./teams";
import type { Contest, Submission } from "./types";

export const REMINDER_LEAD_MS = 24 * 60 * 60 * 1000;

export const SITE_URL = "https://thelionspool.com";

/** Placeholder accounts for players who never touch the site (office entry). */
const OFFLINE_DOMAIN = "@offline.thelionspool.com";

/** One Clerk account, as much of it as a reminder needs. */
export interface ReminderAccount {
  id: string;
  email: string;
  /** Commissioner-assigned nickname, or the first name, or "". */
  nickname: string;
  /** publicMetadata.entryOf, raw: the second account on a shared entry. */
  entryOf?: unknown;
}

export interface PlannedReminder {
  contest: Contest;
  account: ReminderAccount;
}

// --- Who --------------------------------------------------------------------

/** Weeks whose slate is posted and whose picks lock within the next 24 hours. */
export function dueContests(contests: Contest[], now: number): Contest[] {
  return contests.filter((c) => {
    if (c.status !== "open" || c.questions.length === 0) return false;
    const lock = Date.parse(c.lockAtUTC);
    return now < lock && now >= lock - REMINDER_LEAD_MS;
  });
}

/**
 * Account id -> the entry it plays on. Same rule as the roster route: a link
 * counts only when it names a real, different account, one level only, so a
 * chain or a cycle dissolves into plain entries.
 */
export function entryIdsOf(accounts: { id: string; entryOf?: unknown }[]): Map<string, string> {
  const known = new Set(accounts.map((a) => a.id));
  const links = new Map<string, string>();
  for (const a of accounts) {
    const primary = typeof a.entryOf === "string" ? a.entryOf.trim() : "";
    if (primary && primary !== a.id && known.has(primary)) links.set(a.id, primary);
  }
  for (const [secondary, primary] of [...links]) if (links.has(primary)) links.delete(secondary);
  return new Map(accounts.map((a) => [a.id, links.get(a.id) ?? a.id]));
}

export function planReminders({
  now,
  contests,
  subs,
  accounts,
  optedIn,
  sent,
}: {
  now: number;
  contests: Contest[];
  subs: Submission[];
  accounts: ReminderAccount[];
  /** Account ids that said yes. */
  optedIn: Set<string>;
  /** `${userId}:${week}` for every reminder already sent. */
  sent: Set<string>;
}): PlannedReminder[] {
  const entryOf = entryIdsOf(accounts);
  const entry = (id: string) => entryOf.get(id) ?? id;
  const plan: PlannedReminder[] = [];
  for (const contest of dueContests(contests, now)) {
    // Entries with a real pick on file. A pick filed under either account on
    // a shared entry counts for both; a blank 0-0 is no pick at all.
    const picked = new Set(
      subs.filter((s) => s.week === contest.week && !isBlankPick(s)).map((s) => entry(s.userId)),
    );
    for (const account of accounts) {
      const email = account.email.trim().toLowerCase();
      if (!email || email.endsWith(OFFLINE_DOMAIN)) continue;
      if (!optedIn.has(account.id)) continue;
      if (picked.has(entry(account.id))) continue;
      if (sent.has(`${account.id}:${contest.week}`)) continue;
      plan.push({ contest, account });
    }
  }
  return plan;
}

// --- Unsubscribe links --------------------------------------------------------

export function unsubToken(userId: string, secret: string): string {
  return createHmac("sha256", secret).update(`unsub:${userId}`).digest("base64url");
}

export function verifyUnsubToken(userId: string, token: string, secret: string): boolean {
  const want = Buffer.from(unsubToken(userId, secret));
  const got = Buffer.from(token);
  return got.length === want.length && timingSafeEqual(got, want);
}

export function unsubUrl(userId: string, secret: string): string {
  const q = new URLSearchParams({ u: userId, t: unsubToken(userId, secret) });
  return `${SITE_URL}/unsubscribe/?${q}`;
}

// --- What -------------------------------------------------------------------

interface Matchup {
  /** "Lions @ Panthers", or the slate's own title on a week without a Lions game. */
  title: string;
  /** ["DET", "@", "CAR"] for the score-bug row; absent without a Lions game. */
  bug?: [string, string, string];
  when?: string;
  where?: string;
  kickoffUTC?: string;
}

function matchupFor(contest: Contest): Matchup {
  const game = contest.hasLionsGame ? gameForWeek(contest.week) : undefined;
  if (!game) return { title: contest.title };
  const opp = teamInfo(game.opponent);
  const [title, bug]: [string, [string, string, string]] = game.neutral
    ? [`Lions vs ${opp.short}`, ["DET", "vs", game.opponent]]
    : game.home
      ? [`${opp.short} @ Lions`, [game.opponent, "@", "DET"]]
      : [`Lions @ ${opp.short}`, ["DET", "@", game.opponent]];
  const where = [game.venue, game.city, game.country].filter(Boolean).join(", ");
  return {
    title,
    bug,
    when: fmtDateTime(game.dateUTC, game.timeTBD),
    where,
    kickoffUTC: game.timeTBD ? undefined : game.dateUTC,
  };
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const DISPLAY = "'Bebas Neue','Arial Narrow',Arial,sans-serif";
const BODY = "Barlow,'Helvetica Neue',Helvetica,Arial,sans-serif";

export interface ReminderEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderReminder({
  contest,
  nickname,
  now,
  unsubscribeUrl,
}: {
  contest: Contest;
  nickname: string;
  now: number;
  unsubscribeUrl: string;
}): ReminderEmail {
  const m = matchupFor(contest);
  const lock = contest.lockAtUTC;
  const lockMs = Date.parse(lock);
  const hours = Math.max(1, Math.round((lockMs - now) / 3_600_000));
  const hoursText = `${hours} ${hours === 1 ? "hour" : "hours"}`;
  const lockDay = new Date(lock).toLocaleDateString("en-US", {
    timeZone: "America/Detroit",
    weekday: "long",
  });
  const lockLine =
    m.kickoffUTC && Date.parse(m.kickoffUTC) === lockMs
      ? "Picks lock at kickoff"
      : `Picks lock ${fmtDateTime(lock)}`;
  const nick = nickname.trim();
  const headline = nick ? `You're not in yet, ${nick}` : "You're not in yet";
  const kicker = `Week ${contest.week} · Picks lock in ${hoursText}`;
  const subject = `Week ${contest.week} picks lock ${lockDay} at ${fmtKickoff(lock)}: ${m.title}`;
  const body = `Mother Superior's slate is posted. ${lockLine}.`;

  const text = [
    "THE LIONS POOL",
    "",
    kicker,
    headline,
    "",
    m.title,
    ...(m.when ? [m.when] : []),
    ...(m.where ? [m.where] : []),
    "",
    body,
    "",
    `Make your picks: ${SITE_URL}/`,
    "",
    "This Must Be The Pool",
    "You're getting this because you turned on pick reminders.",
    `Turn off reminders: ${unsubscribeUrl}`,
  ].join("\n");

  const bugRow = m.bug
    ? `<div style="font-family:${DISPLAY};font-size:32px;line-height:36px;color:#eef2f5;letter-spacing:.02em;">${esc(m.bug[0])}<span style="color:#78838d;font-size:26px;padding:0 16px;">${esc(m.bug[1])}</span>${esc(m.bug[2])}</div>`
    : `<div style="font-family:${DISPLAY};font-size:30px;line-height:34px;color:#eef2f5;text-transform:uppercase;letter-spacing:.02em;">${esc(m.title)}</div>`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@400;600;700&display=swap" rel="stylesheet">
<title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#070b11;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(`${lockLine}. Yours aren't in yet.`)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#070b11;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;font-family:${BODY};color:#b0b7bc;text-align:center;">
<tr><td style="font-family:${DISPLAY};font-size:28px;line-height:32px;color:#eef2f5;letter-spacing:.02em;">THE LIONS POOL</td></tr>
<tr><td align="center" style="padding:10px 0 24px;"><div style="width:48px;height:2px;background:#0076b6;line-height:2px;font-size:0;">&nbsp;</div></td></tr>
<tr><td style="font-size:11px;line-height:16px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:#38a8e8;">${esc(kicker)}</td></tr>
<tr><td style="padding-top:6px;font-family:${DISPLAY};font-size:42px;line-height:44px;color:#eef2f5;text-transform:uppercase;letter-spacing:.02em;">${esc(headline)}</td></tr>
<tr><td style="padding:22px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d141d;border:1px solid #1c2836;border-radius:12px;">
<tr><td style="padding:18px 16px;text-align:center;">
${bugRow}
${m.when ? `<div style="font-size:14px;line-height:20px;color:#b0b7bc;padding-top:6px;">${esc(m.when)}</div>` : ""}
${m.where ? `<div style="font-size:12px;line-height:18px;color:#78838d;">${esc(m.where)}</div>` : ""}
</td></tr></table>
</td></tr>
<tr><td style="font-size:15px;line-height:23px;color:#b0b7bc;padding:0 8px 24px;">${esc(body)}</td></tr>
<tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="background:#0076b6;border-radius:8px;"><a href="${SITE_URL}/" style="display:inline-block;padding:13px 30px;font-family:${BODY};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">Make your picks</a></td>
</tr></table>
</td></tr>
<tr><td style="padding-top:30px;"><div style="border-top:1px solid #1c2836;line-height:1px;font-size:0;">&nbsp;</div></td></tr>
<tr><td style="padding-top:14px;font-size:11px;line-height:17px;font-weight:600;letter-spacing:.25em;text-transform:uppercase;color:#78838d;">This Must Be The Pool</td></tr>
<tr><td style="padding-top:4px;font-size:12px;line-height:18px;color:#78838d;">You're getting this because you turned on pick reminders.<br><a href="${esc(unsubscribeUrl)}" style="color:#38a8e8;">Turn off reminders</a></td></tr>
</table>
</td></tr></table>
</body></html>`;

  return { subject, html, text };
}
