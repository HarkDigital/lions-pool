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

/** Score displays use a plain hyphen, pool-style: "34-17". */
export function fmtScore(a: number, b: number): string {
  return `${a}-${b}`;
}

// --- Eastern-time datetime-local plumbing -----------------------------------
// The pool runs on Detroit's clock no matter whose laptop is typing. These
// convert between UTC ISO strings and "YYYY-MM-DDTHH:mm" wall-clock Eastern
// values for <input type="datetime-local">, DST handled via Intl.

function etWallParts(utcMs: number): { y: number; mo: number; d: number; h: number; mi: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Detroit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { y: get("year"), mo: get("month"), d: get("day"), h: get("hour") % 24, mi: get("minute") };
}

/** UTC ISO -> "YYYY-MM-DDTHH:mm" Eastern wall clock (datetime-local value). */
export function utcToEtInput(iso: string): string {
  const { y, mo, d, h, mi } = etWallParts(Date.parse(iso));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${y}-${p(mo)}-${p(d)}T${p(h)}:${p(mi)}`;
}

/** "YYYY-MM-DDTHH:mm" Eastern wall clock -> UTC ISO. Two-pass, DST-safe. */
export function etInputToUtc(local: string): string {
  const [datePart, timePart] = local.split("T");
  const [y, mo, d] = datePart.split("-").map(Number);
  const [h, mi] = timePart.split(":").map(Number);
  const wallAsUtc = Date.UTC(y, mo - 1, d, h, mi);
  // First guess: assume the wall time were UTC, see what ET wall clock that is,
  // and correct by the difference; repeat once to settle DST boundaries.
  let utc = wallAsUtc;
  for (let i = 0; i < 2; i++) {
    const w = etWallParts(utc);
    const seen = Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi);
    utc += wallAsUtc - seen;
  }
  return new Date(utc).toISOString().slice(0, 16) + "Z";
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
