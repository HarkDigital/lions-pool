# The Lions Pool

Website for an unconventional Detroit Lions pool: every week the commissioner
("Mother") posts a custom slate — asymmetric moneylines, homemade spreads,
over/unders, straight-money totals, prop packs, bye-week pick'em slates — and
every player calls the winner and the exact score. Score bonuses ride on top:

| Bonus | Points | Meaning |
| --- | --- | --- |
| Closest To | +5 | Nearest to a team's actual score when nobody nailed it (per team, ties all cash) |
| Exacto | +8 | Nailed one team's score exactly |
| Perfecto | +20 | Nailed the entire final score |
| Kiss of Death | −20 | Picked the exact reverse of the final score |

## This repo (demo mode)

Next.js 15 (App Router) + TypeScript + Tailwind v4, exported statically for
GitHub Pages. The demo simulates the 2026 season frozen at Oct 1, 2026:
Weeks 1–3 graded, Week 4 open for picks, later weeks drafted. Sign-in is
simulated (pick a character); everything you save lives in `localStorage`.

```bash
npm install
npm run dev    # http://localhost:3000
npm test       # grading-engine unit tests
npm run build  # static export -> out/
```

Pushing to `main` deploys the demo via `.github/workflows/deploy.yml`
(GitHub Pages; the basePath is derived automatically from the repository
name).

Production lives at https://thelionspool.com on the VPS (nginx serving
`/var/www/thelionspool`, cert via Let's Encrypt, alongside harkpicks.com).
Deploy with `npm run deploy:vps` (uses the `lionspool-vps` SSH alias; builds
with no basePath and rsyncs `out/`).

## Architecture

- `lib/types.ts` — contest / question / submission / results model. A weekly
  contest is a list of typed questions (moneyline, spread, overUnder, prop,
  pickem) plus optional combo bonus and the score-bonus flag.
- `lib/scoring.ts` — the pure grading engine. Given a contest, the actual
  results, and *all* submissions (Closest-To is relative), it returns per-player
  line items and totals; `computeStandings` folds graded weeks into the season
  table. The demo runs it in the browser; the live app will run the identical
  code on the server.
- `lib/demo-data.ts` — the simulated season (18 contests modeled on the real
  2025 slates, 10 fictional players, hand-crafted picks).
- `lib/store.ts` — demo persistence: localStorage overlays for identity,
  picks, admin-built contests, and admin-entered results. This file is the
  seam where Clerk + Postgres slot in for production.
- `app/…` — pages: This Week (pick form), Schedule, Standings, My Picks,
  Rules, and the admin console (dashboard, submissions, contest builder,
  grading).

## Production upgrade path (2026 season, live)

1. Deploy to Vercel (Hobby) instead of Pages; drop `output: "export"`.
2. Auth: Clerk (`@clerk/nextjs`) — replaces `lib/store.ts` identity.
3. DB: Neon Postgres + Drizzle — tables mirror `lib/types.ts` (participants,
   contests, submissions, results, grades).
4. Auto-grading: a Vercel Cron hits ESPN's public scoreboard API after games,
   writes `WeekResults`, runs `gradeWeek`, and flips the contest to graded;
   the admin grading console becomes a one-click review/override.
5. Picks lock server-side at kickoff (`lockAtUTC` already models this).
