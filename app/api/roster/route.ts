// The roster API. Backs the live pool's player list with the real Clerk
// users who have signed up. Nicknames live in each user's Clerk
// publicMetadata (no separate database needed for this piece).
//
//   GET   — anyone, signed in or not: the public roster (id, nickname, color)
//           that the public Nums page needs. Admins also get each member's
//           real name and email.
//   PATCH — admins only: set a member's nickname.
//
// Shared entries: two people can play one entry. The second account carries
// `publicMetadata.entryOf = <primary user id>`; it is not a roster row of its
// own, and its name and email ride along on the primary's row instead.

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

type ClerkUser = Awaited<ReturnType<Awaited<ReturnType<typeof clerkClient>>["users"]["getUserList"]>>["data"][number];

function person(u: ClerkUser): { name: string; email: string } {
  const email = u.emailAddresses[0]?.emailAddress ?? "";
  return { name: [u.firstName, u.lastName].filter(Boolean).join(" ") || email || "Member", email };
}

export async function GET() {
  const { userId } = await auth();

  const client = await clerkClient();
  const isAdmin = userId ? await callerIsAdmin(userId) : false;
  // Page through: a single call caps out, and a member who fell off the end
  // would silently lose their entry and their picks.
  const data: ClerkUser[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await client.users.getUserList({ limit: 100, offset, orderBy: "+created_at" });
    data.push(...page.data);
    if (page.data.length < 100) break;
  }

  // Fold every linked account onto the entry it belongs to. A link counts only
  // when it names a real, different, existing account, so a stray, malformed
  // or self-referencing value can never make somebody vanish from the roster.
  const known = new Set(data.map((u) => u.id));
  const linkOf = (u: ClerkUser): string => {
    const raw = u.publicMetadata?.entryOf;
    return typeof raw === "string" ? raw.trim() : "";
  };
  const links = new Map<string, string>();
  for (const u of data) {
    const primary = linkOf(u);
    if (primary && primary !== u.id && known.has(primary)) links.set(u.id, primary);
  }
  // One level only. A primary that is itself linked is not a valid primary, so
  // a chain (A->B->C) and a cycle (A->B->A) both dissolve into plain entries
  // instead of deleting somebody from the pool.
  for (const [secondary, primary] of [...links]) if (links.has(primary)) links.delete(secondary);

  const partners = new Map<string, ClerkUser[]>();
  const byId = new Map(data.map((u) => [u.id, u]));
  for (const [secondary, primary] of links) {
    partners.set(primary, [...(partners.get(primary) ?? []), byId.get(secondary)!]);
  }
  const linked = new Set(links.keys());

  // Admins are contestants too: every account is a roster row, except the
  // second account on a shared entry, which is folded into the first.
  const players = data
    .filter((u) => !linked.has(u.id))
    .map((u) => {
      const mates = partners.get(u.id) ?? [];
      const nickname = ((u.publicMetadata?.nickname as string) ?? "").trim();
      const base = {
        id: u.id,
        nickname,
        avatarColor: colorForId(u.id),
        memberIds: [u.id, ...mates.map((m) => m.id)],
      };
      if (!isAdmin) return base;
      const members = [person(u), ...mates.map(person)];
      // `name` carries both people so every admin surface reads right without
      // knowing about entries; `members` is there for the ones that show more.
      return { ...base, name: members.map((m) => m.name).join(" & "), email: members[0].email, members };
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
