"use client";

// The one-time "want pick reminders?" question. Rendered in the root layout;
// shows to any signed-in account that has never answered (a Clerk session
// lasts for weeks, so this fires on the next VISIT, not only a fresh sign-in).
// After the choice it confirms once, then never shows again: the My Picks
// toggle is where the choice changes after that. Live area only.

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Btn } from "@/components/ui";
import { saveReminderPref, useReminderPref } from "@/lib/prefs";
import { isDemoArea, useHydrated } from "@/lib/store";

type Phase = "ask" | "yes" | "no" | "closed";

function BellIcon({ off = false }: { off?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3H4a4 4 0 0 0 2-3v-3a7 7 0 0 1 4-6M9 17v1a3 3 0 0 0 6 0v-1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {off && <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
    </svg>
  );
}

export function ReminderPrompt() {
  const hydrated = useHydrated();
  const pathname = usePathname();
  const pref = useReminderPref();
  const [phase, setPhase] = useState<Phase>("ask");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  if (!hydrated || isDemoArea() || /^\/sign-(in|up)/.test(pathname)) return null;
  if (phase === "closed") return null;
  if (phase === "ask" && pref !== null) return null;

  const choose = async (on: boolean) => {
    setSaving(true);
    setError(false);
    const ok = await saveReminderPref(on);
    setSaving(false);
    if (ok) setPhase(on ? "yes" : "no");
    else setError(true);
  };

  return (
    <ReminderPromptView
      phase={phase}
      saving={saving}
      error={error}
      onChoose={(on) => void choose(on)}
      onClose={() => setPhase("closed")}
    />
  );
}

/** The dialog itself, state passed in. */
export function ReminderPromptView({
  phase,
  saving,
  error,
  onChoose,
  onClose,
}: {
  phase: Exclude<Phase, "closed">;
  saving: boolean;
  error: boolean;
  onChoose: (on: boolean) => void;
  onClose: () => void;
}) {
  const iconRing =
    phase === "yes"
      ? "border-win/50 bg-win/10 text-win"
      : phase === "no"
        ? "border-edge-2 text-fog"
        : "border-honolulu/60 bg-honolulu/15 text-sky";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-pitch/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reminder-prompt-title"
    >
      <div className="anim-rise w-full max-w-sm rounded-2xl border border-honolulu/60 bg-panel p-6 text-center shadow-[0_0_40px_-12px_rgba(0,118,182,0.45)]">
        <div
          className={`mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border ${iconRing}`}
        >
          {phase === "yes" ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 12l5 5L20 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <BellIcon off={phase === "no"} />
          )}
        </div>

        {phase === "ask" ? (
          <>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky">
              Pick reminders
            </div>
            <h2 id="reminder-prompt-title" className="display mt-1.5 text-4xl leading-none">
              Want a nudge before kickoff?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-silver">
              We&apos;ll email you 24 hours before each week&apos;s picks lock, only if yours
              aren&apos;t in yet.
            </p>
            <div className="mt-5 space-y-2">
              <Btn className="w-full py-2.5" disabled={saving} onClick={() => onChoose(true)}>
                Yes, email me
              </Btn>
              <Btn
                kind="ghost"
                className="w-full py-2.5"
                disabled={saving}
                onClick={() => onChoose(false)}
              >
                No thanks
              </Btn>
            </div>
            {error ? (
              <p className="mt-3 text-xs font-semibold text-loss" role="alert">
                That didn&apos;t save. Try again.
              </p>
            ) : (
              <p className="mt-3 text-xs text-fog">Change it anytime on My Picks.</p>
            )}
          </>
        ) : (
          <>
            <h2 id="reminder-prompt-title" className="display text-4xl leading-none">
              {phase === "yes" ? "You're on the list" : "No emails. Got it."}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-silver">
              {phase === "yes"
                ? "The email lands 24 hours before picks lock, unless you've already picked."
                : "Change your mind anytime on My Picks."}
            </p>
            <Btn kind="ghost" className="mt-5 w-full py-2.5" onClick={onClose}>
              Back to the pool
            </Btn>
          </>
        )}
      </div>
    </div>
  );
}
