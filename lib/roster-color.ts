// Deterministic avatar color for a real (Clerk) member. Same CVD-validated
// categorical palette the demo roster uses, keyed by a stable hash of the
// user id so a member's color never changes between renders or sessions.

const PALETTE = [
  "#3987e5",
  "#d95926",
  "#199e70",
  "#c98500",
  "#d55181",
  "#008300",
  "#9085e9",
  "#e66767",
  "#0891b2",
  "#b45309",
];

export function colorForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
