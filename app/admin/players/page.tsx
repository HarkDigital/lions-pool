"use client";

// ---------------------------------------------------------------------------
// /admin/players/ - Players & Nicknames. The only room where real names and
// emails render. Every public surface shows the nickname via publicName();
// Mother Superior sets and changes nicknames here, and nowhere else.
// ---------------------------------------------------------------------------

import { useRef, useState } from "react";
import { AdminGate } from "@/components/AdminGate";
import { SortTh, sortRows, useSort } from "@/components/sort";
import { Btn, Card, EmptyState, Pill, SectionTitle } from "@/components/ui";
import { downloadCsv, parseCsv, toCsv } from "@/lib/csv";
import {
  memberEmails,
  poolPlayers,
  saveNickname,
  saveNicknames,
  useStoreVersion,
} from "@/lib/store";
import type { Participant } from "@/lib/types";

// --- CSV: the roster file out, nicknames back in ----------------------------

const CSV_HEADER = ["Account id", "Name", "Email", "Nickname"];

function rosterCsv(players: Participant[]): string {
  return toCsv([
    CSV_HEADER,
    ...players.map((p) => [p.id, p.name, memberEmails(p).join("; "), p.nickname]),
  ]);
}

interface ImportChange {
  player: Participant;
  nickname: string;
}
interface ImportPlan {
  changes: ImportChange[];
  unchanged: number;
  blank: number;
  unmatched: string[];
  error?: string;
}

/**
 * Read a nickname CSV against the roster. Rows match by account id first,
 * then by email (case-insensitive). ONLY the Nickname column is read; Name
 * and Email columns are matching keys at most and are never written back.
 */
function planImport(text: string, players: Participant[]): ImportPlan {
  const rows = parseCsv(text);
  if (rows.length === 0) return { changes: [], unchanged: 0, blank: 0, unmatched: [], error: "The file is empty." };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const idCol = col("account id", "id", "user id", "userid");
  const emailCol = col("email", "email address");
  const nickCol = col("nickname", "nick");
  if (nickCol < 0)
    return { changes: [], unchanged: 0, blank: 0, unmatched: [], error: 'No "Nickname" column in the header row.' };
  if (idCol < 0 && emailCol < 0)
    return { changes: [], unchanged: 0, blank: 0, unmatched: [], error: 'Need an "Account id" or "Email" column to match rows to players.' };

  const byId = new Map(players.map((p) => [p.id, p]));
  // Every address on an entry matches, including the partner's on a shared
  // entry — the roster export writes both, so an import must read both back.
  const byEmail = new Map<string, Participant>();
  for (const p of players) {
    for (const e of memberEmails(p)) byEmail.set(e.toLowerCase(), p);
  }
  const plan: ImportPlan = { changes: [], unchanged: 0, blank: 0, unmatched: [] };
  const seen = new Set<string>();
  for (const r of rows.slice(1)) {
    const id = idCol >= 0 ? (r[idCol] ?? "").trim() : "";
    const email = emailCol >= 0 ? (r[emailCol] ?? "").trim().toLowerCase() : "";
    const player = (id && byId.get(id)) || (email && byEmail.get(email)) || null;
    if (!player) {
      plan.unmatched.push(id || email || r.join(", "));
      continue;
    }
    if (seen.has(player.id)) continue; // first row for a player wins
    seen.add(player.id);
    const nickname = (r[nickCol] ?? "").trim();
    if (!nickname) {
      plan.blank++;
      continue;
    }
    if (nickname === player.nickname.trim()) {
      plan.unchanged++;
      continue;
    }
    plan.changes.push({ player, nickname });
  }
  return plan;
}

function RosterTools({ players }: { players: Participant[] }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setResult(null);
    setFileName(file.name);
    setPlan(planImport(await file.text(), players));
    if (fileRef.current) fileRef.current.value = "";
  };

  const apply = async () => {
    if (!plan || plan.changes.length === 0) return;
    setBusy(true);
    const { saved, failed } = await saveNicknames(
      plan.changes.map((c) => ({ userId: c.player.id, nickname: c.nickname })),
    );
    setBusy(false);
    setPlan(null);
    setResult(
      failed === 0
        ? `${saved} nickname${saved === 1 ? "" : "s"} updated from ${fileName}.`
        : `${saved} updated, ${failed} failed. Check the roster and try those again.`,
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Btn
          kind="ghost"
          onClick={() => downloadCsv("lions-pool-roster.csv", rosterCsv(players))}
          className="px-3 py-1.5 text-xs"
        >
          Export CSV ({players.length})
        </Btn>
        <Btn kind="ghost" onClick={() => fileRef.current?.click()} className="px-3 py-1.5 text-xs">
          Import nicknames…
        </Btn>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        {result && <span className="text-xs font-semibold text-win">{result}</span>}
      </div>

      {plan && (
        <Card accent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky">
                Import preview: nothing saved yet
              </div>
              <div className="mt-1 text-sm text-fog">{fileName}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Btn onClick={() => void apply()} disabled={busy || plan.changes.length === 0}>
                {busy
                  ? "Saving…"
                  : `Apply ${plan.changes.length} change${plan.changes.length === 1 ? "" : "s"}`}
              </Btn>
              <Btn kind="ghost" onClick={() => setPlan(null)} disabled={busy}>
                Cancel
              </Btn>
            </div>
          </div>

          {plan.error ? (
            <p className="mt-4 text-sm font-semibold text-loss">{plan.error}</p>
          ) : (
            <>
              {plan.changes.length > 0 ? (
                <ul className="mt-4 divide-y divide-edge text-sm">
                  {plan.changes.map((c) => (
                    <li key={c.player.id} className="flex flex-wrap items-center gap-3 py-2">
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: c.player.avatarColor }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold text-chalk">{c.player.name}</span>
                        {memberEmails(c.player).length > 0 && (
                          <span className="ml-2 text-xs text-fog">
                            {memberEmails(c.player).join(", ")}
                          </span>
                        )}
                      </span>
                      <span className="text-fog">
                        {c.player.nickname.trim() || "Awaiting nickname"}
                      </span>
                      <span className="text-fog">→</span>
                      <span className="font-bold text-sky">{c.nickname}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-fog">Nothing to change.</p>
              )}
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {plan.unchanged > 0 && <Pill>{plan.unchanged} already match</Pill>}
                {plan.blank > 0 && <Pill>{plan.blank} blank, skipped</Pill>}
                {plan.unmatched.length > 0 && (
                  <Pill tone="loss">{plan.unmatched.length} not on the roster</Pill>
                )}
              </div>
              {plan.unmatched.length > 0 && (
                <p className="mt-2 text-xs text-fog">
                  Not matched: {plan.unmatched.slice(0, 8).join(", ")}
                  {plan.unmatched.length > 8 ? ", …" : ""}
                </p>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}

const INPUT =
  "w-36 rounded-lg border border-edge bg-panel-2 px-3 py-1.5 text-sm font-semibold text-chalk outline-none transition focus:border-honolulu/60 sm:w-44";

export default function PlayersPage() {
  return (
    <AdminGate>
      <PlayersInner />
    </AdminGate>
  );
}

// --- One editable nickname per row ------------------------------------------

function NicknameCell({ p }: { p: Participant }) {
  // The raw assigned nickname only. The "Awaiting nickname" fallback is a
  // placeholder here, never a value — nothing to erase before typing.
  const current = (p.nickname ?? "").trim();
  const [value, setValue] = useState(current);
  const [saved, setSaved] = useState(false);
  const timer = useRef<number | null>(null);

  const trimmed = value.trim();
  const dirty = trimmed !== "" && trimmed !== current;

  const save = () => {
    if (!dirty) return;
    saveNickname(p.id, trimmed);
    setValue(trimmed);
    setSaved(true);
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setSaved(false), 2000);
  };

  return (
    <span className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
        }}
        placeholder="Awaiting nickname"
        aria-label={`Nickname for ${p.name}`}
        className={INPUT}
      />
      <Btn onClick={save} disabled={!dirty} className="px-3 py-1.5 text-xs">
        Save
      </Btn>
      <span
        aria-live="polite"
        className={`min-w-10 text-xs font-bold text-win transition-opacity ${saved ? "opacity-100" : "opacity-0"}`}
      >
        {saved ? "Saved" : ""}
      </span>
    </span>
  );
}

// --- Page --------------------------------------------------------------------

type RosterSortKey = "name" | "email" | "nickname";

function PlayersInner() {
  useStoreVersion();
  // AdminGate guarantees hydration, so the area-aware roster is safe to read.
  const players = poolPlayers();
  const { sort, toggle } = useSort<RosterSortKey>();

  if (players.length === 0) {
    return (
      <div className="space-y-6">
        <SectionTitle kicker="Mother Superior's Office">Players &amp; Nicknames</SectionTitle>
        <EmptyState title="No players yet">
          Accounts arrive with the backend. Until then the roster file is an empty folder, which
          is exactly how Mother Superior likes the paperwork.
        </EmptyState>
      </div>
    );
  }

  const sorted = sortRows(players, sort, {
    name: (p) => p.name,
    email: (p) => memberEmails(p).join(" "),
    // Same value NicknameCell seeds its input from; unassigned nicknames sink.
    nickname: (p) => (p.nickname ?? "").trim(),
  });

  return (
    <div className="space-y-6">
      <SectionTitle kicker="Mother Superior's Office">Players &amp; Nicknames</SectionTitle>

      <RosterTools players={players} />

      <Card className="overflow-hidden">
        <div className="border-b border-edge px-6 py-4">
          <h3 className="display text-2xl">The Roster File</h3>
        </div>
        <div className="table-scroll">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-edge text-xs uppercase tracking-wider text-fog">
                <SortTh k="name" sort={sort} onSort={toggle} className="px-4 py-3">
                  Player
                </SortTh>
                <SortTh k="email" sort={sort} onSort={toggle} className="px-4 py-3">
                  Email
                </SortTh>
                <SortTh k="nickname" sort={sort} onSort={toggle} className="px-4 py-3">
                  Nickname
                </SortTh>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.id} className="border-b border-edge last:border-0">
                  <td className="px-4 py-3 align-middle">
                    <span className="flex items-center gap-2.5 whitespace-nowrap">
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: p.avatarColor }}
                      />
                      <span className="font-semibold text-chalk">{p.name}</span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 align-middle text-xs text-fog">
                    {memberEmails(p).map((e) => (
                      <span key={e} className="block">
                        {e}
                      </span>
                    ))}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <NicknameCell p={p} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-edge px-6 py-4 text-xs leading-relaxed text-fog">
          Players cannot set or change their own nickname. Ever. Requests may be submitted in
          writing, where they will be read, considered, and declined.
        </div>
      </Card>

    </div>
  );
}
