// ---------------------------------------------------------------------------
// The LIVE 2026 season, as it stands before kickoff: every week drafted from
// the real schedule with slate designs prefilled in the 2025 style (Mother
// Superior edits or replaces them in the Contest Builder), no players, no
// picks, no results. Until the backend lands, live-mode changes persist in
// this browser only; the demo simulation lives separately under /demo/.
// ---------------------------------------------------------------------------

import type { Contest, Participant } from "./types";
import { CONTESTS, MOTHER } from "./demo-data";

export { MOTHER };

/** No player accounts yet; the roster arrives with the backend + sign-in. */
export const LIVE_PLAYERS: Participant[] = [];

export const LIVE_EVERYONE: Participant[] = [MOTHER];

/**
 * Same slate designs the demo showcases, but nothing posted, nothing graded:
 * every week starts as a draft for Mother Superior to shape and open.
 */
export const LIVE_CONTESTS: Contest[] = CONTESTS.map((c) => ({
  ...c,
  status: "draft",
}));
