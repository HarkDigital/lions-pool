"use client";

// ---------------------------------------------------------------------------
// Demo persistence layer. In production this is replaced by Clerk (identity)
// and Postgres (picks / contests / results); the page components won't care.
//
// localStorage keys:
//   lionspool.user          -> participant id the visitor is "signed in" as
//   lionspool.subs          -> Submission[] created in this browser
//   lionspool.contests      -> Contest[] created/edited in the admin builder
//   lionspool.results       -> WeekResults[] entered in admin grading
// ---------------------------------------------------------------------------

import { useSyncExternalStore } from "react";
import type { Contest, Submission, WeekResults } from "./types";
import {
  CONTESTS,
  DEMO_NOW,
  RESULTS,
  SUBMISSIONS,
  participant,
} from "./demo-data";

const KEYS = {
  user: "lionspool.user",
  subs: "lionspool.subs",
  contests: "lionspool.contests",
  results: "lionspool.results",
} as const;

const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version++;
  listeners.forEach((l) => l());
}

// One shared cross-tab listener for the whole module, not one per subscriber.
if (typeof window !== "undefined") {
  window.addEventListener("storage", () => emit());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
  emit();
}

/** Re-render subscribers whenever anything in the store changes. */
export function useStoreVersion(): number {
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
}

/**
 * False during SSR/static render and the hydration pass, true after mount.
 * Pages must render baked demo data until this flips, then switch to the
 * effective* readers — that keeps server HTML and first client render
 * identical (no hydration mismatch).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

// --- Identity ---------------------------------------------------------------

export function getUserId(): string | null {
  return readJSON<string | null>(KEYS.user, null);
}

export function signIn(id: string) {
  if (!participant(id)) return;
  writeJSON(KEYS.user, id);
}

export function signOut() {
  window.localStorage.removeItem(KEYS.user);
  emit();
}

export function useUserId(): string | null {
  return useSyncExternalStore(subscribe, getUserId, () => null);
}

export function useUser() {
  useStoreVersion();
  const id = useUserId();
  return id ? (participant(id) ?? null) : null;
}

// --- Submissions ------------------------------------------------------------

function localSubs(): Submission[] {
  return readJSON<Submission[]>(KEYS.subs, []);
}

/**
 * Players only. Mother doesn't pick — an admin row (stale localStorage, or
 * any future write path) must never reach the grading engine, where a stray
 * scorePick would corrupt Closest-To/Exacto for the whole field.
 */
export function playerSubmissions(subs: Submission[]): Submission[] {
  return subs.filter((s) => !participant(s.userId)?.isAdmin);
}

/**
 * Baked demo submissions + anything saved in this browser. A local pick for
 * the same user+week replaces the baked one.
 */
export function effectiveSubmissions(week: number): Submission[] {
  const local = localSubs().filter((s) => s.week === week);
  const baked = SUBMISSIONS.filter(
    (s) => s.week === week && !local.some((l) => l.userId === s.userId),
  );
  return playerSubmissions([...baked, ...local]);
}

export function mySubmission(week: number, userId: string): Submission | undefined {
  return effectiveSubmissions(week).find((s) => s.userId === userId);
}

export function saveSubmission(sub: Submission) {
  const rest = localSubs().filter((s) => !(s.week === sub.week && s.userId === sub.userId));
  writeJSON(KEYS.subs, [...rest, sub]);
}

// --- Contests (admin builder overlay) ---------------------------------------

/**
 * The lock time is authoritative, not decoration: in by a minute you're in,
 * late by a minute you lost your pick. Date.parse, NOT string comparison —
 * DEMO_NOW carries seconds while lockAtUTC values omit them, so lexicographic
 * order lies at the boundary. In production the same predicate runs
 * server-side against the real clock.
 */
export function isContestOpen(c: Contest): boolean {
  return c.status === "open" && Date.parse(DEMO_NOW) < Date.parse(c.lockAtUTC);
}

export function effectiveContests(): Contest[] {
  const local = readJSON<Contest[]>(KEYS.contests, []);
  const merged = CONTESTS.map((c) => local.find((l) => l.week === c.week) ?? c);
  const extra = local.filter((l) => !CONTESTS.some((c) => c.week === l.week));
  return [...merged, ...extra].sort((a, b) => a.week - b.week);
}

export function effectiveContest(week: number): Contest | undefined {
  return effectiveContests().find((c) => c.week === week);
}

export function saveContest(contest: Contest) {
  const local = readJSON<Contest[]>(KEYS.contests, []);
  const rest = local.filter((c) => c.week !== contest.week);
  writeJSON(KEYS.contests, [...rest, contest]);
}

// --- Results (admin grading overlay) ----------------------------------------

export function effectiveResults(week: number): WeekResults | undefined {
  const local = readJSON<WeekResults[]>(KEYS.results, []);
  return local.find((r) => r.week === week) ?? RESULTS.find((r) => r.week === week);
}

export function allEffectiveResults(): WeekResults[] {
  const local = readJSON<WeekResults[]>(KEYS.results, []);
  const baked = RESULTS.filter((r) => !local.some((l) => l.week === r.week));
  return [...baked, ...local].sort((a, b) => a.week - b.week);
}

export function saveResults(results: WeekResults) {
  const local = readJSON<WeekResults[]>(KEYS.results, []);
  const rest = local.filter((r) => r.week !== results.week);
  writeJSON(KEYS.results, [...rest, results]);
}

/** Wipe every demo overlay and start clean. */
export function resetDemo() {
  Object.values(KEYS).forEach((k) => window.localStorage.removeItem(k));
  emit();
}
