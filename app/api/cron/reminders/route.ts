// The pick-reminder sender. The VPS crontab POSTs here every 5 minutes with
// `Authorization: Bearer $REMINDERS_SECRET` (see HANDOFF.md). The rules live
// in lib/reminders.ts; this route only gathers the inputs and sends.
//
//   POST                    send whatever is due. 204 when nothing is, so the
//                           cron log only grows when mail actually goes out.
//   POST ?dry=1             who WOULD be emailed right now; sends nothing.
//   POST ?test=<address>    one sample email for the next slate, to that
//                           address only (&name=<nickname> to personalize).

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import {
  dbClaimReminder,
  dbGetContests,
  dbGetReminderOptIns,
  dbGetRemindersSent,
  dbGetSubmissions,
  dbReleaseReminder,
} from "@/lib/db";
import { LIVE_CONTESTS } from "@/lib/live-data";
import {
  dueContests,
  planReminders,
  renderReminder,
  unsubUrl,
  type ReminderAccount,
} from "@/lib/reminders";
import { sendEmail } from "@/lib/sendgrid";

export const dynamic = "force-dynamic";

function authorized(req: Request, secret: string): boolean {
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

async function reminderAccounts(): Promise<ReminderAccount[]> {
  const client = await clerkClient();
  const out: ReminderAccount[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await client.users.getUserList({ limit: 100, offset, orderBy: "+created_at" });
    for (const u of page.data) {
      const email = u.primaryEmailAddress?.emailAddress ?? u.emailAddresses[0]?.emailAddress ?? "";
      const nickname = ((u.publicMetadata?.nickname as string | undefined) ?? "").trim();
      out.push({
        id: u.id,
        email,
        nickname: nickname || (u.firstName ?? ""),
        entryOf: u.publicMetadata?.entryOf,
      });
    }
    if (page.data.length < 100) break;
  }
  return out;
}

export async function POST(req: Request) {
  const secret = process.env.REMINDERS_SECRET;
  if (!secret || !authorized(req, secret))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const now = Date.now();
  const contests = await dbGetContests();

  const test = params.get("test");
  if (test) {
    // The next week that hasn't locked, posted or not, so the sample can be
    // checked before Mother Superior finishes the slate.
    const merged = LIVE_CONTESTS.map((c) => contests.find((d) => d.week === c.week) ?? c);
    const next = merged.find((c) => now < Date.parse(c.lockAtUTC));
    if (!next) return NextResponse.json({ error: "no upcoming week" }, { status: 404 });
    const unsubscribeUrl = unsubUrl("test", secret);
    const email = renderReminder({
      contest: next,
      nickname: params.get("name") ?? "",
      now: Math.max(now, Date.parse(next.lockAtUTC) - 24 * 3_600_000),
      unsubscribeUrl,
    });
    const res = await sendEmail({
      to: test,
      subject: `[Test] ${email.subject}`,
      html: email.html,
      text: email.text,
      unsubscribeUrl,
      category: "pick-reminder-test",
    });
    return NextResponse.json({ week: next.week, subject: email.subject, ...res });
  }

  const dry = params.has("dry");
  const due = dueContests(contests, now);
  if (!dry && due.length === 0) return new Response(null, { status: 204 });

  const optedIn = await dbGetReminderOptIns();
  if (!dry && optedIn.length === 0) return new Response(null, { status: 204 });

  const [subs, sent, accounts] = await Promise.all([
    dbGetSubmissions(),
    dbGetRemindersSent(),
    reminderAccounts(),
  ]);
  const plan = planReminders({
    now,
    contests,
    subs,
    accounts,
    optedIn: new Set(optedIn),
    sent,
  });

  if (dry) {
    return NextResponse.json({
      dueWeeks: due.map((c) => c.week),
      optedIn: optedIn.length,
      wouldSend: plan.map((p) => ({ week: p.contest.week, to: p.account.email })),
    });
  }
  if (plan.length === 0) return new Response(null, { status: 204 });

  let sentCount = 0;
  const failed: { to: string; week: number; error: string }[] = [];
  for (const { contest, account } of plan) {
    // Claim first: a run that overlaps this one can never send the same email.
    if (!(await dbClaimReminder(account.id, contest.week))) continue;
    const unsubscribeUrl = unsubUrl(account.id, secret);
    const email = renderReminder({ contest, nickname: account.nickname, now, unsubscribeUrl });
    const res = await sendEmail({
      to: account.email,
      ...email,
      unsubscribeUrl,
      category: "pick-reminder",
    });
    if (res.ok) {
      sentCount++;
    } else {
      await dbReleaseReminder(account.id, contest.week); // the next run retries it
      failed.push({ to: account.email, week: contest.week, error: res.error });
    }
  }

  return NextResponse.json({
    at: new Date(now).toISOString(),
    weeks: due.map((c) => c.week),
    sent: sentCount,
    failed,
  });
}
