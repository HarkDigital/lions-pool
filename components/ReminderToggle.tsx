"use client";

// The pick-reminder switch on My Picks: where the one-time prompt's choice
// changes later. Live area only; renders nothing until the choice has loaded.

import { useState } from "react";
import { Card } from "@/components/ui";
import { saveReminderPref, useReminderPref } from "@/lib/prefs";
import { isDemoArea } from "@/lib/store";

export function ReminderToggle() {
  const pref = useReminderPref();
  const [error, setError] = useState(false);
  if (isDemoArea() || pref === undefined) return null;
  const on = pref === true;

  const flip = async () => {
    setError(false);
    if (!(await saveReminderPref(!on))) setError(true);
  };

  return <ReminderToggleView on={on} error={error} onFlip={() => void flip()} />;
}

/** The card itself, state passed in. */
export function ReminderToggleView({
  on,
  error,
  onFlip,
}: {
  on: boolean;
  error: boolean;
  onFlip: () => void;
}) {
  return (
    <Card className="flex items-center justify-between gap-4 p-5">
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky">
          Pick reminders
        </div>
        <p className={`mt-1 text-sm ${error ? "font-semibold text-loss" : "text-silver"}`}>
          {error
            ? "That didn't save. Try again."
            : "An email 24 hours before picks lock, only when yours aren't in yet."}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Email me pick reminders"
        onClick={onFlip}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition ${
          on ? "border-transparent bg-honolulu" : "border-edge-2 bg-panel-2"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-chalk shadow transition-transform ${
            on ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </Card>
  );
}
