import { describe, expect, it } from "vitest";
import { rowsToPlatforms, rowsToSnapshots } from "@/lib/data/mapping";

const platformRow = {
  slug: "example",
  name: "Example",
  category: "perps",
  description: "A venue.",
  chains: ["Solana"],
  website: null,
  unknown_reason: null,
  data_availability_note: null,
};

const statRow = {
  id: "stat-1",
  platform_slug: "example",
  analyzed: 1000,
  profitable: 100,
  unprofitable: 850,
  break_even: 40,
  unknown_count: 10,
  median_pnl_usd: -120,
  mean_pnl_usd: -20,
  top_one_pct_profit_share: 0.6,
  pnl_buckets: [{ label: "-$100 to $0", wallets: 500, min: -100, max: 0 }],
  activity_bands: [{ label: "All wallets", minTrades: 0, wallets: 1000, profitable: 100 }],
  survivor_bands: [{ threshold: 1, label: "$1+", wallets: 100 }],
  time_series: { "30D": [{ date: "2025-08-01", profitablePct: 10, analyzed: 1000 }] },
  pnl_definition: "Realised PnL",
  fees_included: true,
  unrealized_included: false,
  wallet_clustering: false,
  exclusions: ["Bots"],
  filters: [],
  calculation_version: "v1",
  methodology_notes: null,
  factor_official_data: true,
  factor_public_sql: true,
  factor_methodology: true,
  factor_large_sample: false,
  factor_recent: true,
  factor_second_source: false,
  period_start: "2025-01-01",
  period_end: "2025-08-01",
  updated_at: "2025-08-02T00:00:00Z",
};

const sourceRow = {
  id: "src-1",
  stat_id: "stat-1",
  role: "primary",
  provider: "Dune Analytics",
  type: "public-sql",
  url: "https://dune.com/queries/1",
  query: "SELECT 1",
  dataset_date: "2025-08-01",
  last_verified: "2025-08-01",
  sample_size: 1000,
  reproducible: true,
  status: "VERIFIED",
  notes: null,
};

describe("row mapping", () => {
  it("maps a complete record", () => {
    const [platform] = rowsToPlatforms([platformRow], [statRow], [sourceRow]);
    expect(platform.slug).toBe("example");
    expect(platform.stat?.counts.analyzed).toBe(1000);
    expect(platform.stat?.sources).toHaveLength(1);
    expect(platform.stat?.series["30D"]).toHaveLength(1);
    expect(platform.isDemo).toBe(false);
  });

  it("drops a statistic whose counts do not add up", () => {
    // A half-read record would render as a real percentage with broken
    // provenance, so it is discarded rather than repaired.
    const [platform] = rowsToPlatforms([platformRow], [{ ...statRow, profitable: 101 }], [sourceRow]);
    expect(platform.stat).toBeNull();
  });

  it("drops a statistic with no period", () => {
    const [platform] = rowsToPlatforms([platformRow], [{ ...statRow, period_end: null }], []);
    expect(platform.stat).toBeNull();
  });

  it("keeps the platform when its statistic is unusable", () => {
    const [platform] = rowsToPlatforms([platformRow], [{ ...statRow, analyzed: null }], []);
    expect(platform.name).toBe("Example");
    expect(platform.stat).toBeNull();
  });

  it("skips a platform row with an unrecognised category", () => {
    expect(rowsToPlatforms([{ ...platformRow, category: "sports-betting" }], [], [])).toHaveLength(0);
  });

  it("parses JSON string columns as well as arrays", () => {
    const [platform] = rowsToPlatforms(
      [platformRow],
      [{ ...statRow, pnl_buckets: JSON.stringify(statRow.pnl_buckets) }],
      [sourceRow],
    );
    expect(platform.stat?.buckets).toHaveLength(1);
  });

  it("ignores malformed bucket entries instead of coercing them to zero", () => {
    const [platform] = rowsToPlatforms(
      [platformRow],
      [{ ...statRow, pnl_buckets: [{ label: "ok", wallets: 5, min: null, max: 0 }, { nope: true }] }],
      [sourceRow],
    );
    expect(platform.stat?.buckets).toHaveLength(1);
  });

  it("maps snapshots and drops rows with no timestamp", () => {
    const snapshots = rowsToSnapshots([
      { platform_slug: "example", captured_at: "2025-08-01T00:00:00Z", profitable_pct: 10, analyzed: 1000, evidence_score: 80, calculation_version: "v1" },
      { platform_slug: "example", captured_at: null },
    ]);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].profitablePct).toBe(10);
  });
});
