import Link from "next/link";
import type { Platform } from "@/lib/types";
import { surprisingStat } from "@/lib/metrics/microcopy";
import { profitablePct } from "@/lib/metrics/profitability";
import { compactNumber } from "@/lib/format";
import { DemoTag } from "./DemoBanner";

/**
 * Section 31. The callout is generated from the worst observed profitable
 * share in the database, and it names the platform, the sample and the period
 * so the claim is checkable rather than a floating statistic.
 */
export function SurprisingStatStrip({ platforms }: { platforms: Platform[] }) {
  const withStat = platforms.filter((p) => p.stat);
  if (withStat.length === 0) return null;

  const worst = withStat.reduce((a, b) =>
    profitablePct(b.stat!.counts) < profitablePct(a.stat!.counts) ? b : a,
  );
  const line = surprisingStat(worst.stat);
  if (!line) return null;

  return (
    <section className="border-b border-ink-700 bg-ink-900">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-5 sm:px-6">
        <div className="min-w-0">
          <p className="label">Sharpest observation on file</p>
          <p className="mt-1 text-lg font-semibold tracking-tight text-paper sm:text-xl">{line}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-right">
            <p className="flex items-center justify-end gap-1.5 font-mono text-2xs tracking-widest text-muted">
              {worst.name.toUpperCase()}
              {worst.isDemo && <DemoTag />}
            </p>
            <p className="tnum mt-0.5 text-xs text-faint">
              {compactNumber(worst.stat!.counts.analyzed)} wallets ·{" "}
              {worst.stat!.periodStart.slice(0, 10)} to {worst.stat!.periodEnd.slice(0, 10)}
            </p>
          </div>
          <Link
            href={`/platform/${worst.slug}`}
            className="shrink-0 rounded-sm border border-ink-600 px-3 py-2 font-mono text-2xs font-semibold tracking-widest text-paper hover:border-muted"
          >
            VIEW EVIDENCE
          </Link>
        </div>
      </div>
    </section>
  );
}
