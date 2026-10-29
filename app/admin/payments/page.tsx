"use client";

// ---------------------------------------------------------------------------
// /admin/payments/ - season buy-in bookkeeping. One record per player via
// paymentFor(); Mother Superior flips Paid/Unpaid, the timestamp is stamped
// automatically, and an optional note persists on blur. The live roster is
// empty until the backend lands, so the ledger explains itself instead of
// rendering a bare table; with players present it is only ever paid or unpaid.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { AdminGate } from "@/components/AdminGate";
import { SortTh, sortRows, useSort } from "@/components/sort";
import { Btn, Card, EmptyState, Pill, SectionTitle } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { paymentFor, poolPlayers, publicName, savePayment, useStoreVersion } from "@/lib/store";
import type { Participant } from "@/lib/types";

/** The season buy-in, per player. */
const BUY_IN = 100;
const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

const NOTE_INPUT =
  "w-40 rounded-lg border border-edge bg-panel-2 px-3 py-1.5 text-xs text-chalk outline-none transition placeholder:text-fog focus:border-honolulu/60 sm:w-52";

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
  // The roster (which renders the rows) and the pool (which holds the notes)
  // arrive on separate fetches, so the stored note usually lands AFTER the
  // row's first render. Follow it: otherwise the box reads empty after a
  // reload, and a stray blur then saves that emptiness over the real note.
  useEffect(() => {
    setNote(rec.note ?? "");
  }, [rec.note]);

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

type PayCol = "player" | "status" | "marked" | "note";

function PaymentsInner() {
  useStoreVersion();
  // AdminGate guarantees hydration, so the area-aware roster is safe to read.
  const players = poolPlayers();
  const { sort, toggle } = useSort<PayCol>();

  if (players.length === 0) {
    return (
      <div className="space-y-6">
        <SectionTitle kicker="Mother Superior's Office">Payments</SectionTitle>
        <EmptyState title="No players yet">
          Accounts arrive with the backend. Nobody owes anything, which Mother Superior finds
          suspicious but technically correct.
        </EmptyState>
      </div>
    );
  }

  const paidCount = players.filter((p) => paymentFor(p.id).paid).length;
  const allIn = paidCount === players.length;
  const sorted = sortRows(players, sort, {
    player: (p) => publicName(p),
    status: (p) => paymentFor(p.id).paid,
    // The cell only shows a timestamp for paid rows; unpaid rows sort as blank.
    marked: (p) => {
      const rec = paymentFor(p.id);
      return rec.paid ? rec.markedAtUTC : undefined;
    },
    note: (p) => paymentFor(p.id).note,
  });

  return (
    <div className="space-y-6">
      <SectionTitle kicker="Mother Superior's Office">Payments</SectionTitle>

      <Card className="flex flex-wrap items-center justify-between gap-6 p-5">
        <div className="flex flex-wrap gap-x-10 gap-y-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.15em] text-fog">
              Season buy-in
            </div>
            <div className="display mt-1 text-3xl">
              Paid {paidCount}/{players.length}
            </div>
            <div className="mt-1 text-xs text-fog">{usd(BUY_IN)} per player</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.15em] text-fog">
              Collected
            </div>
            <div className="display mt-1 text-3xl text-win">{usd(paidCount * BUY_IN)}</div>
            <div className="mt-1 text-xs text-fog">
              of {usd(players.length * BUY_IN)} for the full pool
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.15em] text-fog">
              Outstanding
            </div>
            <div className={`display mt-1 text-3xl ${allIn ? "text-fog" : "text-loss"}`}>
              {usd((players.length - paidCount) * BUY_IN)}
            </div>
            <div className="mt-1 text-xs text-fog">
              {allIn ? "Nothing owed." : `${players.length - paidCount} still to collect`}
            </div>
          </div>
        </div>
        <Pill tone={allIn ? "win" : "loss"}>
          {allIn ? "All in" : `${players.length - paidCount} outstanding`}
        </Pill>
      </Card>

      <Card className="overflow-hidden">
        <div className="table-scroll">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-edge text-xs uppercase tracking-wider text-fog">
                <SortTh k="player" sort={sort} onSort={toggle} className="px-4 py-3">
                  Player
                </SortTh>
                <SortTh k="status" sort={sort} onSort={toggle} className="px-4 py-3">
                  Status
                </SortTh>
                <th className="px-4 py-3">Mark</th>
                <SortTh k="marked" sort={sort} onSort={toggle} className="px-4 py-3">
                  Marked
                </SortTh>
                <SortTh k="note" sort={sort} onSort={toggle} className="px-4 py-3">
                  Note
                </SortTh>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <PaymentRow key={p.id} p={p} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
