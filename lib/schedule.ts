import type { ScheduleGame } from "./types";

/**
 * Detroit Lions 2026 regular-season schedule (source: ESPN, July 2026).
 * Week 6 is the bye. Week 10 is the Munich, Germany international game.
 * Week 18 kickoff time is TBD until the league flexes it.
 */
export const SEASON = 2026;

export const LIONS_SCHEDULE: ScheduleGame[] = [
  { week: 1, dateUTC: "2026-09-13T17:00Z", home: true, opponent: "NO", venue: "Ford Field", city: "Detroit, MI" },
  { week: 2, dateUTC: "2026-09-18T00:15Z", home: false, opponent: "BUF", venue: "Highmark Stadium", city: "Orchard Park, NY" },
  { week: 3, dateUTC: "2026-09-27T17:00Z", home: true, opponent: "NYJ", venue: "Ford Field", city: "Detroit, MI" },
  { week: 4, dateUTC: "2026-10-05T00:20Z", home: false, opponent: "CAR", venue: "Bank of America Stadium", city: "Charlotte, NC" },
  { week: 5, dateUTC: "2026-10-11T20:25Z", home: false, opponent: "ARI", venue: "State Farm Stadium", city: "Glendale, AZ" },
  { week: 7, dateUTC: "2026-10-25T20:25Z", home: true, opponent: "GB", venue: "Ford Field", city: "Detroit, MI" },
  { week: 8, dateUTC: "2026-11-01T18:00Z", home: true, opponent: "MIN", venue: "Ford Field", city: "Detroit, MI" },
  { week: 9, dateUTC: "2026-11-08T18:00Z", home: false, opponent: "MIA", venue: "Hard Rock Stadium", city: "Miami Gardens, FL" },
  { week: 10, dateUTC: "2026-11-15T14:30Z", home: true, neutral: true, opponent: "NE", venue: "FC Bayern Munich Stadium", city: "Munich", country: "Germany" },
  { week: 11, dateUTC: "2026-11-22T18:00Z", home: true, opponent: "TB", venue: "Ford Field", city: "Detroit, MI" },
  { week: 12, dateUTC: "2026-11-26T18:00Z", home: true, opponent: "CHI", venue: "Ford Field", city: "Detroit, MI" },
  { week: 13, dateUTC: "2026-12-06T18:00Z", home: false, opponent: "ATL", venue: "Mercedes-Benz Stadium", city: "Atlanta, GA" },
  { week: 14, dateUTC: "2026-12-13T18:00Z", home: true, opponent: "TEN", venue: "Ford Field", city: "Detroit, MI" },
  { week: 15, dateUTC: "2026-12-21T01:20Z", home: false, opponent: "MIN", venue: "U.S. Bank Stadium", city: "Minneapolis, MN" },
  { week: 16, dateUTC: "2026-12-29T01:15Z", home: true, opponent: "NYG", venue: "Ford Field", city: "Detroit, MI" },
  { week: 17, dateUTC: "2027-01-03T21:25Z", home: false, opponent: "CHI", venue: "Soldier Field", city: "Chicago, IL" },
  { week: 18, dateUTC: "2027-01-10T18:00Z", home: false, opponent: "GB", venue: "Lambeau Field", city: "Green Bay, WI", timeTBD: true },
];

export const BYE_WEEK = 6;
export const ALL_WEEKS = Array.from({ length: 18 }, (_, i) => i + 1);

export function gameForWeek(week: number): ScheduleGame | undefined {
  return LIONS_SCHEDULE.find((g) => g.week === week);
}
