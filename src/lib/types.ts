/**
 * The shapes the whole site agrees on.
 *
 * The rule that drives this file: a percentage may not exist in the system
 * without the evidence that produced it. `ProfitabilityStat` therefore carries
 * its numerator, denominator, method and sources rather than a bare number,
 * and a platform whose profitability cannot be established holds `null` — the
 * UI renders "INSUFFICIENT VERIFIABLE DATA" rather than a guess.
 */

export type Category = "prediction-markets" | "memecoins" | "perps" | "casinos" | "other";

export const CATEGORY_LABELS: Record<Category, string> = {
  "prediction-markets": "Prediction Markets",
  memecoins: "Memecoins",
  perps: "Perps",
  casinos: "Casinos",
  other: "Other",
};

export type SourceType =
  | "onchain-raw"
  | "public-sql"
  | "official-api"
  | "indexer"
  | "academic"
  | "leaderboard"
  | "aggregator";

export type SourceStatus = "VERIFIED" | "PARTIAL" | "BROKEN" | "UNVERIFIED";

export type SourceRole = "primary" | "secondary" | "validation";

export interface EvidenceSource {
  id: string;
  role: SourceRole;
  provider: string;
  type: SourceType;
  /** Where a reader goes to see this for themselves. */
  url: string | null;
  /** The query text, when the source is reproducible SQL. */
  query: string | null;
  datasetDate: string;
  lastVerified: string;
  sampleSize: number | null;
  reproducible: boolean;
  status: SourceStatus;
  notes: string | null;
}

/** The inputs to the evidence score, kept explicit so the score is auditable. */
export interface EvidenceFactors {
  officialOrRawChainData: boolean;
  publicReproducibleSql: boolean;
  methodologyDisclosed: boolean;
  largeSample: boolean;
  recentData: boolean;
  independentSecondSource: boolean;
}

export type EvidenceGrade = "VERY HIGH" | "HIGH" | "MEDIUM" | "LOW";

/** How PnL was defined for a given statistic. Different platforms differ. */
export interface Methodology {
  pnlDefinition: string;
  feesIncluded: boolean;
  unrealizedIncluded: boolean;
  walletClustering: boolean;
  exclusions: string[];
  filters: string[];
  dateRangeStart: string;
  dateRangeEnd: string;
  calculationVersion: string;
  notes: string | null;
}

/** Counts are the primary record; percentages are derived from them. */
export interface WalletCounts {
  analyzed: number;
  profitable: number;
  unprofitable: number;
  breakEven: number;
  unknown: number;
}

export interface PnlBucket {
  /** Inclusive lower bound in USD, null for the open-ended bottom bucket. */
  min: number | null;
  /** Exclusive upper bound in USD, null for the open-ended top bucket. */
  max: number | null;
  label: string;
  wallets: number;
}

export interface ActivityBand {
  label: string;
  minTrades: number;
  wallets: number;
  profitable: number;
}

export interface SurvivorBand {
  threshold: number;
  label: string;
  wallets: number;
}

export interface TimeSeriesPoint {
  date: string;
  profitablePct: number;
  analyzed: number;
}

export type Timeframe = "7D" | "30D" | "90D" | "1Y" | "ALL";

/**
 * One platform's profitability profile. `stat === null` is a first-class
 * state, not an error: centralized venues genuinely do not publish
 * participant-level results, and the site says so.
 */
export interface ProfitabilityStat {
  counts: WalletCounts;
  medianPnlUsd: number;
  meanPnlUsd: number | null;
  /** Share of total observed profit captured by the top 1% of wallets, 0-1. */
  topOnePctProfitShare: number | null;
  buckets: PnlBucket[];
  activityBands: ActivityBand[];
  survivorBands: SurvivorBand[];
  series: Partial<Record<Timeframe, TimeSeriesPoint[]>>;
  methodology: Methodology;
  sources: EvidenceSource[];
  evidenceFactors: EvidenceFactors;
  periodStart: string;
  periodEnd: string;
  lastUpdated: string;
}

export type UnknownReason =
  | "centralized-no-participant-data"
  | "no-reproducible-source"
  | "research-pending";

export interface Platform {
  /** External reports, not evidence for an unverified or synthetic percentage. */
  profitabilityReports?: Array<{ title: string; url: string }>;
  slug: string;
  name: string;
  category: Category;
  /** One neutral sentence. Never a joke -- the description is the factual layer. */
  description: string;
  chains: string[];
  website: string | null;
  /** Null means no verifiable profitability statistic exists yet. */
  stat: ProfitabilityStat | null;
  unknownReason: UnknownReason | null;
  /** What is and is not publicly available, shown when stat is null. */
  dataAvailabilityNote: string | null;
  /** True for records that are illustrative only. Rendered as DEMO DATA. */
  isDemo: boolean;
}

/** A historical snapshot. Statistics are appended, never overwritten. */
export interface Snapshot {
  platformSlug: string;
  capturedAt: string;
  profitablePct: number | null;
  analyzed: number | null;
  evidenceScore: number | null;
  calculationVersion: string;
}
