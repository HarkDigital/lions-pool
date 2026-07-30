"use client";

import { useState } from "react";
import { resetDemo } from "@/lib/store";

/**
 * Sitewide demo-mode banner. The demo clock is frozen at Oct 1, 2026:
 * Weeks 1–3 graded, Week 4 open. Sign-in is simulated (Clerk replaces it
 * in the live version) and everything you save lives in this browser only.
 */
export function DemoNotice() {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/40 bg-gold/10 px-4 py-2.5 text-sm text-gold">
      <span>
        <strong className="font-bold">Demo mode:</strong> simulated 2026 season, frozen at Oct 1.
        Sign-in and picks are pretend; your changes stay in this browser.
      </span>
      {confirming ? (
        <span className="flex items-center gap-2">
          <button
            onClick={() => {
              resetDemo();
              setConfirming(false);
            }}
            className="rounded-md bg-gold/20 px-2.5 py-1 text-xs font-bold hover:bg-gold/30"
          >
            Yes, wipe my demo data
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="rounded-md px-2 py-1 text-xs font-bold text-gold/70 hover:text-gold"
          >
            Cancel
          </button>
        </span>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="rounded-md px-2.5 py-1 text-xs font-bold text-gold/70 underline-offset-2 hover:text-gold hover:underline"
        >
          Reset demo
        </button>
      )}
    </div>
  );
}
