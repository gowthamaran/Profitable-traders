import { describe, expect, it } from "vitest";
import {
  EVIDENCE_RUBRIC,
  deriveEvidenceFactors,
  gradeEvidence,
  isStale,
  scoreEvidence,
} from "@/lib/metrics/evidence";
import type { EvidenceFactors, EvidenceSource, ProfitabilityStat } from "@/lib/types";

const ALL_TRUE: EvidenceFactors = {
  officialOrRawChainData: true,
  publicReproducibleSql: true,
  methodologyDisclosed: true,
  largeSample: true,
  recentData: true,
  independentSecondSource: true,
};

function source(overrides: Partial<EvidenceSource> = {}): EvidenceSource {
  return {
    id: "s1",
    role: "primary",
    provider: "Dune Analytics",
    type: "public-sql",
    url: "https://dune.com/queries/1",
    query: "SELECT 1",
    datasetDate: "2025-08-01",
    lastVerified: "2025-08-01",
    sampleSize: 200_000,
    reproducible: true,
    status: "VERIFIED",
    notes: null,
    ...overrides,
  };
}

function stat(overrides: Partial<ProfitabilityStat> = {}): ProfitabilityStat {
  return {
    counts: { analyzed: 200_000, profitable: 20_000, unprofitable: 175_000, breakEven: 3_000, unknown: 2_000 },
    medianPnlUsd: -120,
    meanPnlUsd: -8,
    topOnePctProfitShare: 0.55,
    buckets: [],
    activityBands: [],
    survivorBands: [],
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
    sources: [source()],
    evidenceFactors: ALL_TRUE,
    periodStart: "2025-01-01",
    periodEnd: "2025-08-01",
    lastUpdated: "2025-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("evidence scoring", () => {
  it("totals 100 when every criterion is met", () => {
    expect(scoreEvidence(ALL_TRUE)).toBe(100);
  });

  it("uses the published point values", () => {
    const total = EVIDENCE_RUBRIC.reduce((sum, r) => sum + r.points, 0);
    expect(total).toBe(100);
    expect(EVIDENCE_RUBRIC.find((r) => r.key === "officialOrRawChainData")?.points).toBe(30);
    expect(EVIDENCE_RUBRIC.find((r) => r.key === "publicReproducibleSql")?.points).toBe(25);
  });

  it("scores zero when nothing is met", () => {
    const none = Object.fromEntries(
      EVIDENCE_RUBRIC.map((r) => [r.key, false]),
    ) as unknown as EvidenceFactors;
    expect(scoreEvidence(none)).toBe(0);
  });

  it("maps scores to the published grade bands", () => {
    expect(gradeEvidence(100)).toBe("VERY HIGH");
    expect(gradeEvidence(90)).toBe("VERY HIGH");
    expect(gradeEvidence(89)).toBe("HIGH");
    expect(gradeEvidence(75)).toBe("HIGH");
    expect(gradeEvidence(74)).toBe("MEDIUM");
    expect(gradeEvidence(55)).toBe("MEDIUM");
    expect(gradeEvidence(54)).toBe("LOW");
    expect(gradeEvidence(0)).toBe("LOW");
  });
});

describe("deriving factors from the record", () => {
  const now = new Date("2025-08-15T00:00:00Z");

  it("credits reproducible SQL only when a query is attached", () => {
    expect(deriveEvidenceFactors(stat(), now).publicReproducibleSql).toBe(true);
    const noQuery = stat({ sources: [source({ query: null })] });
    expect(deriveEvidenceFactors(noQuery, now).publicReproducibleSql).toBe(false);
  });

  it("requires a second provider for the independent-source points", () => {
    const oneProvider = stat({ sources: [source(), source({ id: "s2", role: "secondary" })] });
    expect(deriveEvidenceFactors(oneProvider, now).independentSecondSource).toBe(false);

    const twoProviders = stat({
      sources: [source(), source({ id: "s2", role: "secondary", provider: "Flipside Crypto" })],
    });
    expect(deriveEvidenceFactors(twoProviders, now).independentSecondSource).toBe(true);
  });

  it("treats a sample under 100,000 as small", () => {
    const small = stat({
      counts: { analyzed: 99_999, profitable: 1, unprofitable: 99_998, breakEven: 0, unknown: 0 },
    });
    expect(deriveEvidenceFactors(small, now).largeSample).toBe(false);
  });

  it("drops the recency points once the window is over 90 days old", () => {
    const old = stat({ periodEnd: "2024-01-01" });
    expect(deriveEvidenceFactors(old, now).recentData).toBe(false);
  });

  it("scores a fully sourced record above a bare one", () => {
    const strong = stat({
      sources: [
        source({ type: "onchain-raw" }),
        source({ id: "s2", role: "secondary", provider: "Flipside Crypto" }),
      ],
    });
    const weak = stat({
      sources: [source({ type: "aggregator", reproducible: false, query: null })],
      periodEnd: "2023-01-01",
    });
    expect(scoreEvidence(deriveEvidenceFactors(strong, now))).toBeGreaterThan(
      scoreEvidence(deriveEvidenceFactors(weak, now)),
    );
  });
});

describe("staleness", () => {
  it("flags data older than 180 days", () => {
    expect(isStale(stat({ lastUpdated: "2024-01-01T00:00:00Z" }), new Date("2025-08-15"))).toBe(true);
    expect(isStale(stat({ lastUpdated: "2025-08-01T00:00:00Z" }), new Date("2025-08-15"))).toBe(false);
  });
});
