import "server-only";

// Who is calling an API route. The whole site is gated, so any route caller
// has a Clerk session; this adds the admin determination (same email rule as
// the middleware and the roster route).

import { auth, clerkClient } from "@clerk/nextjs/server";

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "mike@hark.digital")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export interface Caller {
  userId: string;
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
  return { userId, isAdmin };
}
