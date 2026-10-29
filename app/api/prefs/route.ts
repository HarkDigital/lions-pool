// The signed-in account's own email preferences. Just one for now: pick
// reminders (null = never asked, which is what raises the one-time prompt).
//
//   GET   { reminders: boolean | null }
//   POST  { reminders: boolean }

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { dbGetReminderPref, dbSetReminderPref } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ reminders: await dbGetReminderPref(userId) });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { reminders?: unknown };
  if (typeof body.reminders !== "boolean")
    return NextResponse.json({ error: "reminders must be true or false" }, { status: 400 });
  await dbSetReminderPref(userId, body.reminders);
  return NextResponse.json({ ok: true });
}
