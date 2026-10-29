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

import { useEffect, useState, useSyncExternalStore } from "react";
import { useClerk, useUser as useClerkUser } from "@clerk/nextjs";
import type { Contest, Participant, PaymentRecord, Submission, TeamAbbr, WeekResults } from "./types";
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
import { colorForId } from "./roster-color";
import { DEFAULT_BONUS_VALUES, isLionsPickemGame, type BonusValues } from "./scoring";

/** Clerk emails with admin powers. Comma-separated, set at build. */
const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "mike@hark.digital")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/** The one admin who IS Mother Superior; other admins sign in as "Admin". */

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
    if (!res.ok) {
      // Signed out (401 on the sign-in page) or a server hiccup: DON'T stay
      // latched, or the roster would read empty for the whole session. The
      // per-navigation ensureRoster() retries until a fetch actually lands.
      rosterFetched = false;
      return;
    }
    const { players } = (await res.json()) as { players: Partial<Participant>[] };
    liveRoster = players.map((p) => ({
      id: p.id!,
      name: p.name ?? "",
      email: p.email,
      nickname: p.nickname ?? "",
      avatarColor: p.avatarColor ?? "#78838d",
      ...(p.memberIds ? { memberIds: p.memberIds } : {}),
      ...(p.members ? { members: p.members } : {}),
    }));
    emit();
  } catch {
    rosterFetched = false; // offline: retry on the next navigation
  }
}

/** Kick off the roster fetch in the live area (no-op in demo/SSR). Latches
 * only while a fetch is pending or has succeeded; failures retry on the
 * next call (RosterSync fires one per navigation). */
export function ensureRoster(): void {
  if (isDemoArea() || typeof window === "undefined" || rosterFetched) return;
  rosterFetched = true;
  void refreshRoster();
}

/** The playing roster for the current area. */
export function poolPlayers(): Participant[] {
  return isDemoArea() ? PLAYERS : (liveRoster ?? []);
}

/** False while the live roster has never been fetched successfully: the UI
 * can tell "still loading" apart from "loaded and genuinely empty". */
export function rosterLoaded(): boolean {
  return isDemoArea() || liveRoster !== null;
}

/** Roster including the Commissioner. */
export function poolEveryone(): Participant[] {
  return isDemoArea() ? EVERYONE : [MOTHER, ...(liveRoster ?? [])];
}

/**
 * The entry an id belongs to. `id` is normally the entry's own id; on a
 * shared entry the second person's account id resolves here too, so their
 * session, and any pick ever filed under it, lands on the shared entry.
 */
export function poolParticipant(id: string): Participant | undefined {
  const all = poolEveryone();
  return all.find((p) => p.id === id) ?? all.find((p) => p.memberIds?.includes(id));
}

/** Every name on an entry: one person, or both on a shared entry. ADMIN-ONLY. */
export function memberNames(p: Participant): string[] {
  const names = (p.members ?? []).map((m) => m.name).filter(Boolean);
  return names.length > 0 ? names : [p.name].filter(Boolean);
}

/** Every address on an entry, primary first. ADMIN-ONLY. */
export function memberEmails(p: Participant): string[] {
  const emails = (p.members ?? []).map((m) => m.email ?? "").filter(Boolean);
  return emails.length > 0 ? emails : [p.email ?? ""].filter(Boolean);
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
/** Optimistic picks the server refused: never restored as "the previous pick". */
const rejectedSubs = new WeakSet<Submission>();
/** Refetch sequence: a response older than the newest request is dropped, so
 * a slow GET issued before a write cannot overwrite that write's result. */
let poolReq = 0;

export async function refreshPool(): Promise<void> {
  const id = ++poolReq;
  try {
    const res = await fetch("/api/pool", { cache: "no-store" });
    if (!res.ok) {
      poolFetched = false; // same retry rule as the roster: never latch a miss
      return;
    }
    const data = (await res.json()) as LivePool;
    if (id !== poolReq) return; // a newer refetch owns the cache now
    livePool = data;
    emit();
  } catch {
    poolFetched = false; // offline: retry on the next navigation
  }
}

export function ensurePool(): void {
  if (isDemoArea() || typeof window === "undefined" || poolFetched) return;
  poolFetched = true;
  void refreshPool();
}

/**
 * Both caches are views scoped to WHO fetched them: signed out gets the
 * public roster and pool, a member gets their own picks, an admin gets names,
 * emails, payments, and the house line. The sign-in page is public and
 * fetches while signed out, and Clerk then continues client-side, so the
 * module cache survives the sign-in. Re-key the caches on the viewer and
 * refetch the moment the identity changes; otherwise the nameless public
 * view would stick for the whole session.
 */
let fetchedViewer: string | null | undefined;
export function syncViewer(userId: string | null): void {
  if (fetchedViewer !== userId) {
    fetchedViewer = userId;
    rosterFetched = false;
    poolFetched = false;
  }
  ensureRoster();
  ensurePool();
}

/** POST one write; resolves true when the server accepted it. A successful
 * write triggers a refetch so the cache matches the database. */
function poolWrite(resource: string, data: unknown): Promise<boolean> {
  return fetch("/api/pool", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ resource, data }),
  })
    .then((res) => {
      if (res.ok) void refreshPool();
      return res.ok;
    })
    .catch(() => false);
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

/** True once the live pool (contests, picks, results) has arrived. */
export function poolLoaded(): boolean {
  return isDemoArea() || livePool !== null;
}

/**
 * The week the office is working on: the latest ungraded week with picks on
 * file, else currentWeek(). Unlike currentWeek() it does not jump ahead at
 * lock; a week stays put until it is graded.
 */
export function inboxWeek(): number {
  return (
    effectiveContests().findLast(
      (c) => c.status !== "graded" && effectiveSubmissions(c.week).length > 0,
    )?.week ?? currentWeek()
  );
}

/**
 * Week selector state that opens on inboxWeek(). The default is derived until
 * the live pool loads (the picks are not known at first paint), then latched,
 * so a pick landing for a later week cannot move the page mid-task.
 */
export function useInboxWeek(): [number, (week: number) => void] {
  useStoreVersion();
  const [picked, setPicked] = useState<number | null>(null);
  const week = picked ?? inboxWeek();
  useEffect(() => {
    if (picked == null && poolLoaded()) setPicked(week);
  }, [picked, week]);
  return [week, setPicked];
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
 *   LIVE: the Clerk session, and nothing else. Every account, admin or not,
 *   is a contestant under its own id: admin emails simply carry the office
 *   powers (grading, office entry, house line) on top of a normal player row.
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
  const isAdmin = !!email && ADMIN_EMAILS.includes(email);
  // The member's own nickname: the fetched roster row is freshest; Clerk's
  // client-side publicMetadata covers the window before the roster arrives.
  // (This must never be hardcoded empty — players could not see their own
  // Commissioner-assigned nickname.) name stays the account name: selfName()
  // may show you your own name, publicName() never renders it to others.
  // On a shared entry this resolves the signed-in account to the ENTRY, so
  // both people read and write the same pick. Falls back to the account's own
  // id before the roster lands; saveSubmission re-checks at write time.
  const fromRoster = poolParticipant(clerkUser.id);
  const entryId = fromRoster?.id ?? clerkUser.id;
  const metaNick = ((clerkUser.publicMetadata?.nickname as string | undefined) ?? "").trim();
  return {
    id: entryId,
    name: clerkUser.fullName ?? clerkUser.firstName ?? email ?? "Member",
    email,
    nickname: fromRoster?.nickname?.trim() || metaNick,
    avatarColor: fromRoster?.avatarColor ?? colorForId(entryId),
    ...(fromRoster?.memberIds ? { memberIds: fromRoster.memberIds } : {}),
    ...(fromRoster?.members ? { members: fromRoster.members } : {}),
    ...(isAdmin ? { isAdmin: true } : {}),
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
 * Contestants only. The office row (MOTHER's id: the demo commissioner, or a
 * stray house-line write) must never reach the grading engine, where its
 * scorePick would corrupt Closest-To/Exacto for the whole field. Live admins
 * pick under their own account ids and grade like anyone else.
 */
export function playerSubmissions(subs: Submission[]): Submission[] {
  return subs.filter((s) => !poolParticipant(s.userId)?.isAdmin);
}

/**
 * Baked submissions + anything saved in this browser. A local pick for the
 * same user+week replaces the baked one.
 */
/**
 * Fold any pick keyed to a member account onto the entry it belongs to. A row
 * written before two accounts were linked, or by an older client, is still
 * that entry's pick: without this it would be invisible to the counts and the
 * standings while still competing in the relative bonuses, which would quietly
 * corrupt Closest-To for the whole field. The entry's own row wins; failing
 * that, the later submission does.
 */
function foldOntoEntries(subs: Submission[]): Submission[] {
  const best = new Map<string, { sub: Submission; own: boolean }>();
  for (const s of subs) {
    const id = poolParticipant(s.userId)?.id ?? s.userId;
    const own = id === s.userId;
    const cur = best.get(id);
    const wins =
      !cur ||
      (own && !cur.own) ||
      (own === cur.own && cur.sub.submittedAtUTC.localeCompare(s.submittedAtUTC) < 0);
    if (wins) best.set(id, { sub: own ? s : { ...s, userId: id }, own });
  }
  return [...best.values()].map((x) => x.sub);
}

export function effectiveSubmissions(week: number): Submission[] {
  if (!isDemoArea()) {
    return playerSubmissions(
      foldOntoEntries((livePool?.submissions ?? []).filter((s) => s.week === week)),
    );
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

/**
 * Save a pick. Resolves true once it is on file. Live mode is optimistic: the
 * cache shows the pick at once (the office rail drops the name, the player's
 * own card flips to "locked in"), the server write follows, and a rejected
 * write rolls the cache back so nothing claims a pick that never landed.
 */
export async function saveSubmission(raw: Submission): Promise<boolean> {
  // One chokepoint for every write path (player, office, house line): a pick
  // belongs to the ENTRY, never to one account on a shared entry.
  const entryId = poolParticipant(raw.userId)?.id ?? raw.userId;
  const sub: Submission = entryId === raw.userId ? raw : { ...raw, userId: entryId };
  if (isDemoArea()) {
    const rest = localSubs().filter((s) => !(s.week === sub.week && s.userId === sub.userId));
    writeJSON(k("subs"), [...rest, sub]);
    return true;
  }
  const before = livePool;
  const prev = before?.submissions.find((s) => s.week === sub.week && s.userId === sub.userId);
  if (before) {
    livePool = {
      ...before,
      submissions: [
        ...before.submissions.filter((s) => !(s.week === sub.week && s.userId === sub.userId)),
        sub,
      ],
    };
    emit();
  }
  const ok = await poolWrite("submission", sub);
  // Roll back THIS entry only. Later optimistic writes carry the same object
  // through by reference, so it is still findable; a refetch replaces the
  // array with fresh objects, so server truth is never touched.
  if (!ok) rejectedSubs.add(sub);
  if (!ok && livePool && livePool.submissions.includes(sub)) {
    // Put the previous pick back unless it was itself an optimistic write the
    // server already refused (one still in flight is fine: its own failure
    // will find and remove it).
    const restore = prev && !rejectedSubs.has(prev) ? [prev] : [];
    livePool = {
      ...livePool,
      submissions: [...livePool.submissions.filter((s) => s !== sub), ...restore],
    };
    emit();
  }
  return ok;
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

/**
 * Import path: many nicknames, one roster refresh at the end. Returns how
 * many rows the server accepted. Nickname only; the API touches nothing else.
 */
export async function saveNicknames(
  entries: { userId: string; nickname: string }[],
): Promise<{ saved: number; failed: number }> {
  let saved = 0;
  let failed = 0;
  if (isDemoArea()) {
    const overlay = readJSON<Record<string, string>>(k("nicknames"), {});
    for (const e of entries) overlay[e.userId] = e.nickname;
    writeJSON(k("nicknames"), overlay);
    return { saved: entries.length, failed: 0 };
  }
  for (const e of entries) {
    try {
      const res = await fetch("/api/roster", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: e.userId, nickname: e.nickname }),
      });
      if (res.ok) saved++;
      else failed++;
    } catch {
      failed++;
    }
  }
  await refreshRoster();
  return { saved, failed };
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

export function publishMothersLine(contest: Contest, line: Submission, says: string) {
  // The house line is the office's, not any one admin's: it is stored under
  // MOTHER's id so it never collides with an admin's own graded pick.
  const sub: Submission = { ...line, userId: MOTHER.id };
  // Her Pickum winners for every game but the Lions game, in slate order.
  const pickum = contest.questions.flatMap((q) => {
    if (q.kind !== "pickem") return [];
    const a = line.answers[q.id];
    const map = (typeof a === "object" && a != null ? a : {}) as Record<string, TeamAbbr>;
    return q.games.filter((g) => !isLionsPickemGame(g) && map[g.id]).map((g) => map[g.id]);
  });
  const updated: Contest = {
    ...contest,
    motherSays: says || undefined,
    motherPickum: pickum.length > 0 ? pickum : undefined,
  };
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
