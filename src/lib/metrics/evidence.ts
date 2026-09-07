import type { EvidenceFactors, EvidenceGrade, EvidenceSource, ProfitabilityStat } from "@/lib/types";

/**
 * The evidence rubric, published verbatim on /methodology.
 *
 * The score grades the *evidence*, not the platform. A venue can be brutal for
 * traders and still score 100 because its data is fully reproducible.
 */
export const EVIDENCE_RUBRIC: ReadonlyArray<{
  key: keyof EvidenceFactors;
  points: number;
  label: string;
  detail: string;
}> = [
  {
    key: "officialOrRawChainData",
    points: 30,
    label: "Official or raw blockchain data",
    detail: "The figure derives from chain state or a first-party API, not a third-party summary.",
  },
  {
    key: "publicReproducibleSql",
    points: 25,
    label: "Public reproducible SQL",
    detail: "The exact query is published and can be re-run by anyone.",
  },
  {
    key: "methodologyDisclosed",
    points: 15,
    label: "Methodology disclosed",
    detail: "PnL definition, fee treatment, filters and exclusions are all stated.",
  },
  { key: "largeSample", points: 10, label: "Sample over 100,000", detail: "Large enough that tail noise does not drive the headline." },
  { key: "recentData", points: 10, label: "Recent data", detail: "The dataset window ends within the last 90 days." },
  {
    key: "independentSecondSource",
    points: 10,
    label: "Independent second source",
    detail: "A separate provider reproduces the result within tolerance.",
  },
];

export const LARGE_SAMPLE_THRESHOLD = 100_000;
export const RECENT_DATA_MAX_AGE_DAYS = 90;

export function scoreEvidence(factors: EvidenceFactors): number {
  return EVIDENCE_RUBRIC.reduce((total, rule) => total + (factors[rule.key] ? rule.points : 0), 0);
}

export function gradeEvidence(score: number): EvidenceGrade {
  if (score >= 90) return "VERY HIGH";
  if (score >= 75) return "HIGH";
  if (score >= 55) return "MEDIUM";
  return "LOW";
}

/**
 * Derive the factors from the record itself rather than trusting a stored
 * number, so a score can never drift away from the evidence behind it.
 */
export function deriveEvidenceFactors(stat: ProfitabilityStat, now = new Date()): EvidenceFactors {
  const sources = stat.sources;
  const providers = new Set(sources.map((s) => s.provider.toLowerCase()));
  const ageDays = daysBetween(new Date(stat.periodEnd), now);

  return {
    officialOrRawChainData: sources.some(
      (s) => s.type === "onchain-raw" || s.type === "official-api" || s.type === "indexer",
    ),
    publicReproducibleSql: sources.some((s) => s.reproducible && Boolean(s.query)),
    methodologyDisclosed: isMethodologyDisclosed(stat),
    largeSample: stat.counts.analyzed >= LARGE_SAMPLE_THRESHOLD,
    recentData: ageDays <= RECENT_DATA_MAX_AGE_DAYS,
    independentSecondSource: providers.size >= 2 && sources.some((s) => s.role !== "primary"),
  };
}

function isMethodologyDisclosed(stat: ProfitabilityStat): boolean {
  const m = stat.methodology;
  return Boolean(m.pnlDefinition && m.calculationVersion && m.dateRangeStart && m.dateRangeEnd);
}

export function evidenceScoreFor(stat: ProfitabilityStat, now = new Date()): number {
  return scoreEvidence(deriveEvidenceFactors(stat, now));
}

export function daysBetween(from: Date, to: Date): number {
  return Math.abs(to.getTime() - from.getTime()) / 86_400_000;
}

/** Data old enough that the reader should be told before they quote it. */
export function isStale(stat: ProfitabilityStat, now = new Date()): boolean {
  return daysBetween(new Date(stat.lastUpdated), now) > 180;
}

export function countIndependentSources(sources: EvidenceSource[]): number {
  return new Set(sources.map((s) => s.provider.toLowerCase())).size;
}
