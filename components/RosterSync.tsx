"use client";

// Triggers the one-time live-roster fetch. Rendered in the root layout; a
// no-op in the demo area and on SSR. Re-checks on navigation so a demo->live
// move still loads the real roster.

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ensurePool, ensureRoster } from "@/lib/store";

export function RosterSync() {
  const pathname = usePathname();
  useEffect(() => {
    ensureRoster();
    ensurePool();
  }, [pathname]);
  return null;
}
