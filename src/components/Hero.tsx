import Link from "next/link";
import { compactNumber } from "@/lib/format";
import type { DatabaseCounts } from "@/lib/data/repository";
import { HeroCounter } from "./HeroCounter";

/**
 * Section 5 and 6. The animated figure is the count of wallets in the
 * database -- a fact about this site's coverage, not a profitability claim --
 * so the animation can never imply a statistic that isn't defensible.
 */
export function Hero({ counts, hasData }: { counts: DatabaseCounts; hasData: boolean }) {
  return (
    <section className="border-b border-ink-700 bg-ink-950">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
        <p className="label">The house always wins?</p>
        <h1 className="mt-3 max-w-4xl text-3xl font-semibold leading-[1.1] tracking-tight text-paper sm:text-5xl">
          HOW MANY TRADERS ACTUALLY MAKE MONEY?
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
          Real profitability data across crypto&apos;s most speculative platforms — backed by
          evidence you can verify yourself.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="#database"
            className="rounded-sm bg-paper px-4 py-2.5 font-mono text-2xs font-semibold tracking-widest text-ink-950 transition-opacity hover:opacity-90"
          >
            BROWSE THE DAMAGE
          </Link>
          <Link
            href="/methodology"
            className="rounded-sm border border-ink-600 px-4 py-2.5 font-mono text-2xs font-semibold tracking-widest text-paper transition-colors hover:border-muted"
          >
            HOW WE CALCULATE IT
          </Link>
        </div>

        {hasData && (
          <dl className="mt-12 grid max-w-3xl grid-cols-2 gap-x-8 gap-y-6 border-t border-ink-700 pt-8 sm:grid-cols-4">
            <div>
              <dt className="label">Wallets analyzed</dt>
              <dd className="tnum mt-1 text-2xl font-semibold text-paper">
                <HeroCounter value={counts.walletsAnalyzed} />
              </dd>
            </div>
            <div>
              <dt className="label">Platforms tracked</dt>
              <dd className="tnum mt-1 text-2xl font-semibold text-paper">{counts.platforms}</dd>
            </div>
            <div>
              <dt className="label">With a statistic</dt>
              <dd className="tnum mt-1 text-2xl font-semibold text-paper">
                {counts.withVerifiedStat}
              </dd>
            </div>
            <div>
              <dt className="label">Sources on file</dt>
              <dd className="tnum mt-1 text-2xl font-semibold text-paper">
                {compactNumber(counts.sources)}
              </dd>
            </div>
          </dl>
        )}
      </div>
    </section>
  );
}
