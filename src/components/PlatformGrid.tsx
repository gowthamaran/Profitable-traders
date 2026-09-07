"use client";

import { useMemo, useState } from "react";
import type { Category, Platform } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { profitablePct, unprofitablePct } from "@/lib/metrics/profitability";
import { evidenceScoreFor } from "@/lib/metrics/evidence";
import { microcopyFor } from "@/lib/metrics/microcopy";
import { PlatformCard } from "./PlatformCard";

type Filter = Category | "all";
type SortKey = "unprofitable" | "profitable" | "sample" | "evidence";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "prediction-markets", label: CATEGORY_LABELS["prediction-markets"] },
  { id: "memecoins", label: CATEGORY_LABELS.memecoins },
  { id: "perps", label: CATEGORY_LABELS.perps },
  { id: "casinos", label: CATEGORY_LABELS.casinos },
  { id: "other", label: CATEGORY_LABELS.other },
];

const SORTS: Array<{ id: SortKey; label: string }> = [
  { id: "unprofitable", label: "Most wallets losing" },
  { id: "profitable", label: "Most wallets winning" },
  { id: "sample", label: "Most wallets studied" },
  { id: "evidence", label: "Best evidence" },
];

/**
 * Filtering and sorting happen in the client against an already-loaded list,
 * so switching category re-renders the grid without a navigation.
 */
export function PlatformGrid({ platforms }: { platforms: Platform[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("unprofitable");
  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = platforms.filter((p) => {
      if (filter !== "all" && p.category !== filter) return false;
      if (term && !`${p.name} ${p.description}`.toLowerCase().includes(term)) return false;
      return true;
    });
    return [...filtered].sort(compare(sort));
  }, [platforms, filter, sort, search]);

  /**
   * Section 10: use humour sparingly. The lines are data-triggered, so
   * neighbouring platforms in the same state produce the same line; showing it
   * once per grid keeps it an observation rather than a chorus.
   */
  const microcopy = useMemo(() => {
    const used = new Set<string>();
    const map = new Map<string, string | null>();
    for (const platform of visible) {
      const line = microcopyFor(platform.stat);
      if (line && !used.has(line)) {
        used.add(line);
        map.set(platform.slug, line);
      } else {
        map.set(platform.slug, null);
      }
    }
    return map;
  }, [visible]);

  const counts = useMemo(() => {
    const map = new Map<Filter, number>([["all", platforms.length]]);
    for (const p of platforms) map.set(p.category, (map.get(p.category) ?? 0) + 1);
    return map;
  }, [platforms]);

  return (
    <div id="database" className="scroll-mt-20">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-2xl font-semibold">Pick your rabbit hole.</h2><p className="text-sm text-muted">{visible.length} platforms · Empty listings removed</p></div>
      <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-ink-700 pb-4">
        <nav className="flex flex-wrap gap-1" aria-label="Category">
          {FILTERS.map((item) => {
            const count = counts.get(item.id) ?? 0;
            if (count === 0 && item.id !== "all") return null;
            const active = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                aria-pressed={active}
                className={`rounded-sm px-2.5 py-1.5 text-sm font-medium transition-colors ${
                  active ? "bg-paper text-ink-950" : "text-muted hover:bg-ink-800 hover:text-paper"
                }`}
              >
                {item.label}
                <span className={`ml-1.5 ${active ? "opacity-60" : "text-faint"}`}>{count}</span>
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="platform-search">
            Search platforms
          </label>
          <input
            id="platform-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search platforms"
            className="w-40 rounded-sm border border-ink-700 bg-ink-900 px-2.5 py-1.5 text-sm text-paper placeholder:text-faint focus:border-ink-600 sm:w-52"
          />
          <label className="sr-only" htmlFor="platform-sort">
            Sort by
          </label>
          <select
            id="platform-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-sm border border-ink-700 bg-ink-900 px-2 py-1.5 text-sm text-paper"
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptySearch />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((platform) => (
            <PlatformCard
              key={platform.slug}
              platform={platform}
              microcopy={microcopy.get(platform.slug) ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function compare(sort: SortKey) {
  return (a: Platform, b: Platform): number => {
    // Platforms without a statistic always sort last; they have no value to
    // rank on and padding them with zero would misrepresent them.
    if (!a.stat && !b.stat) return a.name.localeCompare(b.name);
    if (!a.stat) return 1;
    if (!b.stat) return -1;

    switch (sort) {
      case "profitable":
        return profitablePct(b.stat.counts) - profitablePct(a.stat.counts);
      case "sample":
        return b.stat.counts.analyzed - a.stat.counts.analyzed;
      case "evidence":
        return evidenceScoreFor(b.stat) - evidenceScoreFor(a.stat);
      case "unprofitable":
      default:
        return unprofitablePct(b.stat.counts) - unprofitablePct(a.stat.counts);
    }
  };
}

/** Section 37. */
function EmptySearch() {
  return (
    <div className="rounded-md border border-dashed border-ink-600 bg-ink-900 p-10 text-center">
      <p className="font-mono text-sm font-semibold tracking-widest text-paper">No matches. Not even a suspicious one.</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Try another name or category. Only platforms with results or public profitability reports appear here.
      </p>
      <a
        href="https://github.com/gowthamaran/Profitable-traders/issues/new?title=Platform%20request"
        target="_blank"
        rel="noreferrer noopener"
        className="mt-4 inline-block rounded-sm border border-ink-600 px-3 py-2 text-sm font-medium text-paper hover:border-muted"
      >
        REQUEST PLATFORM
      </a>
    </div>
  );
}
