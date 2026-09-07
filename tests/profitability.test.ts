import { describe, expect, it } from "vitest";
import {
  breakEvenPct,
  countsAreConsistent,
  isLosingBucket,
  losingBuckets,
  oneInN,
  profitablePct,
  totalLosingWallets,
  unknownPct,
  unprofitablePct,
} from "@/lib/metrics/profitability";
import type { WalletCounts } from "@/lib/types";
import { makeStat } from "./fixtures";

const counts: WalletCounts = {
  analyzed: 1000,
  profitable: 40,
  unprofitable: 930,
  breakEven: 20,
  unknown: 10,
};

describe("profitability percentages", () => {
  it("computes shares against the full analyzed total", () => {
    expect(profitablePct(counts)).toBe(4);
    expect(unprofitablePct(counts)).toBe(93);
    expect(breakEvenPct(counts)).toBe(2);
    expect(unknownPct(counts)).toBe(1);
  });

  it("keeps break-even and unknown wallets in the denominator", () => {
    // Dropping them would report 40/970 = 4.12% instead of 4.00%. The whole
    // point of this site is that the denominator is not quietly favourable.
    const trimmed = profitablePct({ ...counts, analyzed: 970, breakEven: 0, unknown: 0 });
    expect(trimmed).toBeGreaterThan(profitablePct(counts));
  });

  it("sums to 100 across every segment", () => {
    const total =
      profitablePct(counts) + unprofitablePct(counts) + breakEvenPct(counts) + unknownPct(counts);
    expect(total).toBeCloseTo(100, 10);
  });

  it("returns zero rather than NaN for an empty sample", () => {
    const empty: WalletCounts = {
      analyzed: 0,
      profitable: 0,
      unprofitable: 0,
      breakEven: 0,
      unknown: 0,
    };
    expect(profitablePct(empty)).toBe(0);
    expect(unprofitablePct(empty)).toBe(0);
  });

  it("validates that counts add up", () => {
    expect(countsAreConsistent(counts)).toBe(true);
    expect(countsAreConsistent({ ...counts, profitable: 41 })).toBe(false);
  });

  it("expresses the headline as one in N", () => {
    expect(oneInN(counts)).toBe(25);
    expect(oneInN({ ...counts, profitable: 0, unprofitable: 970 })).toBeNull();
  });
});

describe("loss bucket classification", () => {
  const stat = makeStat();

  it("treats the open-ended bottom bucket as a loss", () => {
    expect(isLosingBucket({ min: null, max: -10_000, label: "< -$10k", wallets: 1 })).toBe(true);
  });

  it("does not treat the open-ended top bucket as a loss", () => {
    // Regression: reading a null max as 0 filed the biggest winners under
    // losses, which reddened the top bar and padded the graveyard.
    expect(isLosingBucket({ min: 10_000, max: null, label: "> $10k", wallets: 1 })).toBe(false);
  });

  it("counts the bucket ending exactly at zero as a loss", () => {
    expect(isLosingBucket({ min: -100, max: 0, label: "-$100 to $0", wallets: 1 })).toBe(true);
  });

  it("excludes every profit bucket from the losing set", () => {
    const losing = losingBuckets(stat);
    expect(losing.map((b) => b.label)).toEqual([
      "< -$10k",
      "-$10k to -$1k",
      "-$1k to -$100",
      "-$100 to $0",
    ]);
    expect(totalLosingWallets(stat)).toBe(88_000);
  });
});
