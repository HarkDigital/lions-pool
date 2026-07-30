import type { Metadata } from "next";
import Link from "next/link";
import { Card, Pill, PointsChip, SectionTitle } from "@/components/ui";
import { TeamLogo } from "@/components/TeamLogo";
import { BONUS } from "@/lib/scoring";
import { signedPts } from "@/lib/format";

export const metadata: Metadata = {
  title: "House Rules — The Lions Pool",
  description:
    "Team. Win. Score. The complete house rules of The Lions Pool, translated for polite company.",
};

/** Bonus-table chip: gold for the crown jewels, red for the kiss. */
function BonusChip({ points, tone }: { points: number; tone: "gold" | "loss" }) {
  return (
    <span
      className={`display inline-flex min-w-14 items-center justify-center rounded-lg border px-2 py-0.5 text-xl leading-6 ${
        tone === "gold" ? "border-gold/50 bg-gold/10 text-gold" : "border-loss/50 bg-loss/10 text-loss"
      }`}
    >
      {signedPts(points)}
    </span>
  );
}

export default function RulesPage() {
  return (
    <div className="space-y-14">
      {/* Hero ------------------------------------------------------------- */}
      <div className="stripes overflow-hidden rounded-2xl border border-edge bg-panel px-6 py-10 sm:px-10">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky">
          The house rules
        </div>
        <h1 className="display mt-2 text-5xl sm:text-6xl">Here Dem&rsquo; Old Rules Again</h1>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-silver">
          Every week of the football season (except one), the Detroit Lions play an opponent.
          You, a participant in this pool, will tell Mother who wins and exactly what the score
          will be. Everything below is detail. Read it once, carefully, so Mother never has to
          explain it to you again.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Pill tone="blue">Team. Win. Score.</Pill>
          <Pill tone="gold">Bonuses for the bold</Pill>
          <Pill tone="loss">Zero for the wrong</Pill>
        </div>
      </div>

      {/* 1. The One Commandment ------------------------------------------- */}
      <section className="space-y-4">
        <SectionTitle kicker="Rule One">The One Commandment</SectionTitle>
        <Card className="p-6 sm:p-8">
          <div className="display text-4xl text-sky sm:text-5xl">Team. Win. Score.</div>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-silver">
            Every Lions game, you submit exactly three things: the team that wins, the word{" "}
            <span className="font-bold text-chalk">WIN</span> (so there is no confusion), and the
            exact final score of both teams. Like so:
          </p>
          <div className="mt-4 inline-flex items-center gap-3 rounded-lg border border-edge-2 bg-panel-2 px-4 py-3">
            <TeamLogo abbr="DET" size={28} />
            <span className="display text-2xl">Lions win 31&ndash;13</span>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-silver">
            That is the entire assignment. No banter. No essays. No being cute. Freshness is a
            fine quality in your real life, but this is not your real life &mdash; this is your
            Lions Pool life, and here, freshness is bad. Do not submit &ldquo;Detroit
            LOSES&rdquo; or anything else clever. Mother is not a palm reader, and she retired
            from decoding creative entries the day this website went up. The pick form accepts
            three things for a reason.
          </p>
          <p className="display mt-5 text-3xl text-chalk">Don&rsquo;t be an idiot.</p>
        </Card>
      </section>

      {/* 2. The Points Divide --------------------------------------------- */}
      <section className="space-y-4">
        <SectionTitle kicker="Rule Two">The Points Divide</SectionTitle>
        <Card className="p-6 sm:p-8">
          <p className="max-w-3xl text-sm leading-relaxed text-silver">
            Mother sets the payout for each side of every game. The favorite pays little,
            because predicting the sunrise is not a talent. The longshot pays a lot, because it
            should. Pick the wrong team &mdash; in either direction &mdash; and you collect
            zero. The divide only pays winners.
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-silver">
            Yes, Mother makes the lines herself. No, they are not Vegas. Stop questioning her.
          </p>

          <div className="mt-6 overflow-hidden rounded-xl border border-edge">
            <div className="flex items-center justify-between gap-3 border-b border-edge bg-panel-2 px-4 py-3 sm:px-6">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-fog">
                Sample slate &mdash; Saints at Lions
              </span>
              <Pill tone="blue">The divide</Pill>
            </div>
            <div className="divide-y divide-edge">
              <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
                <div className="flex items-center gap-3">
                  <TeamLogo abbr="DET" size={32} />
                  <div>
                    <div className="font-bold text-chalk">Lions to win</div>
                    <div className="text-xs text-fog">The conclusion everyone on earth expects</div>
                  </div>
                </div>
                <PointsChip points={4.5} />
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
                <div className="flex items-center gap-3">
                  <TeamLogo abbr="NO" size={32} />
                  <div>
                    <div className="font-bold text-chalk">Saints to win</div>
                    <div className="text-xs text-fog">Bold. Statistically unwise. Occasionally glorious.</div>
                  </div>
                </div>
                <PointsChip points={16} />
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
                <div>
                  <div className="font-bold text-fog">Any wrong pick</div>
                  <div className="text-xs text-fog">Either side. No partial credit. No sympathy.</div>
                </div>
                <PointsChip points={0} hit={false} />
              </div>
            </div>
          </div>

          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-silver">
            Sixteen points is tempting. Sixteen points is <span className="italic">meant</span>{" "}
            to be tempting. But zeros compound, and chasing the longshot every single week digs
            a crater no bonus can fill. This pool keeps a cautionary tale on the roster &mdash;
            ask The Machine how the longshot express has been running since 2019. Sometimes the
            price is right. Sometimes it is not. That is gambling.
          </p>
        </Card>
      </section>

      {/* 3. Score Bonuses ------------------------------------------------- */}
      <section className="space-y-4">
        <SectionTitle kicker="Rule Three — The Crown Jewels">Score Bonuses</SectionTitle>
        <p className="max-w-3xl text-sm leading-relaxed text-silver">
          Your score pick is not decoration. Every Lions game, the numbers you submit are live
          ammunition &mdash; four ways to swing your week without touching the moneyline.
        </p>

        <Card>
          <div className="table-scroll">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-edge text-xs uppercase tracking-[0.15em] text-fog">
                  <th className="px-4 py-3 font-semibold sm:px-6">Bonus</th>
                  <th className="px-4 py-3 font-semibold">Pays</th>
                  <th className="px-4 py-3 font-semibold sm:pr-6">What it takes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                <tr>
                  <td className="px-4 py-4 align-top sm:px-6">
                    <span className="display text-2xl text-chalk">Closest-To</span>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <BonusChip points={BONUS.CLOSEST} tone="gold" />
                  </td>
                  <td className="px-4 py-4 align-top leading-relaxed text-silver sm:pr-6">
                    Nobody in the pool nailed that team&rsquo;s score exactly, and your guess is
                    the nearest to it. One award per team score &mdash; the Lions&rsquo; side and
                    the opponent&rsquo;s side each pay separately. Over or under both count;
                    nearest is nearest. Ties all cash.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-4 align-top sm:px-6">
                    <span className="display text-2xl text-chalk">Exacto</span>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <BonusChip points={BONUS.EXACTO} tone="gold" />
                  </td>
                  <td className="px-4 py-4 align-top leading-relaxed text-silver sm:pr-6">
                    You called one team&rsquo;s score on the nose. Either team. Precision gets
                    paid here.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-4 align-top sm:px-6">
                    <span className="display text-2xl text-gold">Perfecto</span>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <BonusChip points={BONUS.PERFECTO} tone="gold" />
                  </td>
                  <td className="px-4 py-4 align-top leading-relaxed text-silver sm:pr-6">
                    You called the entire final score. Both numbers. The whole game, summoned
                    from thin air. Frame the screenshot &mdash; Mother will allow it, once.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-4 align-top sm:px-6">
                    <span className="display text-2xl text-loss">Kiss of Death</span>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <BonusChip points={BONUS.KISS_OF_DEATH} tone="loss" />
                  </td>
                  <td className="px-4 py-4 align-top leading-relaxed text-silver sm:pr-6">
                    You picked the exact reverse of the final score. The pool&rsquo;s signature
                    humiliation. No consolation prizes stack on top of the kiss &mdash; it
                    stands alone, and it will be discussed at Thanksgiving.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <Card accent className="p-6 sm:p-8">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky">
            Worked example
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-10 gap-y-4">
            <div>
              <div className="text-xs uppercase tracking-[0.15em] text-fog">The final</div>
              <div className="mt-1 flex items-center gap-2">
                <TeamLogo abbr="DET" size={28} />
                <span className="display text-3xl">32&ndash;7</span>
                <TeamLogo abbr="NO" size={28} />
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.15em] text-fog">Your pick</div>
              <div className="display mt-1 text-3xl">Lions win 31&ndash;6</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.15em] text-fog">You collect</div>
              <div className="mt-1 flex items-center gap-2">
                <BonusChip points={BONUS.CLOSEST} tone="gold" />
                <BonusChip points={BONUS.CLOSEST} tone="gold" />
              </div>
            </div>
          </div>
          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-silver">
            Nobody anywhere in the pool hit either score exactly. Your 31 is the nearest anyone
            came to the Lions&rsquo; 32 &mdash; Closest-To, +5. Your 6 is the nearest anyone
            came to the Saints&rsquo; 7 &mdash; Closest-To, +5. You did not nail a single number
            and you still bank +10. That is the game within the game.
          </p>
          <ul className="mt-5 space-y-2 border-t border-edge pt-4 text-sm leading-relaxed text-silver">
            <li className="flex gap-2">
              <span className="text-sky">&rarr;</span>
              <span>
                Picked the wrong winner? You can still cash score bonuses. Nailing a number pays
                regardless of your moneyline sins.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-sky">&rarr;</span>
              <span>
                Every qualifying player gets paid &mdash; bonuses are not a raffle. If four
                people tie for closest, four people collect.
              </span>
            </li>
          </ul>
        </Card>
      </section>

      {/* 4. Other slates -------------------------------------------------- */}
      <section className="space-y-4">
        <SectionTitle kicker="Rule Four">Other Slates Mother Runs</SectionTitle>
        <p className="max-w-3xl text-sm leading-relaxed text-silver">
          The One Commandment never goes away. Some weeks, Mother simply builds on top of it.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="display text-2xl">Spreads</h3>
              <Pill tone="blue">e.g. Lions &minus;10.5</Pill>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-silver">
              Mother makes the lines. They are not Vegas. Stop questioning her. The favorite has
              to cover; the dog cashes by keeping it close or winning outright. Each side pays
              its own number, and on some weeks you never declare a side at all &mdash; you send
              winner and score like always, and Mother does the math on where you landed.
            </p>
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="display text-2xl">Over / Unders</h3>
              <Pill tone="blue">The number</Pill>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-silver">
              A number on the combined score, or on the Lions&rsquo; margin of victory. Pick a
              side and get paid if you are right. Fair warning: some weeks your score pick
              chooses your side automatically &mdash; so submit a score you actually believe in,
              not one you think is funny.
            </p>
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="display text-2xl">Straight Money</h3>
              <Pill tone="gold">The big payout</Pill>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-silver">
              On over/under weeks, landing the combined score exactly on Mother&rsquo;s number
              &mdash; not over, not under, <span className="italic">on it</span> &mdash; pays
              roughly double either side. It almost never happens. That is precisely why it is
              called Straight Money.
            </p>
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="display text-2xl">Prop Packs</h3>
              <Pill tone="blue">Sweep bonus</Pill>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-silver">
              A handful of side questions &mdash; who throws for more, who finds the end zone
              first &mdash; worth a few points apiece. Sweep the whole pack and Mother stacks a
              bonus on top. Go 0-for-the-pack and you get nothing, which you will have earned.
            </p>
          </Card>

          <Card className="p-5 sm:col-span-2 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="display text-2xl">Bye-Week Slates</h3>
              <Pill tone="gold">The legendary rule</Pill>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-silver">
              The Lions rest. You do not. Five games from around the league, four points per
              correct pick. Run the table and the payout bumps. Go 0-for-5 &mdash; perfectly,
              beautifully, historically wrong &mdash; and Mother pays{" "}
              <span className="font-bold text-gold">more</span> than the perfect card. That is
              not a typo. Perfection is perfection in either direction, and incompetence at that
              scale deserves respect.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-fog">
                <PointsChip points={25} />
                <span>5-for-5</span>
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold text-fog">
                <BonusChip points={30} tone="gold" />
                <span>0-for-5</span>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* 5. Deadlines ----------------------------------------------------- */}
      <section className="space-y-4">
        <SectionTitle kicker="Rule Five">Deadlines</SectionTitle>
        <Card className="p-6 sm:p-8">
          <div className="display text-4xl">Picks lock at kickoff.</div>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-silver">
            In by a minute, you are in. Late by a minute, you eat a zero. There is no appeals
            process, no grace period, and no story about traffic that Mother has not already
            heard and disbelieved.
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-silver">
            No texts. No DMs. No voicemails. No carrier pigeons. No shouting your score across
            the parking lot. Why do you even have Mother&rsquo;s number? The website is the only
            door, and it closes on time.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-honolulu px-4 py-2 text-sm font-bold text-white transition hover:bg-honolulu-deep"
          >
            Make this week&rsquo;s pick &rarr;
          </Link>
        </Card>
      </section>

      {/* 6. A note on tone ------------------------------------------------ */}
      <Card className="p-6">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-fog">
          A note on tone
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-silver">
          These rules date to the email era, when picks arrived in Mother&rsquo;s inbox and the
          rules arrived with considerably more texture. The full, unexpurgated originals live in
          Mother&rsquo;s archives, where they will remain. What you just read is the
          family-friendly translation: nothing of substance was lost, but several adjectives
          were harmed in the making of this page.
        </p>
        <p className="mt-4 text-sm font-semibold text-fog">&mdash; Mother, Commissioner for Life</p>
      </Card>
    </div>
  );
}
