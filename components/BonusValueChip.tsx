"use client";

// Displays a score-bonus payout using the season's configured values (admin
// Scoring Settings), falling back to the rulebook defaults pre-hydration.

import { DEFAULT_BONUS_VALUES, type BonusValues } from "@/lib/scoring";
import { bonusValues, useHydrated, useStoreVersion } from "@/lib/store";
import { signedPts } from "@/lib/format";

export function BonusValueChip({
  k,
  tone,
}: {
  k: keyof BonusValues;
  tone: "gold" | "loss";
}) {
  useStoreVersion();
  const hydrated = useHydrated();
  const v = hydrated ? bonusValues()[k] : DEFAULT_BONUS_VALUES[k];
  return (
    <span
      className={`display inline-flex min-w-14 items-center justify-center rounded-lg border px-2 py-0.5 text-xl leading-6 ${
        tone === "gold" ? "border-gold/50 bg-gold/10 text-gold" : "border-loss/50 bg-loss/10 text-loss"
      }`}
    >
      {signedPts(v)}
    </span>
  );
}
