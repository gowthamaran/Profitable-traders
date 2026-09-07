import type { Metadata } from "next";
import Link from "next/link";
import { getPlatforms } from "@/lib/data/repository";
import { isoDate } from "@/lib/format";
import { fullNumber } from "@/lib/format";
import { StatusPill } from "@/components/EvidenceDrawer";
import { DemoTag } from "@/components/DemoBanner";
import { InsufficientData, Panel } from "@/components/ui";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Sources",
  description:
    "Every source behind every figure: provider, type, dataset date, sample, last verified, and whether it can be reproduced.",
};

export default async function SourcesPage() {
  const platforms = await getPlatforms();
  const rows = platforms.flatMap((platform) =>
    (platform.stat?.sources ?? []).map((source) => ({ platform, source })),
  );
  const unknown = platforms.filter((p) => !p.stat);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <p className="label">Section 39</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-paper sm:text-3xl">Receipts</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        Every source on file, including the broken ones. A source that stops resolving stays listed
        with status BROKEN rather than being quietly deleted.
      </p>

      <div className="mt-8">
        {rows.length === 0 ? (
          <InsufficientData note="No approved statistic carries a source yet." />
        ) : (
          <Panel className="overflow-x-auto">
            <table className="w-full min-w-[60rem] text-sm">
              <thead>
                <tr className="border-b border-ink-700 text-left">
                  {["Platform", "Source", "Provider", "Type", "Dataset date", "Sample", "Last verified", "Reproducible", "Status"].map(
                    (h) => (
                      <th key={h} className="label whitespace-nowrap px-3 py-2.5 font-normal">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {rows.map(({ platform, source }) => (
                  <tr key={`${platform.slug}-${source.id}`} className="align-top">
                    <td className="whitespace-nowrap px-3 py-3">
                      <Link
                        href={`/platform/${platform.slug}`}
                        className="flex items-center gap-1.5 text-paper hover:text-accent"
                      >
                        {platform.name}
                        {platform.isDemo && <DemoTag />}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      {source.url ? (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-accent hover:underline"
                        >
                          {source.role}
                        </a>
                      ) : (
                        <span className="text-muted">{source.role}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-paper/80">
                      {source.provider}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-muted">
                      {source.type}
                    </td>
                    <td className="tnum whitespace-nowrap px-3 py-3 text-xs text-paper/80">
                      {isoDate(source.datasetDate)}
                    </td>
                    <td className="tnum whitespace-nowrap px-3 py-3 text-xs text-paper/80">
                      {source.sampleSize ? fullNumber(source.sampleSize) : "--"}
                    </td>
                    <td className="tnum whitespace-nowrap px-3 py-3 text-xs text-paper/80">
                      {isoDate(source.lastVerified)}
                    </td>
                    <td className="px-3 py-3 font-mono text-2xs text-muted">
                      {source.reproducible ? "YES" : "NO"}
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill status={source.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}
      </div>

      {unknown.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold tracking-tight text-paper">
            Tracked with no usable source
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            These platforms are listed so the gap is visible. An absent row is not the same as an
            absent platform.
          </p>
          <Panel className="mt-4 divide-y divide-ink-700">
            {unknown.map((platform) => (
              <div key={platform.slug} className="p-4">
                <Link
                  href={`/platform/${platform.slug}`}
                  className="text-sm font-semibold text-paper hover:text-accent"
                >
                  {platform.name}
                </Link>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">
                  {platform.dataAvailabilityNote}
                </p>
              </div>
            ))}
          </Panel>
        </section>
      )}
    </div>
  );
}
