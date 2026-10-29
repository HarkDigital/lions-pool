// The live pool's shared data, backed by MariaDB.
//   GET  — season data the caller may see (others' open-week picks stay hidden
//          until lock; payments and the full house line are admin-only).
//          Signed out (the public Nums): revealed weeks only, no own pick.
//   POST — a single write: { resource, data }. Players may only save their own
//          pick, only while the week is open; everything else is admin-only.

import { NextResponse } from "next/server";
import { getCaller } from "@/lib/api-auth";
import {
  dbGetBonus,
  dbGetContests,
  dbGetMotherPicks,
  dbGetPayments,
  dbGetResults,
  dbGetSubmissions,
  dbSaveBonus,
  dbSaveContest,
  dbSaveMotherPick,
  dbSavePayment,
  dbSaveResults,
  dbSaveSubmission,
} from "@/lib/db";
import type { Contest } from "@/lib/types";

export const dynamic = "force-dynamic";

/** A week's picks are revealed to everyone once it locks or is graded. */
function isRevealed(c: Contest | undefined): boolean {
  if (!c) return false;
  if (c.status === "graded" || c.status === "locked") return true;
  return Date.now() >= Date.parse(c.lockAtUTC);
}

export async function GET() {
  const caller = await getCaller();
  const isAdmin = caller?.isAdmin ?? false;

  const [contests, results, allSubs, payments, bonus, motherPicks] = await Promise.all([
    dbGetContests(),
    dbGetResults(),
    dbGetSubmissions(),
    dbGetPayments(),
    dbGetBonus(),
    dbGetMotherPicks(),
  ]);

  const byWeek = new Map(contests.map((c) => [c.week, c]));
  // Your own pick is always yours to see. On a shared entry that means the
  // ENTRY's pick, or the second person would be shown an empty form for the
  // open week and would overwrite their partner without ever seeing it.
  const mine = (s: { userId: string }) =>
    caller != null && (s.userId === caller.userId || s.userId === caller.entryId);
  const submissions = isAdmin
    ? allSubs
    : allSubs.filter((s) => mine(s) || isRevealed(byWeek.get(s.week)));

  return NextResponse.json({
    contests,
    results,
    submissions,
    bonus,
    payments: isAdmin ? payments : [],
    motherPicks: isAdmin ? motherPicks : [],
  });
}

export async function POST(req: Request) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as { resource?: string; data?: unknown };
  const { resource, data } = body;
  const forbid = () => NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    switch (resource) {
      case "submission": {
        const sub = data as { userId: string; week: number };
        // Players may only save their own pick, and only while the week is open.
        if (!caller.isAdmin && sub.userId !== caller.userId && sub.userId !== caller.entryId)
          return forbid();
        const contest = (await dbGetContests()).find((c) => c.week === sub.week);
        const open = contest?.status === "open" && Date.now() < Date.parse(contest.lockAtUTC);
        if (!caller.isAdmin && !open)
          return NextResponse.json({ error: "week is not open" }, { status: 409 });
        // The server decides which id a player's pick belongs to, never the
        // client: always their own entry. Only the office may file for others.
        const row = caller.isAdmin ? sub : { ...sub, userId: caller.entryId };
        await dbSaveSubmission(row as never);
        break;
      }
      case "contest":
        if (!caller.isAdmin) return forbid();
        await dbSaveContest(data as never);
        break;
      case "result":
        if (!caller.isAdmin) return forbid();
        await dbSaveResults(data as never);
        break;
      case "settings":
        if (!caller.isAdmin) return forbid();
        await dbSaveBonus(data as never);
        break;
      case "payment":
        if (!caller.isAdmin) return forbid();
        await dbSavePayment(data as never);
        break;
      case "motherPick": {
        if (!caller.isAdmin) return forbid();
        const { sub, contest } = data as { sub: unknown; contest: unknown };
        await dbSaveMotherPick(sub as never);
        await dbSaveContest(contest as never);
        break;
      }
      default:
        return NextResponse.json({ error: "unknown resource" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
