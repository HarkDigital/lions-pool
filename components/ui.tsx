import type { ReactNode } from "react";

/* Shared primitives. Every page builds from these so the whole site reads
   as one system. Keep props minimal; use className for one-off spacing. */

export function Card({
  children,
  className = "",
  accent = false,
}: {
  children: ReactNode;
  className?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-panel ${
        accent ? "border-honolulu/60 shadow-[0_0_40px_-12px_rgba(0,118,182,0.45)]" : "border-edge"
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  kicker,
  children,
  className = "",
}: {
  kicker?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {kicker && (
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky">{kicker}</div>
      )}
      <h2 className="display text-3xl sm:text-4xl">{children}</h2>
    </div>
  );
}

export function Pill({
  children,
  tone = "default",
  className = "",
}: {
  children: ReactNode;
  tone?: "default" | "blue" | "gold" | "win" | "loss";
  className?: string;
}) {
  const tones: Record<string, string> = {
    default: "border-edge-2 text-fog",
    blue: "border-honolulu/60 bg-honolulu/15 text-sky",
    gold: "border-gold/50 bg-gold/10 text-gold",
    win: "border-win/50 bg-win/10 text-win",
    loss: "border-loss/50 bg-loss/10 text-loss",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** The signature "points divide" chip: what a pick pays. */
export function PointsChip({ points, hit }: { points: number; hit?: boolean }) {
  const val = Number.isInteger(points) ? points : points.toFixed(1);
  return (
    <span
      className={`display inline-flex min-w-14 items-center justify-center rounded-lg border px-2 py-0.5 text-xl leading-6 ${
        hit === undefined
          ? "border-honolulu/50 bg-honolulu/10 text-sky"
          : hit
            ? "border-win/60 bg-win/10 text-win"
            : "border-edge text-fog opacity-60"
      }`}
    >
      +{val}
    </span>
  );
}

export function Btn({
  children,
  onClick,
  kind = "primary",
  type = "button",
  disabled = false,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: "primary" | "ghost" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const kinds: Record<string, string> = {
    primary:
      "bg-honolulu text-white hover:bg-honolulu-deep border-transparent shadow-[0_4px_20px_-6px_rgba(0,118,182,0.7)]",
    ghost: "bg-transparent text-silver hover:text-chalk hover:border-edge-2 border-edge",
    danger: "bg-loss/15 text-loss hover:bg-loss/25 border-loss/40",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${kinds[kind]} ${className}`}
    >
      {children}
    </button>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-edge-2 p-10 text-center">
      <div className="display text-2xl text-fog">{title}</div>
      {children && <div className="mt-2 text-sm text-fog">{children}</div>}
    </div>
  );
}
