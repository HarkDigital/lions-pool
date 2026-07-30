// The roster API. Backs the live pool's player list with the real Clerk
// users who have signed up. Nicknames live in each user's Clerk
// publicMetadata (no separate database needed for this piece).
//
//   GET   — any signed-in member: the public roster (id, nickname, color).
//           Admins also get each member's real name and email.
//   PATCH — admins only: set a member's nickname.

import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { colorForId } from "@/lib/roster-color";

export const dynamic = "force-dynamic";

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "mike@hark.digital")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function emailsOf(user: { emailAddresses: { emailAddress: string }[] }): string[] {
  return user.emailAddresses.map((e) => e.emailAddress.toLowerCase());
}

async function callerIsAdmin(userId: string): Promise<boolean> {
  const client = await clerkClient();
  const me = await client.users.getUser(userId);
  return emailsOf(me).some((e) => ADMIN_EMAILS.includes(e));
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const client = await clerkClient();
  const isAdmin = await callerIsAdmin(userId);
  const { data } = await client.users.getUserList({ limit: 200, orderBy: "+created_at" });

  const players = data
    .filter((u) => !emailsOf(u).some((e) => ADMIN_EMAILS.includes(e)))
    .map((u) => {
      const nickname = ((u.publicMetadata?.nickname as string) ?? "").trim();
      const base = { id: u.id, nickname, avatarColor: colorForId(u.id) };
      if (!isAdmin) return base;
      const email = u.emailAddresses[0]?.emailAddress ?? "";
      const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || email || "Member";
      return { ...base, name, email };
    });

  return NextResponse.json({ players });
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await callerIsAdmin(userId)))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json()) as { userId?: string; nickname?: string };
  if (!body.userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const client = await clerkClient();
  await client.users.updateUserMetadata(body.userId, {
    publicMetadata: { nickname: (body.nickname ?? "").trim() },
  });
  return NextResponse.json({ ok: true });
}
