"use client";

// ---------------------------------------------------------------------------
// /admin/players/ - Players & Nicknames. The only room where real names and
// emails render. Every public surface shows the nickname via publicName();
// Mother Superior sets and changes nicknames here, and nowhere else.
// ---------------------------------------------------------------------------

import { useRef, useState } from "react";
import { AdminGate } from "@/components/AdminGate";
import { Btn, Card, SectionTitle } from "@/components/ui";
import { PLAYERS } from "@/lib/demo-data";
import { publicName, saveNickname, useHydrated, useStoreVersion } from "@/lib/store";
import type { Participant } from "@/lib/types";

const INPUT =
  "w-44 rounded-lg border border-edge bg-panel-2 px-3 py-1.5 text-sm font-semibold text-chalk outline-none transition focus:border-honolulu/60";

export default function PlayersPage() {
  return (
    <AdminGate>
      <PlayersInner />
    </AdminGate>
  );
}

// --- One editable nickname per row ------------------------------------------

function NicknameCell({ p }: { p: Participant }) {
  const current = publicName(p);
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

function PlayersInner() {
  useStoreVersion();
  const hydrated = useHydrated();

  if (!hydrated) {
    return (
      <Card className="p-10 text-center">
        <div className="text-sm text-fog">Pulling the roster file…</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <SectionTitle kicker="Mother Superior's Office">Players &amp; Nicknames</SectionTitle>

      <Card className="overflow-hidden">
        <div className="border-b border-edge px-6 py-4">
          <h3 className="display text-2xl">The Roster File</h3>
          <p className="mt-1 text-xs text-fog">
            Real names and emails never leave this room. The pool only ever sees the nickname,
            and only Mother Superior can change it.
          </p>
        </div>
        <div className="table-scroll">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-edge text-xs uppercase tracking-wider text-fog">
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Nickname</th>
              </tr>
            </thead>
            <tbody>
              {PLAYERS.map((p) => (
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
                    {p.email}
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

      <Card className="border-dashed p-4 text-xs leading-relaxed text-fog">
        <span className="font-bold uppercase tracking-wider text-sky">Where nicknames go: </span>
        a saved nickname takes effect immediately on the Nums, the home page, and My Picks. No
        refresh, no waiting period, no appeals process.
      </Card>
    </div>
  );
}
