"use client";

// Triggers the live roster and pool fetches. Rendered in the root layout; a
// no-op in the demo area and on SSR. Re-checks on navigation, and refetches
// whenever the Clerk identity changes (sign-in on the public front door,
// sign-out) so the cached view always matches who is looking.

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { syncViewer } from "@/lib/store";

export function RosterSync() {
  const pathname = usePathname();
  const { isLoaded, userId } = useAuth();
  useEffect(() => {
    // Wait for Clerk so the first fetch is already keyed to the right viewer.
    if (!isLoaded) return;
    syncViewer(userId ?? null);
  }, [pathname, isLoaded, userId]);
  return null;
}
