import type { DatabaseCounts } from "@/lib/data/repository";

export function Hero({ counts }: { counts: DatabaseCounts; hasData: boolean }) {
  return (
    <section className="intro-compact mx-auto max-w-7xl px-4 pb-7 pt-9 sm:px-6 sm:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="mb-3 text-sm font-medium text-accent">The timeline shows wins. We look at the rest.</p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight text-paper sm:text-5xl">Everyone&apos;s a genius.<br /><span className="text-muted">Until you check the P&L.</span></h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted">Pick a platform. See which wallets made money, which lost money, and where the numbers came from.</p>
        </div>
        <p className="rounded-md border border-ink-600 px-4 py-3 text-sm text-muted"><strong className="text-paper">{counts.platforms}</strong> platforms · Results or public reports</p>
      </div>
    </section>
  );
}
