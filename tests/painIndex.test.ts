import { describe, expect, it } from "vitest";
import { PAIN_INDEX_WEIGHTS, computePainIndex, lossSeverity } from "@/lib/metrics/painIndex";
import { makeStat } from "./fixtures";

describe("pain index", () => {
  it("publishes weights that sum to one", () => {
    const total = Object.values(PAIN_INDEX_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it("stays inside 0-100", () => {
    const worst = computePainIndex(
      makeStat({
        counts: { analyzed: 1000, profitable: 0, unprofitable: 1000, breakEven: 0, unknown: 0 },
        medianPnlUsd: -100_000,
        topOnePctProfitShare: 1,
      }),
    );
    expect(worst.score).toBeGreaterThanOrEqual(0);
    expect(worst.score).toBeLessThanOrEqual(100);
  });

  it("scores a brutal venue above a mild one", () => {
    const brutal = computePainIndex(
      makeStat({
        counts: { analyzed: 1000, profitable: 20, unprofitable: 980, breakEven: 0, unknown: 0 },
        medianPnlUsd: -2_000,
      }),
    );
    const mild = computePainIndex(
      makeStat({
        counts: { analyzed: 1000, profitable: 480, unprofitable: 520, breakEven: 0, unknown: 0 },
        medianPnlUsd: -20,
      }),
    );
    expect(brutal.score).toBeGreaterThan(mild.score);
  });

  it("redistributes the weight of a missing input instead of scoring it zero", () => {
    const complete = computePainIndex(makeStat());
    const missing = computePainIndex(makeStat({ topOnePctProfitShare: null }));

    const concentration = missing.components.find((c) => c.key === "profitConcentration");
    expect(concentration?.available).toBe(false);
    expect(concentration?.contribution).toBe(0);
    expect(missing.redistributedWeight).toBeCloseTo(PAIN_INDEX_WEIGHTS.profitConcentration, 10);

    // The remaining weights are scaled up to fill the gap, so they still sum to 1.
    const availableWeight = missing.components
      .filter((c) => c.available)
      .reduce((sum, c) => sum + c.weight, 0);
    expect(availableWeight).toBeCloseTo(1, 10);
    expect(complete.redistributedWeight).toBeCloseTo(0, 10);
  });

  it("reports every component with its input, available or not", () => {
    const breakdown = computePainIndex(makeStat({ topOnePctProfitShare: null }));
    expect(breakdown.components).toHaveLength(5);
    for (const component of breakdown.components) {
      expect(component.inputLabel.length).toBeGreaterThan(0);
    }
  });

  it("computes loss severity as the share of losers below -$1,000", () => {
    // 2,000 + 14,000 heavy losses out of 88,000 losing wallets.
    expect(lossSeverity(makeStat())).toBeCloseTo(16_000 / 88_000, 6);
  });

  it("returns null severity when no distribution is on record", () => {
    expect(lossSeverity(makeStat({ buckets: [] }))).toBeNull();
  });
});
