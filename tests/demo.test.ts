import { describe, expect, it } from "vitest";
import { demoPlatforms } from "@/lib/data/demo";
import { countsAreConsistent, profitablePct } from "@/lib/metrics/profitability";
import { evidenceScoreFor } from "@/lib/metrics/evidence";

const platforms = demoPlatforms();

describe("demo dataset labelling", () => {
  it("marks every generated statistic as demo", () => {
    for (const platform of platforms) {
      if (platform.stat) {
        expect(platform.isDemo, `${platform.slug} carries a statistic`).toBe(true);
      }
    }
  });

  it("never attaches a real-looking source to a synthetic number", () => {
    // A fabricated figure behind a plausible Dune link is the single most
    // damaging thing this codebase could ship.
    for (const platform of platforms.filter((p) => p.isDemo)) {
      for (const source of platform.stat?.sources ?? []) {
        expect(source.provider).toBe("DEMO");
        expect(source.url).toBeNull();
        expect(source.status).toBe("UNVERIFIED");
        expect(source.reproducible).toBe(false);
      }
    }
  });

  it("keeps demo evidence scores low, which is the honest result", () => {
    for (const platform of platforms.filter((p) => p.isDemo)) {
      expect(evidenceScoreFor(platform.stat!)).toBeLessThan(55);
    }
  });
});

describe("demo dataset integrity", () => {
  it("produces counts that add up", () => {
    for (const platform of platforms) {
      if (platform.stat) {
        expect(countsAreConsistent(platform.stat.counts), platform.slug).toBe(true);
      }
    }
  });

  it("keeps bucket totals equal to the analyzed count", () => {
    for (const platform of platforms) {
      if (!platform.stat) continue;
      const bucketTotal = platform.stat.buckets.reduce((sum, b) => sum + b.wallets, 0);
      const nonBucketed = platform.stat.counts.breakEven + platform.stat.counts.unknown;
      expect(bucketTotal + nonBucketed, platform.slug).toBe(platform.stat.counts.analyzed);
    }
  });

  it("never reports a survivor band larger than the profitable count", () => {
    for (const platform of platforms) {
      if (!platform.stat) continue;
      for (const band of platform.stat.survivorBands) {
        expect(band.wallets, `${platform.slug} ${band.label}`).toBeLessThanOrEqual(
          platform.stat.counts.profitable,
        );
      }
    }
  });

  it("keeps every activity band's profitable count within its wallet count", () => {
    for (const platform of platforms) {
      for (const band of platform.stat?.activityBands ?? []) {
        expect(band.profitable).toBeLessThanOrEqual(band.wallets);
      }
    }
  });

  it("generates percentages inside 0-100", () => {
    for (const platform of platforms) {
      if (!platform.stat) continue;
      const p = profitablePct(platform.stat.counts);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(100);
    }
  });

  it("is deterministic across calls, so builds are stable", () => {
    const a = JSON.stringify(demoPlatforms());
    const b = JSON.stringify(demoPlatforms());
    expect(a).toBe(b);
  });
});

describe("platforms with no participant data", () => {
  it("gives centralized casinos no statistic at all", () => {
    const casinos = platforms.filter((p) => p.category === "casinos");
    expect(casinos.length).toBeGreaterThan(0);
    for (const casino of casinos) {
      expect(casino.stat, `${casino.slug} must not carry a number`).toBeNull();
      expect(casino.unknownReason).toBe("centralized-no-participant-data");
      expect(casino.dataAvailabilityNote).toBeTruthy();
    }
  });

  it("explains what is and is not available wherever a statistic is missing", () => {
    for (const platform of platforms.filter((p) => !p.stat)) {
      expect(platform.dataAvailabilityNote!.length).toBeGreaterThan(80);
      expect(platform.unknownReason).not.toBeNull();
    }
  });

  it("excludes Polymarket entirely", () => {
    const names = platforms.map((p) => `${p.slug} ${p.name}`.toLowerCase()).join(" ");
    expect(names).not.toContain("polymarket");
  });
});
