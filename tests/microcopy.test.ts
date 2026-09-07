import { describe, expect, it } from "vitest";
import {
  AMBIENT_LINES,
  MICROCOPY_RULES,
  ambientLine,
  microcopyFor,
  surprisingStat,
} from "@/lib/metrics/microcopy";
import { makeStat } from "./fixtures";

const counts = (profitable: number, unprofitable: number) => ({
  analyzed: profitable + unprofitable,
  profitable,
  unprofitable,
  breakEven: 0,
  unknown: 0,
});

describe("data-triggered microcopy", () => {
  it("returns nothing when there is no statistic", () => {
    expect(microcopyFor(null)).toBeNull();
  });

  it("returns at most one line, so jokes cannot stack on one number", () => {
    const line = microcopyFor(makeStat({ medianPnlUsd: -900, topOnePctProfitShare: 0.9 }));
    expect(typeof line).toBe("string");
    expect(AMBIENT_LINES).not.toContain(line as never);
  });

  it("uses the brutal line above 90% unprofitable", () => {
    const stat = makeStat({ counts: counts(50, 950), medianPnlUsd: -10, topOnePctProfitShare: 0.1 });
    expect(microcopyFor(stat)).toBe("The chart is not upside down.");
  });

  it("softens between 80 and 90 percent", () => {
    const stat = makeStat({ counts: counts(150, 850), medianPnlUsd: -10, topOnePctProfitShare: 0.1 });
    expect(microcopyFor(stat)).toBe("Most wallets did not enjoy this experiment.");
  });

  it("uses the coin-flip line near even", () => {
    const stat = makeStat({ counts: counts(490, 510), medianPnlUsd: -10, topOnePctProfitShare: 0.1 });
    expect(microcopyFor(stat)).toBe("Surprisingly democratic.");
  });

  it("acknowledges a majority-profitable venue", () => {
    const stat = makeStat({ counts: counts(700, 300), medianPnlUsd: 40, topOnePctProfitShare: 0.1 });
    expect(microcopyFor(stat)).toBe("Wait. People actually made money?");
  });

  it("prioritises the median-loss line over the share-based lines", () => {
    const stat = makeStat({ counts: counts(50, 950), medianPnlUsd: -900 });
    expect(microcopyFor(stat)).toBe("Median wallet: financially humbled.");
  });

  it("keeps every rule reachable", () => {
    for (const rule of MICROCOPY_RULES) {
      expect(rule.line.length).toBeGreaterThan(0);
    }
  });
});

describe("ambient lines", () => {
  it("is deterministic for a given seed, so server and client agree", () => {
    expect(ambientLine("pump-fun")).toBe(ambientLine("pump-fun"));
  });

  it("only ever returns an approved line", () => {
    for (const seed of ["a", "b", "hyperliquid", "kalshi", "zzz", "1234"]) {
      expect(AMBIENT_LINES).toContain(ambientLine(seed) as never);
    }
  });
});

describe("surprising statistic", () => {
  it("builds the one-in-N form from the counts", () => {
    const stat = makeStat({ counts: counts(50, 800) });
    expect(surprisingStat(stat)).toBe("ONLY 1 IN 17 ANALYZED WALLETS FINISHED PROFITABLE");
  });

  it("falls back to concentration when one-in-N would be trivial", () => {
    const stat = makeStat({ counts: counts(600, 400), topOnePctProfitShare: 0.63 });
    expect(surprisingStat(stat)).toBe("THE TOP 1% CAPTURED 63% OF OBSERVED PROFITS");
  });

  it("never invents a statement without a statistic", () => {
    expect(surprisingStat(null)).toBeNull();
  });
});
