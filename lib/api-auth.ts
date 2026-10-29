import "server-only";

// Who is calling an API route. Most of the site is gated, but the pool and
// roster GETs are reachable signed out (the public Nums), so callers may be
// null; this adds the admin determination (same email rule as the middleware
// and the roster route).

import { auth, clerkClient } from "@clerk/nextjs/server";

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "mike@hark.digital")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export interface Caller {
  userId: string;
  /**
   * The entry this account plays on. Its own id, or the primary's when two
   * people share an entry. Picks are read and written under THIS id, never
   * under `userId`, or the second person could neither see nor save the
   * pick they share.
   */
  entryId: string;
  isAdmin: boolean;
}

/** Returns the caller, or null if not signed in. */
export async function getCaller(): Promise<Caller | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const isAdmin = user.emailAddresses.some((e) =>
    ADMIN_EMAILS.includes(e.emailAddress.toLowerCase()),
  );
  // A shared entry: this account rides on another's. Trusted only when the
  // value is a real, different, existing user who is not themselves linked
  // (one level only, so a chain or a cycle can never resolve).
  let entryId = userId;
  const raw = user.publicMetadata?.entryOf;
  const link = typeof raw === "string" ? raw.trim() : "";
  if (link && link !== userId) {
    try {
      const primary = await client.users.getUser(link);
      const onward = primary.publicMetadata?.entryOf;
      const chained = typeof onward === "string" && onward.trim() && onward.trim() !== primary.id;
      if (!chained) entryId = primary.id;
    } catch {
      // The primary is gone: this account stands on its own.
    }
  }
  return { userId, entryId, isAdmin };
}
