import type { TeamAbbr } from "./types";

export interface TeamInfo {
  abbr: TeamAbbr;
  name: string; // full display name
  short: string; // "Saints"
  color: string; // primary hex, no '#'
}

// Only teams the pool actually touches in 2026 (Lions opponents + pick'em
// slates) plus the rest of the league so the admin contest builder can offer
// any matchup.
const T = (abbr: string, name: string, short: string, color: string): TeamInfo => ({
  abbr,
  name,
  short,
  color,
});

export const TEAMS: Record<TeamAbbr, TeamInfo> = {
  ARI: T("ARI", "Arizona Cardinals", "Cardinals", "a40227"),
  ATL: T("ATL", "Atlanta Falcons", "Falcons", "a71930"),
  BAL: T("BAL", "Baltimore Ravens", "Ravens", "29126f"),
  BUF: T("BUF", "Buffalo Bills", "Bills", "00338d"),
  CAR: T("CAR", "Carolina Panthers", "Panthers", "0085ca"),
  CHI: T("CHI", "Chicago Bears", "Bears", "0b1c3a"),
  CIN: T("CIN", "Cincinnati Bengals", "Bengals", "fb4f14"),
  CLE: T("CLE", "Cleveland Browns", "Browns", "472a08"),
  DAL: T("DAL", "Dallas Cowboys", "Cowboys", "002a5c"),
  DEN: T("DEN", "Denver Broncos", "Broncos", "0a2343"),
  DET: T("DET", "Detroit Lions", "Lions", "0076b6"),
  GB: T("GB", "Green Bay Packers", "Packers", "204e32"),
  HOU: T("HOU", "Houston Texans", "Texans", "00143f"),
  IND: T("IND", "Indianapolis Colts", "Colts", "003b75"),
  JAX: T("JAX", "Jacksonville Jaguars", "Jaguars", "007487"),
  KC: T("KC", "Kansas City Chiefs", "Chiefs", "e31837"),
  LAC: T("LAC", "Los Angeles Chargers", "Chargers", "0080c6"),
  LAR: T("LAR", "Los Angeles Rams", "Rams", "003594"),
  LV: T("LV", "Las Vegas Raiders", "Raiders", "000000"),
  MIA: T("MIA", "Miami Dolphins", "Dolphins", "008e97"),
  MIN: T("MIN", "Minnesota Vikings", "Vikings", "4f2683"),
  NE: T("NE", "New England Patriots", "Patriots", "002a5c"),
  NO: T("NO", "New Orleans Saints", "Saints", "d3bc8d"),
  NYG: T("NYG", "New York Giants", "Giants", "003c7f"),
  NYJ: T("NYJ", "New York Jets", "Jets", "115740"),
  PHI: T("PHI", "Philadelphia Eagles", "Eagles", "06424d"),
  PIT: T("PIT", "Pittsburgh Steelers", "Steelers", "000000"),
  SEA: T("SEA", "Seattle Seahawks", "Seahawks", "002a5c"),
  SF: T("SF", "San Francisco 49ers", "49ers", "aa0000"),
  TB: T("TB", "Tampa Bay Buccaneers", "Buccaneers", "bd1c36"),
  TEN: T("TEN", "Tennessee Titans", "Titans", "0c2340"),
  WSH: T("WSH", "Washington Commanders", "Commanders", "5a1414"),
};

/** ESPN's public logo CDN — same art the team sites use. */
export function teamLogoUrl(abbr: TeamAbbr): string {
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${abbr.toLowerCase()}.png`;
}

export function teamInfo(abbr: TeamAbbr): TeamInfo {
  return TEAMS[abbr] ?? T(abbr, abbr, abbr, "666666");
}
