import { describe, expect, it } from "vitest";
import { activityDecline, activityDrop, badgesFor } from "@/lib/metrics/badges";
import { makePlatform, makeStat } from "./fixtures";

describe("badges", () => {
  it("gives DATA BLACK HOLE and nothing else to a platform with no statistic", () => {
    const badges = badgesFor(makePlatform({ stat: null }), []);
    expect(badges.map((b) => b.id)).toEqual(["DATA BLACK HOLE"]);
  });

  it("awards THE MEAT GRINDER at 90% unprofitable or worse", () => {
    const platform = makePlatform({
      stat: makeStat({
        counts: { analyzed: 1000, profitable: 50, unprofitable: 900, breakEven: 30, unknown: 20 },
      }),
    });
    expect(badgesFor(platform, [platform]).map((b) => b.id)).toContain("THE MEAT GRINDER");
  });

  it("does not award THE MEAT GRINDER just below the threshold", () => {
    const platform = makePlatform({
      stat: makeStat({
        counts: { analyzed: 1000, profitable: 150, unprofitable: 899, breakEven: 1, unknown: 0 },
      }),
    });
    expect(badgesFor(platform, [platform]).map((b) => b.id)).not.toContain("THE MEAT GRINDER");
  });

  it("awards COIN FLIP within five points of even", () => {
    const platform = makePlatform({
      stat: makeStat({
        counts: { analyzed: 1000, profitable: 480, unprofitable: 520, breakEven: 0, unknown: 0 },
      }),
    });
    expect(badgesFor(platform, [platform]).map((b) => b.id)).toContain("COIN FLIP");
  });

  it("awards WHALE PLAYGROUND on high profit concentration", () => {
    const platform = makePlatform({ stat: makeStat({ topOnePctProfitShare: 0.72 }) });
    expect(badgesFor(platform, [platform]).map((b) => b.id)).toContain("WHALE PLAYGROUND");
  });

  it("awards SURVIVOR MODE on a relative decline, so low-baseline venues qualify", () => {
    // 8% across all wallets against 4% among the most active: a 50% relative
    // fall. An absolute-points rule would have missed this entirely.
    expect(activityDrop(makePlatform())).toBeCloseTo(4, 6);
    expect(activityDecline(makePlatform())?.ratio).toBeCloseTo(0.5, 6);
    expect(badgesFor(makePlatform(), [makePlatform()]).map((b) => b.id)).toContain("SURVIVOR MODE");
  });

  it("reaches the SURVIVOR MODE threshold even when almost nobody is profitable", () => {
    // 3% baseline. No absolute drop of 10 points is arithmetically possible.
    const lowBaseline = makePlatform({
      stat: makeStat({
        counts: { analyzed: 100_000, profitable: 3_000, unprofitable: 97_000, breakEven: 0, unknown: 0 },
        activityBands: [
          { label: "All wallets", minTrades: 0, wallets: 100_000, profitable: 3_000 },
          { label: "100+ trades", minTrades: 100, wallets: 5_000, profitable: 50 },
        ],
      }),
    });
    expect(activityDrop(lowBaseline)!).toBeLessThan(10);
    expect(badgesFor(lowBaseline, [lowBaseline]).map((b) => b.id)).toContain("SURVIVOR MODE");
  });

  it("withholds SURVIVOR MODE when activity barely changes the rate", () => {
    const flat = makePlatform({
      stat: makeStat({
        activityBands: [
          { label: "All wallets", minTrades: 0, wallets: 100_000, profitable: 8_000 },
          { label: "100+ trades", minTrades: 100, wallets: 5_000, profitable: 380 },
        ],
      }),
    });
    expect(badgesFor(flat, [flat]).map((b) => b.id)).not.toContain("SURVIVOR MODE");
  });

  it("ignores a most-active band too small to mean anything", () => {
    const tinyBand = makePlatform({
      stat: makeStat({
        activityBands: [
          { label: "All wallets", minTrades: 0, wallets: 100_000, profitable: 8_000 },
          { label: "500+ trades", minTrades: 500, wallets: 12, profitable: 0 },
        ],
      }),
    });
    expect(activityDecline(tinyBand)).toBeNull();
    expect(badgesFor(tinyBand, [tinyBand]).map((b) => b.id)).not.toContain("SURVIVOR MODE");
  });

  it("awards RECEIPTS PROVIDED only with a full evidence score and a query", () => {
    const strong = makePlatform({
      stat: makeStat({
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
          {
            id: "s2",
            role: "secondary",
            provider: "Flipside Crypto",
            type: "public-sql",
            url: "https://flipsidecrypto.xyz",
            query: "SELECT 2",
            datasetDate: "2025-08-01",
            lastVerified: "2025-08-01",
            sampleSize: 100_000,
            reproducible: true,
            status: "VERIFIED",
            notes: null,
          },
        ],
      }),
    });
    const now = new Date("2025-08-15");
    expect(badgesFor(strong, [strong], now).map((b) => b.id)).toContain("RECEIPTS PROVIDED");
  });

  it("never awards MOST WALLET-FRIENDLY without a field to compare against", () => {
    const solo = makePlatform();
    expect(badgesFor(solo, [solo]).map((b) => b.id)).not.toContain("MOST WALLET-FRIENDLY");
  });

  it("gives MOST WALLET-FRIENDLY to the best well-evidenced platform", () => {
    const now = new Date("2025-08-15");
    const good = makePlatform({
      slug: "good",
      stat: makeStat({
        counts: { analyzed: 100_000, profitable: 40_000, unprofitable: 60_000, breakEven: 0, unknown: 0 },
      }),
    });
    const bad = makePlatform({
      slug: "bad",
      stat: makeStat({
        counts: { analyzed: 100_000, profitable: 2_000, unprofitable: 98_000, breakEven: 0, unknown: 0 },
      }),
    });
    const field = [good, bad];
    expect(badgesFor(good, field, now).map((b) => b.id)).toContain("MOST WALLET-FRIENDLY");
    expect(badgesFor(bad, field, now).map((b) => b.id)).not.toContain("MOST WALLET-FRIENDLY");
  });
});
