import Link from "next/link";
import type { Platform } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { microcopyFor } from "@/lib/metrics/microcopy";
import { profitablePct, unprofitablePct, breakEvenPct, unknownPct } from "@/lib/metrics/profitability";
import { compactNumber, pct, isoDate } from "@/lib/format";
import { ProfitabilityBar } from "./ProfitabilityBar";
import { DemoTag } from "./DemoBanner";

export function PlatformCard({ platform, microcopy }: { platform: Platform; microcopy?: string | null }) {
  const stat = platform.stat;
  const line = microcopy === undefined ? microcopyFor(stat) : microcopy;
  if (!stat && !platform.profitabilityReports?.length) return null;
  return (
    <article className="platform-card group relative flex flex-col rounded-lg border border-ink-600 bg-ink-900 p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <PlatformMark name={platform.name} size="h-10 w-10" />
        <div className="min-w-0 flex-1"><h3 className="text-xl font-semibold tracking-tight"><Link href={`/platform/${platform.slug}`} className="hover:text-accent">{platform.name}</Link></h3><p className="text-sm text-muted">{CATEGORY_LABELS[platform.category]}</p></div>
        {platform.isDemo && <DemoTag />}
      </div>
      {stat ? <>
        <div className="my-6 grid grid-cols-2 gap-4">
          <div><p className="mb-1 text-sm text-muted">Made money</p><p className="tnum text-4xl font-semibold tracking-tight text-profit">{pct(profitablePct(stat.counts))}</p></div>
          <div className="text-right"><p className="mb-1 text-sm text-muted">Lost money</p><p className="tnum text-4xl font-semibold tracking-tight text-loss">{pct(unprofitablePct(stat.counts))}</p></div>
        </div>
        <ProfitabilityBar profitable={profitablePct(stat.counts)} unprofitable={unprofitablePct(stat.counts)} breakEven={breakEvenPct(stat.counts)} unknown={unknownPct(stat.counts)} height="h-2" />
        <p className="mt-3 text-sm leading-relaxed text-muted">Of {compactNumber(stat.counts.analyzed)} {platform.isDemo ? "example" : "analyzed"} wallets. The rest broke even or have an unknown result.</p>
        <p className="mt-4 text-sm italic text-paper/75">{line || "The calculator has no referral code."}</p>
        <p className="mt-5 text-xs text-muted">{platform.isDemo ? "Example period" : "Study period"}: {isoDate(stat.periodStart)} – {isoDate(stat.periodEnd)}</p>
      </> : <>
        <p className="mt-6 text-sm font-medium text-accent">Public profitability reports</p>
        <p className="mt-2 text-2xl font-semibold leading-snug">Less FOMO.<br />More homework.</p>
        <p className="mt-3 text-sm leading-relaxed text-muted">Read the Solana wallet studies on Dune. We haven&apos;t verified their results here, so Fomo has no claimed percentage or ranking.</p>
      </>}
      <Link href={`/platform/${platform.slug}`} className="mt-auto flex items-center justify-between border-t border-ink-600 pt-4 text-base font-semibold text-paper group-hover:text-accent">
        <span className="pt-4">{stat ? "See results & proof" : "Read Fomo reports"}</span><span className="pt-4" aria-hidden>↗</span>
      </Link>
    </article>
  );
}

export function PlatformMark({ name, size = "h-6 w-6" }: { name: string; size?: string }) {
  return <span aria-hidden className={`${size} flex shrink-0 items-center justify-center rounded-md border border-ink-600 bg-ink-800 font-mono text-sm font-semibold text-paper`}>{name.replace(/[^A-Za-z0-9 .]/g, "").split(/[ .]/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("")}</span>;
}
