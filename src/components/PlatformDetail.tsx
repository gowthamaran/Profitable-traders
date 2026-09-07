import Link from "next/link";
import type { Platform } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { badgesFor, BADGE_RULES } from "@/lib/metrics/badges";
import { evidenceScoreFor, gradeEvidence, isStale } from "@/lib/metrics/evidence";
import { computePainIndex } from "@/lib/metrics/painIndex";
import { microcopyFor, surprisingStat } from "@/lib/metrics/microcopy";
import {
  activityBandPct,
  breakEvenPct,
  losingBuckets,
  profitablePct,
  unknownPct,
  unprofitablePct,
} from "@/lib/metrics/profitability";
import { compactNumber, fullNumber, isoDate, pct, relativeAge, signedUsd } from "@/lib/format";
import { ProfitabilityBar } from "./ProfitabilityBar";
import { PnlDistribution } from "./charts/PnlDistribution";
import { ProfitabilityTrend } from "./charts/ProfitabilityTrend";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { ShareCard } from "./ShareCard";
import { ProfitabilityReports } from "./ProfitabilityReports";
import { DemoTag } from "./DemoBanner";
import { EvidenceScorePill, InsufficientData, Microcopy, Panel, SectionHeading, Stat, WarningCard } from "./ui";

export function PlatformDetail({ platform, allPlatforms }: { platform: Platform; allPlatforms: Platform[] }) {
  const stat = platform.stat;
  const badges = badgesFor(platform, allPlatforms);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <nav className="mb-6 font-mono text-2xs tracking-widest text-faint">
        <Link href="/" className="hover:text-paper">
          DATABASE
        </Link>
        <span className="mx-2">/</span>
        <span className="text-muted">{CATEGORY_LABELS[platform.category].toUpperCase()}</span>
      </nav>

      <header className="border-b border-ink-700 pb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-paper sm:text-3xl">
                {platform.name}
              </h1>
              {platform.isDemo && <DemoTag />}
            </div>
            <p className="label mt-1.5">{CATEGORY_LABELS[platform.category]}</p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{platform.description}</p>
            {platform.chains.length > 0 && (
              <p className="mt-2 font-mono text-2xs tracking-wider text-faint">
                {platform.chains.join(" · ").toUpperCase()}
              </p>
            )}
          </div>
          {stat && (
            <div className="flex flex-col items-end gap-2">
              <EvidenceScorePill
                score={evidenceScoreFor(stat)}
                grade={gradeEvidence(evidenceScoreFor(stat))}
              />
              <span className="font-mono text-2xs tracking-wider text-faint">
                UPDATED {relativeAge(stat.lastUpdated).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        <h2 className="mt-8 max-w-4xl text-lg font-semibold leading-snug tracking-tight text-paper sm:text-2xl">
          Who made money on {platform.name}?
        </h2>
      </header>

      {!stat ? (
        platform.profitabilityReports?.length ? <ProfitabilityReports platform={platform} /> : <UnknownPlatform platform={platform} />
      ) : (
        <div className="mt-8 space-y-12">
          <HeadlineSection platform={platform} />
          <section>
            <SectionHeading title="Check the receipts" note="See the source, the dates, and how profit was counted." />
            <EvidenceDrawer stat={stat} platformName={platform.name} />
          </section>
          <details className="deep-dive rounded-md border border-ink-600 p-5">
            <summary className="cursor-pointer text-lg font-semibold">Want the full autopsy? <span className="text-sm font-normal text-muted">Charts, trading activity & limitations</span></summary>
            <div className="mt-8 space-y-10">

          <section>
            <SectionHeading
              title="Reality check"
              note="Three facts computed directly from the counts above. Demo records remain examples."
            />
            <RealityCheck platform={platform} />
            <p className="mt-3 text-sm italic text-muted">Your timeline may have left this part out.</p>
          </section>

          <section>
            <SectionHeading
              label="Distribution"
              title="Where the money went"
              note="Wallets grouped by profit or loss from closed trades. Hover any bar for the exact figure."
            />
            <Panel className="p-4">
              <PnlDistribution buckets={stat.buckets} />
            </Panel>
          </section>

          <div className="grid gap-8 lg:grid-cols-2">
            <section>
              <SectionHeading
                title="Where did everyone go?"
                note="Profitable share by activity level. More trades is not the same as more skill."
              />
              <Panel className="divide-y divide-ink-700">
                {stat.activityBands.map((band) => (
                  <div key={band.label} className="p-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm text-paper/85">{band.label}</span>
                      <span className="tnum text-sm font-semibold text-paper">
                        {pct(activityBandPct(band))}
                      </span>
                    </div>
                    <div className="mt-2">
                      <ProfitabilityBar
                        profitable={activityBandPct(band)}
                        unprofitable={100 - activityBandPct(band)}
                        height="h-1.5"
                      />
                    </div>
                    <p className="tnum mt-1.5 text-2xs text-faint">
                      {fullNumber(band.profitable)} of {fullNumber(band.wallets)} wallets
                    </p>
                  </div>
                ))}
              </Panel>
            </section>

            <section>
              <SectionHeading
                title="The survivors"
                note="Share of analyzed wallets finishing above each threshold."
              />
              <Panel className="divide-y divide-ink-700">
                {stat.survivorBands.map((band) => {
                  const share = (band.wallets / stat.counts.analyzed) * 100;
                  return (
                    <div key={band.label} className="flex items-center gap-3 p-3">
                      <span className="tnum w-16 shrink-0 font-mono text-xs text-muted">
                        {band.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <ProfitabilityBar
                          profitable={share}
                          unprofitable={0}
                          height="h-1.5"
                        />
                      </div>
                      <span className="tnum w-24 shrink-0 text-right text-xs text-paper">
                        {pct(share, 2)}
                      </span>
                      <span className="tnum hidden w-20 shrink-0 text-right text-2xs text-faint sm:block">
                        {compactNumber(band.wallets)}
                      </span>
                    </div>
                  );
                })}
              </Panel>
            </section>
          </div>

          <section>
            <SectionHeading
              title="The graveyard"
              note="Losing wallets by severity. Grouped by how much they lost."
            />
            <Panel className="p-4">
              <Graveyard platform={platform} />
            </Panel>
          </section>

          <section>
            <SectionHeading
              title="Profitability over time"
              note="Each point is the profitable share of wallets active in that window."
            />
            <Panel className="p-4">
              <ProfitabilityTrend series={stat.series} />
            </Panel>
          </section>

          <section>
            <SectionHeading title="Pain index" note="A site-created metric. Not an industry standard.">
              <Link
                href="/methodology#pain-index"
                className="font-mono text-2xs tracking-widest text-accent hover:underline"
              >
                SEE THE FORMULA →
              </Link>
            </SectionHeading>
            <PainIndexPanel platform={platform} />
          </section>

          {badges.length > 0 && (
            <section>
              <SectionHeading
                title="Badges"
                note="Awarded by rule from the numbers above. Never assigned by hand."
              />
              <div className="flex flex-wrap gap-2">
                {badges.map((badge) => (
                  <div
                    key={badge.id}
                    className={`rounded-sm border px-3 py-2 ${
                      badge.tone === "good"
                        ? "border-profit/40 bg-profit-wash"
                        : badge.tone === "bad"
                          ? "border-loss/40 bg-loss-wash"
                          : "border-ink-600 bg-ink-850"
                    }`}
                  >
                    <p
                      className={`font-mono text-2xs font-semibold tracking-widest ${
                        badge.tone === "good"
                          ? "text-profit"
                          : badge.tone === "bad"
                            ? "text-loss"
                            : "text-muted"
                      }`}
                    >
                      {badge.id}
                    </p>
                    <p className="mt-1 max-w-xs text-xs text-paper/70">{badge.reason}</p>
                    <p className="mt-1 text-2xs text-faint">Rule: {BADGE_RULES[badge.id].criterion}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <SectionHeading
              title="Data warnings"
              note="What this figure does not account for. Read before quoting it."
            />
            <DataWarnings platform={platform} />
          </section>

            </div>
          </details>

          <section>
            <SectionHeading title="Share the damage" />
            <ShareCard platform={platform} headline={surprisingStat(stat)} />
          </section>
        </div>
      )}
    </div>
  );
}

function HeadlineSection({ platform }: { platform: Platform }) {
  const stat = platform.stat!;
  const counts = stat.counts;
  return (
    <section className="mt-8">
      <div className="grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Panel className="p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="label">Made money</p>
              <p className="tnum mt-1 text-4xl font-semibold text-profit sm:text-5xl">
                {pct(profitablePct(counts))}
              </p>
            </div>
            <div className="text-right">
              <p className="label">Lost money</p>
              <p className="tnum mt-1 text-4xl font-semibold text-loss sm:text-5xl">
                {pct(unprofitablePct(counts))}
              </p>
            </div>
          </div>
          <div className="mt-5">
            <ProfitabilityBar
              profitable={profitablePct(counts)}
              unprofitable={unprofitablePct(counts)}
              breakEven={breakEvenPct(counts)}
              unknown={unknownPct(counts)}
              height="h-3"
              showLegend
            />
          </div>
          <Microcopy>{microcopyFor(stat)}</Microcopy>
          <p className="mt-4 border-t border-ink-700 pt-3 text-xs leading-relaxed text-muted">
            <span className="font-semibold text-paper/80">Wallets, not people.</span>{" "}
            {pct(unprofitablePct(counts))} of <em>analyzed wallets</em> were unprofitable. One
            person can operate many wallets, so this is not a count of individuals.
          </p>
        </Panel>

        <Panel className="p-5">
          <p className="label">Raw counts</p>
          <dl className="mt-3 space-y-2.5">
            <CountRow label="Analyzed" value={counts.analyzed} emphasis />
            <CountRow label="Profitable" value={counts.profitable} tone="profit" />
            <CountRow label="Unprofitable" value={counts.unprofitable} tone="loss" />
            <CountRow label="Break-even" value={counts.breakEven} />
            <CountRow label="Unknown" value={counts.unknown} />
          </dl>
          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-ink-700 pt-4">
            <Stat
              label="Typical wallet result"
              value={signedUsd(stat.medianPnlUsd)}
              tone={stat.medianPnlUsd < 0 ? "loss" : "profit"}
            />
            <Stat
              label="Average wallet result"
              value={signedUsd(stat.meanPnlUsd)}
              tone={(stat.meanPnlUsd ?? 0) < 0 ? "loss" : "profit"}
              sub="Big wins can pull this number up"
            />
          </div>
          <p className="tnum mt-4 border-t border-ink-700 pt-3 text-2xs text-faint">
            PERIOD {isoDate(stat.periodStart)} → {isoDate(stat.periodEnd)}
          </p>
        </Panel>
      </div>
    </section>
  );
}

function CountRow({
  label,
  value,
  tone,
  emphasis = false,
}: {
  label: string;
  value: number;
  tone?: "profit" | "loss";
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={`text-sm ${emphasis ? "text-paper" : "text-muted"}`}>{label}</dt>
      <dd
        className={`tnum text-sm ${
          tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : "text-paper"
        } ${emphasis ? "font-semibold" : ""}`}
      >
        {fullNumber(value)}
      </dd>
    </div>
  );
}

function RealityCheck({ platform }: { platform: Platform }) {
  const stat = platform.stat!;
  const overThousand = stat.survivorBands.find((b) => b.threshold === 1_000);
  const facts = [
    {
      label: "Finished down",
      value: pct(unprofitablePct(stat.counts)),
      detail: `${fullNumber(stat.counts.unprofitable)} of ${fullNumber(stat.counts.analyzed)} analyzed wallets`,
      tone: "loss" as const,
    },
    {
      label: "Made more than $1,000",
      value: overThousand
        ? pct((overThousand.wallets / stat.counts.analyzed) * 100, 2)
        : "--",
      detail: overThousand
        ? `${fullNumber(overThousand.wallets)} wallets cleared $1,000`
        : "Threshold not on record",
      tone: "profit" as const,
    },
    {
      label: "Top 1% share of profits",
      value: stat.topOnePctProfitShare !== null ? pct(stat.topOnePctProfitShare * 100) : "--",
      detail:
        stat.topOnePctProfitShare !== null
          ? "Of all observed positive PnL"
          : "Concentration not computed for this record",
      tone: "warn" as const,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {facts.map((fact) => (
        <Panel key={fact.label} className="p-4">
          <Stat label={fact.label} value={fact.value} sub={fact.detail} tone={fact.tone} />
        </Panel>
      ))}
    </div>
  );
}

function Graveyard({ platform }: { platform: Platform }) {
  const stat = platform.stat!;
  const losing = losingBuckets(stat);
  const total = losing.reduce((sum, b) => sum + b.wallets, 0);
  if (total === 0) return <p className="text-sm text-muted">No losing wallets in this dataset.</p>;

  return (
    <div className="space-y-3">
      {losing.map((bucket) => {
        const share = (bucket.wallets / total) * 100;
        return (
          <div key={bucket.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-xs text-muted">{bucket.label}</span>
              <span className="tnum text-xs text-paper">
                {fullNumber(bucket.wallets)} <span className="text-faint">({pct(share)})</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-sm bg-ink-800">
              <div className="bar-grow h-full bg-loss" style={{ width: `${share}%` }} />
            </div>
          </div>
        );
      })}
      <p className="border-t border-ink-700 pt-3 text-xs text-muted">
        Share of <span className="text-paper/80">losing</span> wallets in each band, not of all
        analyzed wallets.
      </p>
    </div>
  );
}

function PainIndexPanel({ platform }: { platform: Platform }) {
  const breakdown = computePainIndex(platform.stat!);
  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <p className="tnum text-4xl font-semibold text-warn">{breakdown.score}</p>
          <p className="label mt-1">Pain index / 100</p>
        </div>
        <p className="max-w-md text-xs leading-relaxed text-muted">
          A weighted blend of five observed quantities. It is defined by this site, published in
          full, and carries no authority beyond the inputs listed below.
        </p>
      </div>
      <ul className="mt-5 space-y-2.5 border-t border-ink-700 pt-4">
        {breakdown.components.map((c) => (
          <li key={c.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="tnum w-12 shrink-0 font-mono text-2xs text-faint">
              {(c.weight * 100).toFixed(0)}%
            </span>
            <span className="text-sm text-paper/85">{c.label}</span>
            <span className="text-xs text-muted">{c.inputLabel}</span>
            {!c.available && (
              <span className="rounded-sm border border-ink-600 px-1 py-px font-mono text-2xs text-faint">
                NOT AVAILABLE
              </span>
            )}
            <span className="tnum ml-auto text-xs text-paper">
              +{c.contribution.toFixed(1)}
            </span>
          </li>
        ))}
      </ul>
      {breakdown.redistributedWeight > 0 && (
        <p className="mt-3 text-xs text-warn">
          {(breakdown.redistributedWeight * 100).toFixed(0)}% of the weight belonged to inputs that
          are unavailable for this platform and was redistributed across the rest, rather than
          scored as zero.
        </p>
      )}
    </Panel>
  );
}

function DataWarnings({ platform }: { platform: Platform }) {
  const stat = platform.stat!;
  const warnings: Array<{ title: string; body: string }> = [];

  if (!stat.methodology.feesIncluded) {
    warnings.push({
      title: "FEES NOT INCLUDED",
      body: "Trading fees, gas and priority fees are not deducted. Real outcomes were worse than shown.",
    });
  }
  if (!stat.methodology.unrealizedIncluded) {
    warnings.push({
      title: "UNREALIZED POSITIONS EXCLUDED",
      body: "Only closed positions count. A wallet still holding an open position is measured on what it has realised so far.",
    });
  }
  if (!stat.methodology.walletClustering) {
    warnings.push({
      title: "WALLET CLUSTERING UNAVAILABLE",
      body: "Addresses are counted individually. One operator running many wallets appears as many participants, and a single participant's results may be split across several rows.",
    });
  }
  if (isStale(stat)) {
    warnings.push({
      title: "DATASET IS STALE",
      body: `The underlying data was last verified ${relativeAge(stat.lastUpdated)}. Conditions may have changed materially since.`,
    });
  }
  if (stat.counts.unknown > 0) {
    warnings.push({
      title: "UNRESOLVED WALLETS IN DENOMINATOR",
      body: `${fullNumber(stat.counts.unknown)} wallets could not be resolved to a definite outcome. They remain in the denominator rather than being dropped.`,
    });
  }
  if (platform.isDemo) {
    warnings.push({
      title: "SYNTHETIC RECORD",
      body: "This platform's figures are generated for interface development. They are not a measurement of this platform and must not be cited.",
    });
  }

  if (warnings.length === 0) {
    return <p className="text-sm text-muted">No methodological warnings recorded for this dataset.</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {warnings.map((w) => (
        <WarningCard key={w.title} title={w.title}>
          {w.body}
        </WarningCard>
      ))}
    </div>
  );
}

/** Section 30. */
function UnknownPlatform({ platform }: { platform: Platform }) {
  return (
    <div className="mt-8 space-y-6">
      <Panel className="p-6">
        <p className="font-mono text-sm font-semibold tracking-widest text-muted">
          PROFITABILITY: UNKNOWN
        </p>
        <span className="mt-3 inline-block rounded-sm border border-ink-600 px-2 py-1 font-mono text-2xs tracking-widest text-muted">
          DATA BLACK HOLE
        </span>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-paper/80">
          {platform.dataAvailabilityNote}
        </p>
      </Panel>

      {platform.category === "casinos" && (
        <WarningCard title="HOUSE EDGE IS NOT TRADER PROFITABILITY">
          A published house edge describes the expected margin of the games over time. It is not a
          measurement of what any group of users actually finished with, and this site will not
          present one as the other.
        </WarningCard>
      )}

      <InsufficientData note="No participant-level statistic is published for this platform. Rather than estimate one, this page records precisely what is and is not available." />
    </div>
  );
}
