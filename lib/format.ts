// Small display helpers shared across pages. All dates render in Eastern
// time — the pool runs on Detroit's clock.

const ET: Intl.DateTimeFormatOptions = { timeZone: "America/Detroit" };

export function fmtGameDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    ...ET,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function fmtKickoff(iso: string, timeTBD?: boolean): string {
  if (timeTBD) return "Time TBD";
  return new Date(iso).toLocaleTimeString("en-US", {
    ...ET,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function fmtDateTime(iso: string, timeTBD?: boolean): string {
  return `${fmtGameDay(iso)} · ${fmtKickoff(iso, timeTBD)}`;
}

/** 6.5 -> "6.5", 8 -> "8" */
export function fmtPts(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function signedPts(n: number): string {
  return n >= 0 ? `+${fmtPts(n)}` : `−${fmtPts(Math.abs(n))}`;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
