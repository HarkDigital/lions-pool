"use client";

// The signed-in account's pick-reminder choice, shared by the one-time prompt
// and the My Picks toggle so the two always agree. Fetched once per account
// from /api/prefs. Live area only: the demo has no email.
//
//   undefined  not loaded yet (or the fetch failed): render nothing
//   null       never asked: the prompt shows
//   boolean    the choice

import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@clerk/nextjs";

interface State {
  userId: string | null;
  value: boolean | null | undefined;
}

let state: State = { userId: null, value: undefined };
let loading: string | null = null;
const listeners = new Set<() => void>();

function set(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

async function load(userId: string) {
  if (loading === userId) return;
  loading = userId;
  try {
    const res = await fetch("/api/prefs", { cache: "no-store" });
    if (!res.ok) return;
    const { reminders } = (await res.json()) as { reminders: boolean | null };
    if (state.userId === userId) set({ userId, value: reminders });
  } catch {
    // Offline or mid-restart: no prompt this visit, no harm done.
  } finally {
    loading = null;
  }
}

export function useReminderPref(): boolean | null | undefined {
  const { isLoaded, userId } = useAuth();
  const snap = useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
  const viewer = userId ?? null;
  useEffect(() => {
    if (!isLoaded) return;
    if (state.userId !== viewer) set({ userId: viewer, value: undefined });
    if (viewer && state.value === undefined) void load(viewer);
  }, [isLoaded, viewer]);
  return isLoaded && snap.userId === viewer ? snap.value : undefined;
}

/** Save the choice. Optimistic; resolves false (and rolls back) if the
 * server refused it. */
export async function saveReminderPref(on: boolean): Promise<boolean> {
  const before = state;
  set({ ...state, value: on });
  const ok = await fetch("/api/prefs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reminders: on }),
  })
    .then((r) => r.ok)
    .catch(() => false);
  if (!ok && state.userId === before.userId) set(before);
  return ok;
}
