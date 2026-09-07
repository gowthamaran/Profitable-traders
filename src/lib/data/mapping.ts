import type {
  ActivityBand,
  Category,
  EvidenceSource,
  Platform,
  PnlBucket,
  ProfitabilityStat,
  Snapshot,
  SurvivorBand,
  TimeSeriesPoint,
  Timeframe,
  UnknownReason,
} from "@/lib/types";

/**
 * Database rows to domain objects.
 *
 * A row that cannot be mapped into a complete, self-consistent statistic is
 * dropped rather than patched: a half-read record would render as a number
 * with missing provenance, which the site must never show.
 */

type Row = Record<string, unknown>;

export function rowsToPlatforms(
  platformRows: readonly Row[],
  statRows: readonly Row[],
  sourceRows: readonly Row[],
): Platform[] {
  const sourcesByStat = new Map<string, EvidenceSource[]>();
  for (const row of sourceRows) {
    const statId = str(row.stat_id);
    if (!statId) continue;
    const list = sourcesByStat.get(statId) ?? [];
    list.push(toSource(row));
    sourcesByStat.set(statId, list);
  }

  const statBySlug = new Map<string, ProfitabilityStat>();
  for (const row of statRows) {
    const slug = str(row.platform_slug);
    const statId = str(row.id);
    if (!slug || !statId) continue;
    const stat = toStat(row, sourcesByStat.get(statId) ?? []);
    if (stat) statBySlug.set(slug, stat);
  }

  return platformRows.flatMap((row) => {
    const slug = str(row.slug);
    const name = str(row.name);
    const category = toCategory(row.category);
    if (!slug || !name || !category) return [];
    return [
      {
        slug,
        name,
        category,
        description: str(row.description) ?? "",
        chains: toStringArray(row.chains),
        website: str(row.website),
        stat: statBySlug.get(slug) ?? null,
        unknownReason: toUnknownReason(row.unknown_reason),
        dataAvailabilityNote: str(row.data_availability_note),
        isDemo: false,
      },
    ];
  });
}

function toStat(row: Row, sources: EvidenceSource[]): ProfitabilityStat | null {
  const analyzed = num(row.analyzed);
  const profitable = num(row.profitable);
  const unprofitable = num(row.unprofitable);
  if (analyzed === null || profitable === null || unprofitable === null) return null;

  const breakEven = num(row.break_even) ?? 0;
  const unknown = num(row.unknown_count) ?? 0;
  // Counts that do not add up mean the ingest was wrong somewhere upstream.
  if (profitable + unprofitable + breakEven + unknown !== analyzed) return null;

  const periodStart = date(row.period_start);
  const periodEnd = date(row.period_end);
  if (!periodStart || !periodEnd) return null;

  return {
    counts: { analyzed, profitable, unprofitable, breakEven, unknown },
    medianPnlUsd: num(row.median_pnl_usd) ?? 0,
    meanPnlUsd: num(row.mean_pnl_usd),
    topOnePctProfitShare: num(row.top_one_pct_profit_share),
    buckets: toBuckets(row.pnl_buckets),
    activityBands: toActivityBands(row.activity_bands),
    survivorBands: toSurvivorBands(row.survivor_bands),
    series: toSeries(row.time_series),
    methodology: {
      pnlDefinition: str(row.pnl_definition) ?? "",
      feesIncluded: bool(row.fees_included),
      unrealizedIncluded: bool(row.unrealized_included),
      walletClustering: bool(row.wallet_clustering),
      exclusions: toStringArray(row.exclusions),
      filters: toStringArray(row.filters),
      dateRangeStart: periodStart,
      dateRangeEnd: periodEnd,
      calculationVersion: str(row.calculation_version) ?? "unversioned",
      notes: str(row.methodology_notes),
    },
    sources,
    evidenceFactors: {
      officialOrRawChainData: bool(row.factor_official_data),
      publicReproducibleSql: bool(row.factor_public_sql),
      methodologyDisclosed: bool(row.factor_methodology),
      largeSample: bool(row.factor_large_sample),
      recentData: bool(row.factor_recent),
      independentSecondSource: bool(row.factor_second_source),
    },
    periodStart,
    periodEnd,
    lastUpdated: date(row.updated_at) ?? periodEnd,
  };
}

function toSource(row: Row): EvidenceSource {
  return {
    id: str(row.id) ?? crypto.randomUUID(),
    role: (str(row.role) as EvidenceSource["role"]) ?? "primary",
    provider: str(row.provider) ?? "unknown",
    type: (str(row.type) as EvidenceSource["type"]) ?? "aggregator",
    url: str(row.url),
    query: str(row.query),
    datasetDate: date(row.dataset_date) ?? "",
    lastVerified: date(row.last_verified) ?? "",
    sampleSize: num(row.sample_size),
    reproducible: bool(row.reproducible),
    status: (str(row.status) as EvidenceSource["status"]) ?? "UNVERIFIED",
    notes: str(row.notes),
  };
}

export function rowsToSnapshots(rows: readonly Row[]): Snapshot[] {
  return rows.flatMap((row) => {
    const slug = str(row.platform_slug);
    const capturedAt = date(row.captured_at);
    if (!slug || !capturedAt) return [];
    return [
      {
        platformSlug: slug,
        capturedAt,
        profitablePct: num(row.profitable_pct),
        analyzed: num(row.analyzed),
        evidenceScore: num(row.evidence_score),
        calculationVersion: str(row.calculation_version) ?? "unversioned",
      },
    ];
  });
}

// ---------------------------------------------------------------- coercion

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function bool(value: unknown): boolean {
  return value === true || value === "true" || value === 1;
}

function date(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.length > 0) return value;
  return null;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return [];
}

const CATEGORIES: Category[] = ["prediction-markets", "memecoins", "perps", "casinos", "other"];

function toCategory(value: unknown): Category | null {
  const raw = str(value);
  return raw && (CATEGORIES as string[]).includes(raw) ? (raw as Category) : null;
}

const UNKNOWN_REASONS: UnknownReason[] = [
  "centralized-no-participant-data",
  "no-reproducible-source",
  "research-pending",
];

function toUnknownReason(value: unknown): UnknownReason | null {
  const raw = str(value);
  return raw && (UNKNOWN_REASONS as string[]).includes(raw) ? (raw as UnknownReason) : null;
}

function toBuckets(value: unknown): PnlBucket[] {
  return asArray(value).flatMap((item) => {
    const label = str(item.label);
    const wallets = num(item.wallets);
    if (!label || wallets === null) return [];
    return [{ label, wallets, min: num(item.min), max: num(item.max) }];
  });
}

function toActivityBands(value: unknown): ActivityBand[] {
  return asArray(value).flatMap((item) => {
    const label = str(item.label);
    const wallets = num(item.wallets);
    const profitable = num(item.profitable);
    const minTrades = num(item.minTrades);
    if (!label || wallets === null || profitable === null || minTrades === null) return [];
    return [{ label, wallets, profitable, minTrades }];
  });
}

function toSurvivorBands(value: unknown): SurvivorBand[] {
  return asArray(value).flatMap((item) => {
    const label = str(item.label);
    const wallets = num(item.wallets);
    const threshold = num(item.threshold);
    if (!label || wallets === null || threshold === null) return [];
    return [{ label, wallets, threshold }];
  });
}

const TIMEFRAMES: Timeframe[] = ["7D", "30D", "90D", "1Y", "ALL"];

function toSeries(value: unknown): Partial<Record<Timeframe, TimeSeriesPoint[]>> {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;
  const out: Partial<Record<Timeframe, TimeSeriesPoint[]>> = {};
  for (const tf of TIMEFRAMES) {
    const points = asArray(source[tf]).flatMap((item) => {
      const d = str(item.date);
      const pct = num(item.profitablePct);
      if (!d || pct === null) return [];
      return [{ date: d, profitablePct: pct, analyzed: num(item.analyzed) ?? 0 }];
    });
    if (points.length > 0) out[tf] = points;
  }
  return out;
}

function asArray(value: unknown): Row[] {
  if (Array.isArray(value)) return value.filter((v): v is Row => typeof v === "object" && v !== null);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
