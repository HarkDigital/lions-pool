"use client";

// ---------------------------------------------------------------------------
// /admin/payments/ - season buy-in bookkeeping. One record per player via
// paymentFor(); Mother Superior flips Paid/Unpaid, the timestamp is stamped
// automatically, and an optional note persists on blur. The roster is fixed,
// so there is never an empty state, only an unpaid one.
// ---------------------------------------------------------------------------

import { useState } from "react";
import { AdminGate } from "@/components/AdminGate";
import { Btn, Card, Pill, SectionTitle } from "@/components/ui";
import { PLAYERS } from "@/lib/demo-data";
import { fmtDateTime } from "@/lib/format";
import { paymentFor, publicName, savePayment, useHydrated, useStoreVersion } from "@/lib/store";
import type { Participant } from "@/lib/types";

const NOTE_INPUT =
  "w-52 rounded-lg border border-edge bg-panel-2 px-3 py-1.5 text-xs text-chalk outline-none transition placeholder:text-fog focus:border-honolulu/60";

export default function PaymentsPage() {
  return (
    <AdminGate>
      <PaymentsInner />
    </AdminGate>
  );
}

// --- One ledger line per player ----------------------------------------------

function PaymentRow({ p }: { p: Participant }) {
  const rec = paymentFor(p.id);
  const [note, setNote] = useState(rec.note ?? "");

  const toggle = () => {
    savePayment({
      userId: p.id,
      paid: !rec.paid,
      markedAtUTC: new Date().toISOString(),
      note: rec.note,
    });
  };

  const persistNote = () => {
    const trimmed = note.trim();
    if (trimmed === (rec.note ?? "")) return;
    savePayment({ ...rec, note: trimmed || undefined });
    setNote(trimmed);
  };

  return (
    <tr
      className={`border-b border-edge border-l-2 last:border-b-0 ${
        rec.paid ? "border-l-transparent" : "border-l-loss/40"
      }`}
    >
      <td className="px-4 py-3 align-middle">
        <span className="flex items-center gap-2.5 whitespace-nowrap">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: p.avatarColor }}
          />
          <span>
            <span className="block font-bold text-chalk">{publicName(p)}</span>
            <span className="block text-xs text-fog">{p.name}</span>
          </span>
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 align-middle">
        <Pill tone={rec.paid ? "win" : "loss"}>{rec.paid ? "Paid" : "Unpaid"}</Pill>
      </td>
      <td className="whitespace-nowrap px-4 py-3 align-middle">
        <Btn
          kind={rec.paid ? "ghost" : "primary"}
          onClick={toggle}
          className="px-3 py-1.5 text-xs"
        >
          {rec.paid ? "Mark unpaid" : "Mark paid"}
        </Btn>
      </td>
      <td className="whitespace-nowrap px-4 py-3 align-middle text-xs text-fog">
        {rec.paid && rec.markedAtUTC ? fmtDateTime(rec.markedAtUTC) : "Still waiting."}
      </td>
      <td className="px-4 py-3 align-middle">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={persistNote}
          placeholder="Optional note (cash, app, IOU)"
          aria-label={`Payment note for ${publicName(p)}`}
          className={NOTE_INPUT}
        />
      </td>
    </tr>
  );
}

// --- Page --------------------------------------------------------------------

function PaymentsInner() {
  useStoreVersion();
  const hydrated = useHydrated();

  if (!hydrated) {
    return (
      <Card className="p-10 text-center">
        <div className="text-sm text-fog">Opening the ledger…</div>
      </Card>
    );
  }

  const paidCount = PLAYERS.filter((p) => paymentFor(p.id).paid).length;
  const allIn = paidCount === PLAYERS.length;

  return (
    <div className="space-y-6">
      <SectionTitle kicker="Mother Superior's Office">Payments</SectionTitle>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.15em] text-fog">
            Season buy-in
          </div>
          <div className="display mt-1 text-3xl">
            Paid {paidCount}/{PLAYERS.length}
          </div>
          <div className="mt-1 text-xs text-fog">
            Mother Superior does not chase money twice.
          </div>
        </div>
        <Pill tone={allIn ? "win" : "loss"}>
          {allIn ? "All in" : `${PLAYERS.length - paidCount} outstanding`}
        </Pill>
      </Card>

      <Card className="overflow-hidden">
        <div className="table-scroll">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-edge text-xs uppercase tracking-wider text-fog">
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Mark</th>
                <th className="px-4 py-3">Marked</th>
                <th className="px-4 py-3">Note</th>
              </tr>
            </thead>
            <tbody>
              {PLAYERS.map((p) => (
                <PaymentRow key={p.id} p={p} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="border-dashed p-4 text-xs leading-relaxed text-fog">
        <span className="font-bold uppercase tracking-wider text-sky">House policy: </span>
        the buy-in is due before the first kickoff. Unpaid is not a moral judgment, it is a fact
        with a red border. Settle up and the border goes away.
      </Card>
    </div>
  );
}
