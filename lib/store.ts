"use client";

// ---------------------------------------------------------------------------
// Persistence layer with two areas:
//
//   LIVE  (site root)  — the actual 2026 season. Starts empty: drafted
//                        contests, no players, no picks. Browser-local until
//                        the backend lands; fetch()/auth slot in here.
//   DEMO  (/demo/...)  — the frozen Oct-1 simulation with the fictional
//                        roster, sample picks, and graded weeks.
//
// The area is derived from the URL at call time, and each area gets its own
// localStorage keyspace, so nothing leaks between them. IMPORTANT hydration
// rule: the prerendered HTML is area-agnostic — pages must render a neutral
// skeleton until useHydrated() flips, then read these selectors.
// ---------------------------------------------------------------------------

import { useSyncExternalStore } from "react";
import { useClerk, useUser as useClerkUser } from "@clerk/nextjs";
import type { Contest, Participant, PaymentRecord, Submission, WeekResults } from "./types";
import {
  CONTESTS,
  CURRENT_WEEK,
  DEMO_NOW,
  EVERYONE,
  PLAYERS,
  RESULTS,
  SUBMISSIONS,
} from "./demo-data";
import { LIVE_CONTESTS, MOTHER } from "./live-data";
import { DEFAULT_BONUS_VALUES, type BonusValues } from "./scoring";

/** Clerk emails that ARE Mother Superior. Comma-separated, set at build. */
const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "mike@hark.digital")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// --- Area / mode -------------------------------------------------------------

export type PoolMode = "live" | "demo";

/** "demo" anywhere under /demo/, "live" everywhere else (and during SSR). */
export function poolMode(): PoolMode {
  if (typeof window === "undefined") return "live";
  // basePath-safe: GH Pages serves under /<repo>/, so check for the segment.
  return /(^|\/)demo(\/|$)/.test(window.location.pathname) ? "demo" : "live";
}

export function isDemoArea(): boolean {
  return poolMode() === "demo";
}

/** The clock the pool runs on: frozen for the demo, real for the season. */
export function nowMs(): number {
  return isDemoArea() ? Date.parse(DEMO_NOW) : Date.now();
}

/** Area-scoped storage key. */
function k(name: string): string {
  return `lionspool.${poolMode()}.${name}`;
}

const KEY_NAMES = [
  "user",
  "subs",
  "contests",
  "results",
  "nicknames",
  "payments",
  "settings",
  "motherpicks",
] as const;

// --- Baked data per area -----------------------------------------------------

export function bakedContests(): Contest[] {
  return isDemoArea() ? CONTESTS : LIVE_CONTESTS;
}

function bakedSubs(): Submission[] {
  return isDemoArea() ? SUBMISSIONS : [];
}

function bakedResults(): WeekResults[] {
  return isDemoArea() ? RESULTS : [];
}

// --- Live roster (real Clerk members, fetched from /api/roster) --------------
// The live pool's players are the signed-up Clerk users. The roster is fetched
// once per session by <RosterSync/> and cached here; poolPlayers() reads the
// cache. Nicknames live in Clerk metadata and are edited through the API.

let liveRoster: Participant[] | null = null;
let rosterFetched = false;

export async function refreshRoster(): Promise<void> {
  try {
    const res = await fetch("/api/roster", { cache: "no-store" });
    if (!res.ok) return;
    const { players } = (await res.json()) as { players: Partial<Participant>[] };
    liveRoster = players.map((p) => ({
      id: p.id!,
      name: p.name ?? "",
      email: p.email,
      nickname: p.nickname ?? "",
      avatarColor: p.avatarColor ?? "#78838d",
    }));
    emit();
  } catch {
    /* offline or unauthorized: leave the cache as-is */
  }
}

/** Kick off the one-time roster fetch in the live area (no-op in demo/SSR). */
export function ensureRoster(): void {
  if (isDemoArea() || typeof window === "undefined" || rosterFetched) return;
  rosterFetched = true;
  void refreshRoster();
}

/** The playing roster for the current area. */
export function poolPlayers(): Participant[] {
  return isDemoArea() ? PLAYERS : (liveRoster ?? []);
}

/** Roster including the Commissioner. */
export function poolEveryone(): Participant[] {
  return isDemoArea() ? EVERYONE : [MOTHER, ...(liveRoster ?? [])];
}

export function poolParticipant(id: string): Participant | undefined {
  return poolEveryone().find((p) => p.id === id);
}

// --- Live pool data (MariaDB via /api/pool) ---------------------------------
// The live season's shared data lives in the database, fetched once per
// session by <RosterSync/> (which also calls ensurePool) and cached here. The
// effective*/save* readers below use this cache in live mode; demo mode is
// untouched localStorage. Reads fall back to empty/baked so a failed fetch
// degrades to an empty pool rather than a crash.

interface LivePool {
  contests: Contest[];
  results: WeekResults[];
  submissions: Submission[];
  bonus: BonusValues;
  payments: PaymentRecord[];
  motherPicks: Submission[];
}

let livePool: LivePool | null = null;
let poolFetched = false;

export async function refreshPool(): Promise<void> {
  try {
    const res = await fetch("/api/pool", { cache: "no-store" });
    if (!res.ok) return;
    livePool = (await res.json()) as LivePool;
    emit();
  } catch {
    /* offline: keep the cache as-is */
  }
}

export function ensurePool(): void {
  if (isDemoArea() || typeof window === "undefined" || poolFetched) return;
  poolFetched = true;
  void refreshPool();
}

function poolWrite(resource: string, data: unknown): void {
  void fetch("/api/pool", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ resource, data }),
  }).then((res) => {
    if (res.ok) void refreshPool();
  });
}

/**
 * The week the pool is currently pointed at: frozen Week 4 in the demo; in
 * live mode, the first week whose lock hasn't passed (season over -> 18).
 */
export function currentWeek(): number {
  if (isDemoArea()) return CURRENT_WEEK;
  const now = nowMs();
  const upcoming = effectiveContests().find((c) => now < Date.parse(c.lockAtUTC));
  return upcoming?.week ?? 18;
}

// --- Plumbing ---------------------------------------------------------------

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
 * Pages must render a neutral, area-agnostic skeleton until this flips —
 * the area comes from the URL, which the prerender doesn't know.
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
  return readJSON<string | null>(k("user"), null);
}

export function signIn(id: string) {
  if (!poolParticipant(id)) return;
  writeJSON(k("user"), id);
}

export function signOut() {
  window.localStorage.removeItem(k("user"));
  emit();
}

export function useUserId(): string | null {
  return useSyncExternalStore(subscribe, getUserId, () => null);
}

/**
 * The signed-in participant.
 *   DEMO: the localStorage character (pick-a-name sign-in).
 *   LIVE: the Clerk session, and nothing else. Admin emails become Mother
 *   Superior; everyone else is a provisional player until the roster/DB
 *   milestone maps accounts to nicknames.
 */
export function useUser(): Participant | null {
  useStoreVersion();
  const localId = useUserId();
  const hydrated = useHydrated();
  const { user: clerkUser, isLoaded } = useClerkUser();

  if (!hydrated) return null;
  if (isDemoArea()) return localId ? (poolParticipant(localId) ?? null) : null;

  if (!isLoaded || !clerkUser) return null;
  const email = clerkUser.primaryEmailAddress?.emailAddress?.toLowerCase();
  if (email && ADMIN_EMAILS.includes(email)) return MOTHER;
  // Provisional member: no Commissioner-assigned nickname yet (empty, not a
  // fake one) — publicName() renders the placeholder, selfName() their own
  // account name.
  return {
    id: clerkUser.id,
    name: clerkUser.fullName ?? clerkUser.firstName ?? email ?? "Member",
    email,
    nickname: "",
    avatarColor: "#78838d",
  };
}

/** Area-aware sign-out for the Nav: Clerk in live, localStorage in demo. */
export function useSignOut(): () => void {
  const { signOut: clerkSignOut } = useClerk();
  return () => {
    if (isDemoArea()) {
      signOut();
    } else {
      void clerkSignOut({ redirectUrl: "/sign-in" });
    }
  };
}

// --- Submissions ------------------------------------------------------------

function localSubs(): Submission[] {
  return readJSON<Submission[]>(k("subs"), []);
}

/**
 * Players only. Mother Superior doesn't pick — an admin row (stale storage,
 * or any future write path) must never reach the grading engine, where a
 * stray scorePick would corrupt Closest-To/Exacto for the whole field.
 */
export function playerSubmissions(subs: Submission[]): Submission[] {
  return subs.filter((s) => !poolParticipant(s.userId)?.isAdmin);
}

/**
 * Baked submissions + anything saved in this browser. A local pick for the
 * same user+week replaces the baked one.
 */
export function effectiveSubmissions(week: number): Submission[] {
  if (!isDemoArea()) {
    return playerSubmissions((livePool?.submissions ?? []).filter((s) => s.week === week));
  }
  const local = localSubs().filter((s) => s.week === week);
  const baked = bakedSubs().filter(
    (s) => s.week === week && !local.some((l) => l.userId === s.userId),
  );
  return playerSubmissions([...baked, ...local]);
}

export function mySubmission(week: number, userId: string): Submission | undefined {
  return effectiveSubmissions(week).find((s) => s.userId === userId);
}

export function saveSubmission(sub: Submission) {
  if (!isDemoArea()) {
    poolWrite("submission", sub);
    return;
  }
  const rest = localSubs().filter((s) => !(s.week === sub.week && s.userId === sub.userId));
  writeJSON(k("subs"), [...rest, sub]);
}

// --- Contests (admin builder overlay) ---------------------------------------

/**
 * The lock time is authoritative, not decoration: in by a minute you're in,
 * late by a minute you lost your pick. Frozen clock in the demo, real clock
 * for the season; in production the same predicate runs server-side.
 */
export function isContestOpen(c: Contest): boolean {
  return c.status === "open" && nowMs() < Date.parse(c.lockAtUTC);
}

export function effectiveContests(): Contest[] {
  const local = isDemoArea() ? readJSON<Contest[]>(k("contests"), []) : (livePool?.contests ?? []);
  const baked = bakedContests();
  const merged = baked.map((c) => local.find((l) => l.week === c.week) ?? c);
  const extra = local.filter((l) => !baked.some((c) => c.week === l.week));
  return [...merged, ...extra].sort((a, b) => a.week - b.week);
}

export function effectiveContest(week: number): Contest | undefined {
  return effectiveContests().find((c) => c.week === week);
}

export function saveContest(contest: Contest) {
  if (!isDemoArea()) {
    poolWrite("contest", contest);
    return;
  }
  const local = readJSON<Contest[]>(k("contests"), []);
  const rest = local.filter((c) => c.week !== contest.week);
  writeJSON(k("contests"), [...rest, contest]);
}

// --- Results (admin grading overlay) ----------------------------------------

export function effectiveResults(week: number): WeekResults | undefined {
  if (!isDemoArea()) return (livePool?.results ?? []).find((r) => r.week === week);
  const local = readJSON<WeekResults[]>(k("results"), []);
  return local.find((r) => r.week === week) ?? bakedResults().find((r) => r.week === week);
}

export function allEffectiveResults(): WeekResults[] {
  if (!isDemoArea()) return [...(livePool?.results ?? [])].sort((a, b) => a.week - b.week);
  const local = readJSON<WeekResults[]>(k("results"), []);
  const baked = bakedResults().filter((r) => !local.some((l) => l.week === r.week));
  return [...baked, ...local].sort((a, b) => a.week - b.week);
}

export function saveResults(results: WeekResults) {
  if (!isDemoArea()) {
    poolWrite("result", results);
    return;
  }
  const local = readJSON<WeekResults[]>(k("results"), []);
  const rest = local.filter((r) => r.week !== results.week);
  writeJSON(k("results"), [...rest, results]);
}

// --- Nicknames (Commissioner-set, admin overlay) -----------------------------

/**
 * The ONLY name public pages may render. Real names and emails stay in the
 * admin wing; players cannot set or change their own nickname. Members
 * without an assigned nickname show a neutral placeholder, never a name.
 */
export function publicName(p: Participant): string {
  const overlay = readJSON<Record<string, string>>(k("nicknames"), {});
  return overlay[p.id]?.trim() || p.nickname || "Awaiting nickname";
}

/**
 * What a signed-in member sees for THEMSELVES (the nav pill): the assigned
 * nickname once Mother Superior grants one, else their own account name.
 * Showing you your own name is not a privacy leak.
 */
export function selfName(p: Participant): string {
  const overlay = readJSON<Record<string, string>>(k("nicknames"), {});
  return overlay[p.id]?.trim() || p.nickname || p.name;
}

export function saveNickname(userId: string, nickname: string) {
  if (isDemoArea()) {
    const overlay = readJSON<Record<string, string>>(k("nicknames"), {});
    writeJSON(k("nicknames"), { ...overlay, [userId]: nickname });
    return;
  }
  // Live: persist to Clerk metadata via the API, then refresh the cache.
  void fetch("/api/roster", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId, nickname }),
  }).then((res) => {
    if (res.ok) void refreshRoster();
  });
}

// --- Mother Superior's weekly picks ------------------------------------------

/**
 * The house line: Mother Superior fills out the same pick form the players
 * use, and the result is stored here (its own keyspace, never a graded
 * submission, never in the Nums). Its winner+score becomes the contest's
 * "Mother Superior Says" strip that the pool reads on This Week.
 */
export function mothersSubmission(week: number): Submission | undefined {
  if (!isDemoArea()) return (livePool?.motherPicks ?? []).find((s) => s.week === week);
  const local = readJSON<Submission[]>(k("motherpicks"), []);
  return local.find((s) => s.week === week);
}

export function publishMothersLine(contest: Contest, sub: Submission, says: string) {
  const updated = { ...contest, motherSays: says || undefined };
  if (!isDemoArea()) {
    poolWrite("motherPick", { sub, contest: updated });
    return;
  }
  const local = readJSON<Submission[]>(k("motherpicks"), []);
  const rest = local.filter((s) => s.week !== sub.week);
  writeJSON(k("motherpicks"), [...rest, sub]);
  saveContest(updated);
}

// --- Season scoring settings (Commissioner-set) ------------------------------

/**
 * Bonus payouts for the area's season. Every grading call site passes these
 * into the engine, so a change re-scores all graded weeks immediately.
 */
export function bonusValues(): BonusValues {
  if (!isDemoArea()) return livePool?.bonus ?? DEFAULT_BONUS_VALUES;
  const saved = readJSON<Partial<BonusValues>>(k("settings"), {});
  return { ...DEFAULT_BONUS_VALUES, ...saved };
}

export function saveBonusValues(v: BonusValues) {
  if (!isDemoArea()) {
    poolWrite("settings", v);
    return;
  }
  writeJSON(k("settings"), v);
}

// --- Payments (Commissioner bookkeeping) -------------------------------------

export function paymentFor(userId: string): PaymentRecord {
  if (!isDemoArea())
    return (livePool?.payments ?? []).find((r) => r.userId === userId) ?? { userId, paid: false };
  const local = readJSON<PaymentRecord[]>(k("payments"), []);
  return local.find((r) => r.userId === userId) ?? { userId, paid: false };
}

export function savePayment(record: PaymentRecord) {
  if (!isDemoArea()) {
    poolWrite("payment", record);
    return;
  }
  const local = readJSON<PaymentRecord[]>(k("payments"), []);
  const rest = local.filter((r) => r.userId !== record.userId);
  writeJSON(k("payments"), [...rest, record]);
}

/** Wipe the CURRENT area's overlays (plus any legacy unprefixed keys). */
export function resetDemo() {
  KEY_NAMES.forEach((n) => {
    window.localStorage.removeItem(k(n));
    window.localStorage.removeItem(`lionspool.${n}`); // pre-split legacy keys
  });
  emit();
}
