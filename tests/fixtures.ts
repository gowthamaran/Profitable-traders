import type { Platform, ProfitabilityStat } from "@/lib/types";

export function makeStat(overrides: Partial<ProfitabilityStat> = {}): ProfitabilityStat {
  return {
    counts: {
      analyzed: 100_000,
      profitable: 8_000,
      unprofitable: 88_000,
      breakEven: 3_000,
      unknown: 1_000,
    },
    medianPnlUsd: -250,
    meanPnlUsd: -40,
    topOnePctProfitShare: 0.5,
    buckets: [
      { min: null, max: -10_000, label: "< -$10k", wallets: 2_000 },
      { min: -10_000, max: -1_000, label: "-$10k to -$1k", wallets: 14_000 },
      { min: -1_000, max: -100, label: "-$1k to -$100", wallets: 40_000 },
      { min: -100, max: 0, label: "-$100 to $0", wallets: 32_000 },
      { min: 0, max: 100, label: "$0 to $100", wallets: 5_000 },
      { min: 100, max: 1_000, label: "$100 to $1k", wallets: 2_000 },
      { min: 1_000, max: 10_000, label: "$1k to $10k", wallets: 800 },
      { min: 10_000, max: null, label: "> $10k", wallets: 200 },
    ],
    activityBands: [
      { label: "All wallets", minTrades: 0, wallets: 100_000, profitable: 8_000 },
      { label: "100+ trades", minTrades: 100, wallets: 5_000, profitable: 200 },
    ],
    survivorBands: [
      { threshold: 1, label: "$1+", wallets: 8_000 },
      { threshold: 1_000, label: "$1,000+", wallets: 1_000 },
    ],
    series: {},
    methodology: {
      pnlDefinition: "Realised PnL",
      feesIncluded: true,
      unrealizedIncluded: false,
      walletClustering: false,
      exclusions: [],
      filters: [],
      dateRangeStart: "2025-01-01",
      dateRangeEnd: "2025-08-01",
      calculationVersion: "v1",
      notes: null,
    },
    sources: [
      {
        id: "s1",
        role: "primary",
        provider: "Dune Analytics",
        type: "onchain-raw",
        url: "https://dune.com/queries/1",
        query: "SELECT 1",
        datasetDate: "2025-08-01",
        lastVerified: "2025-08-01",
        sampleSize: 100_000,
        reproducible: true,
        status: "VERIFIED",
        notes: null,
      },
    ],
    evidenceFactors: {
      officialOrRawChainData: true,
      publicReproducibleSql: true,
      methodologyDisclosed: true,
      largeSample: true,
      recentData: true,
      independentSecondSource: false,
    },
    periodStart: "2025-01-01",
    periodEnd: "2025-08-01",
    lastUpdated: "2025-08-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makePlatform(overrides: Partial<Platform> = {}): Platform {
  return {
    slug: "example",
    name: "Example",
    category: "perps",
    description: "A venue.",
    chains: ["Solana"],
    website: null,
    stat: makeStat(),
    unknownReason: null,
    dataAvailabilityNote: null,
    isDemo: false,
    ...overrides,
  };
}
