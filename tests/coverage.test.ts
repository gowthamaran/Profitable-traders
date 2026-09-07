import { describe, expect, it } from "vitest";
import { demoPlatforms } from "@/lib/data/demo";
import { visiblePlatforms } from "@/lib/data/coverage";

describe("public platform coverage", () => {
  it("removes empty listings without hiding available results", () => {
    const rows = visiblePlatforms(demoPlatforms());
    expect(rows.some(p => p.slug === "pump-fun" && p.stat)).toBe(true);
    for (const slug of ["rollbit", "stake", "shuffle", "bc-game", "drift", "dydx"]) {
      expect(rows.some(p => p.slug === slug)).toBe(false);
    }
  });
  it("adds Fomo reports without inventing or borrowing a statistic", () => {
    const rows = visiblePlatforms([]);
    const fomo = rows.find(p => p.slug === "fomo")!;
    expect(fomo.stat).toBeNull();
    expect(fomo.isDemo).toBe(false);
    expect(fomo.profitabilityReports?.length).toBe(3);
    expect(rows.filter(p => p.stat)).toHaveLength(0);
  });
  it("does not duplicate Fomo when coverage is applied again", () => {
    const rows = visiblePlatforms(visiblePlatforms(demoPlatforms()));
    expect(rows.filter(p => p.slug === "fomo")).toHaveLength(1);
  });
});
