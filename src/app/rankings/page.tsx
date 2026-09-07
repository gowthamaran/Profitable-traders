import type { Metadata } from "next";
import Link from "next/link";
import { getPlatforms } from "@/lib/data/repository";
import { evidenceScoreFor } from "@/lib/metrics/evidence";
import { painIndexFor } from "@/lib/metrics/badges";
import { profitablePct, unprofitablePct } from "@/lib/metrics/profitability";
import { compactNumber, pct } from "@/lib/format";
import type { Platform } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { DemoTag } from "@/components/DemoBanner";
import { InsufficientData, Panel, SectionHeading } from "@/components/ui";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Rankings",
  description:
    "Platforms ranked by profitable share, unprofitable share, pain index, evidence quality, profit concentration and sample size.",
};

interface Board {
  id: string;
  title: string;
  note: string;
  /** Null excludes a platform from this board rather than ranking it as zero. */
  value: (p: Platform) => number | null;
  format: (value: number) => string;
  direction: "asc" | "desc";
}

const BOARDS: Board[] = [
  {
    id: "most-profitable",
    title: "Most profitable",
    note: "Highest share of analyzed wallets finishing above break-even.",
    value: (p) => (p.stat ? profitablePct(p.stat.counts) : null),
    format: (v) => pct(v),
    direction: "desc",
  },
  {
    id: "most-unprofitable",
    title: "Most unprofitable",
    note: "Highest share of analyzed wallets finishing below break-even.",
    value: (p) => (p.stat ? unprofitablePct(p.stat.counts) : null),
    format: (v) => pct(v),
    direction: "desc",
  },
  {
    id: "highest-pain",
    title: "Highest pain index",
    note: "The site-created composite. See the formula on the methodology page.",
    value: (p) => painIndexFor(p),
    format: (v) => v.toFixed(0),
    direction: "desc",
  },
  {
    id: "best-evidence",
    title: "Best evidence",
    note: "Strength of the sourcing, not quality of the outcomes.",
    value: (p) => (p.stat ? evidenceScoreFor(p.stat) : null),
    format: (v) => `${v.toFixed(0)}/100`,
    direction: "desc",
  },
  {
    id: "profit-concentration",
    title: "Biggest profit concentration",
    note: "Share of all observed profit captured by the top 1% of wallets.",
    value: (p) => (p.stat?.topOnePctProfitShare != null ? p.stat.topOnePctProfitShare * 100 : null),
    format: (v) => pct(v),
    direction: "desc",
  },
  {
    id: "largest-sample",
    title: "Largest sample",
    note: "Number of wallets in the analysis window.",
    value: (p) => p.stat?.counts.analyzed ?? null,
    format: (v) => compactNumber(v),
    direction: "desc",
  },
];

export default async function RankingsPage() {
  const platforms = await getPlatforms();
  const ranked = platforms.filter((p) => p.stat);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <p className="label">Section 22</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-paper sm:text-3xl">Rankings</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        Every board ranks only platforms that carry the value it sorts on. A platform missing an
        input is left out of that board rather than ranked at zero, which would put it at the top or
        bottom for the wrong reason.
      </p>

      {ranked.length === 0 ? (
        <div className="mt-8">
          <InsufficientData note="No platform carries an approved statistic yet, so there is nothing to rank." />
        </div>
      ) : (
        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          {BOARDS.map((board) => (
            <BoardTable key={board.id} board={board} platforms={ranked} />
          ))}
        </div>
      )}
    </div>
  );
}

function BoardTable({ board, platforms }: { board: Board; platforms: Platform[] }) {
  const rows = platforms
    .map((p) => ({ platform: p, value: board.value(p) }))
    .filter((row): row is { platform: Platform; value: number } => row.value !== null)
    .sort((a, b) => (board.direction === "desc" ? b.value - a.value : a.value - b.value))
    .slice(0, 8);

  return (
    <section>
      <SectionHeading title={board.title} note={board.note} />
      <Panel>
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-muted">No platform carries this value yet.</p>
        ) : (
          <ol className="divide-y divide-ink-700">
            {rows.map((row, index) => (
              <li key={row.platform.slug} className="flex items-center gap-3 p-3">
                <span className="tnum w-5 shrink-0 font-mono text-xs text-faint">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/platform/${row.platform.slug}`}
                    className="flex items-center gap-2 truncate text-sm text-paper hover:text-accent"
                  >
                    {row.platform.name}
                    {row.platform.isDemo && <DemoTag />}
                  </Link>
                  <p className="label mt-0.5 truncate">
                    {CATEGORY_LABELS[row.platform.category]}
                  </p>
                </div>
                <span className="tnum shrink-0 text-sm font-semibold text-paper">
                  {board.format(row.value)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </section>
  );
}
