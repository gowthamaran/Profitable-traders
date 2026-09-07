import Link from "next/link";
import type { Platform } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { evidenceScoreFor, gradeEvidence } from "@/lib/metrics/evidence";
import { microcopyFor } from "@/lib/metrics/microcopy";
import { profitablePct, unprofitablePct, breakEvenPct, unknownPct } from "@/lib/metrics/profitability";
import { compactNumber, pct, relativeAge, signedUsd } from "@/lib/format";
import { ProfitabilityBar } from "./ProfitabilityBar";
import { DemoTag } from "./DemoBanner";
import { EvidenceScorePill, Microcopy } from "./ui";

/**
 * Card order is deliberate: statistic first, evidence beside it, humour last
 * and only when the data triggers a line. Section 48.
 */
export function PlatformCard({
  platform,
  microcopy,
}: {
  platform: Platform;
  /** Passed by the grid so one line is not repeated down a column. */
  microcopy?: string | null;
}) {
  const stat = platform.stat;
  const href = `/platform/${platform.slug}`;
  const line = microcopy === undefined ? microcopyFor(stat) : microcopy;

  return (
    <article className="group flex flex-col rounded-md border border-ink-700 bg-ink-900 p-4 transition-colors hover:border-ink-600">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <PlatformMark name={platform.name} />
            <h3 className="truncate text-base font-semibold tracking-tight text-paper">
              {platform.name}
            </h3>
            {platform.isDemo && <DemoTag />}
          </div>
          <p className="label mt-1">{CATEGORY_LABELS[platform.category]}</p>
        </div>
        {stat && (
          <EvidenceScorePill
            score={evidenceScoreFor(stat)}
            grade={gradeEvidence(evidenceScoreFor(stat))}
          />
        )}
      </div>

      {stat ? (
        <>
          <div className="mt-4 flex items-baseline justify-between gap-2">
            <div>
              <p className="tnum text-2xl font-semibold text-profit">
                {pct(profitablePct(stat.counts))}
              </p>
              <p className="label mt-0.5">Profitable</p>
            </div>
            <div className="text-right">
              <p className="tnum text-2xl font-semibold text-loss">
                {pct(unprofitablePct(stat.counts))}
              </p>
              <p className="label mt-0.5">Unprofitable</p>
            </div>
          </div>

          <div className="mt-3">
            <ProfitabilityBar
              profitable={profitablePct(stat.counts)}
              unprofitable={unprofitablePct(stat.counts)}
              breakEven={breakEvenPct(stat.counts)}
              unknown={unknownPct(stat.counts)}
            />
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div>
              <dt className="label">Wallets analyzed</dt>
              <dd className="tnum mt-0.5 text-paper">{compactNumber(stat.counts.analyzed)}</dd>
            </div>
            <div>
              <dt className="label">Median PnL</dt>
              <dd
                className={`tnum mt-0.5 ${stat.medianPnlUsd < 0 ? "text-loss" : "text-profit"}`}
              >
                {signedUsd(stat.medianPnlUsd)}
              </dd>
            </div>
          </dl>

          <Microcopy>{line}</Microcopy>

          <div className="mt-4 flex items-center justify-between border-t border-ink-700 pt-3">
            <span className="font-mono text-2xs text-faint">
              UPDATED {relativeAge(stat.lastUpdated).toUpperCase()}
            </span>
            <Link
              href={href}
              className="font-mono text-2xs font-semibold tracking-widest text-accent hover:underline"
            >
              VIEW THE DAMAGE →
            </Link>
          </div>
        </>
      ) : (
        <>
          <div className="mt-4 rounded-sm border border-dashed border-ink-600 bg-ink-850 p-3">
            <p className="font-mono text-xs font-semibold tracking-widest text-muted">
              PROFITABILITY: UNKNOWN
            </p>
            <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-paper/60">
              {platform.dataAvailabilityNote}
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-ink-700 pt-3">
            <span className="rounded-sm border border-ink-600 px-1.5 py-0.5 font-mono text-2xs tracking-wider text-muted">
              DATA BLACK HOLE
            </span>
            <Link
              href={href}
              className="font-mono text-2xs font-semibold tracking-widest text-accent hover:underline"
            >
              WHAT IS MISSING →
            </Link>
          </div>
        </>
      )}
    </article>
  );
}

/** A monogram rather than a fetched logo: no third-party image requests. */
export function PlatformMark({ name, size = "h-6 w-6" }: { name: string; size?: string }) {
  const initials = name
    .replace(/[^A-Za-z0-9 .]/g, "")
    .split(/[ .]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      className={`${size} flex shrink-0 items-center justify-center rounded-sm border border-ink-600 bg-ink-800 font-mono text-2xs font-semibold text-muted`}
    >
      {initials}
    </span>
  );
}
