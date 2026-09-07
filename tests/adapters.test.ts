import { afterEach, describe, expect, it, vi } from "vitest";
import { DuneAdapter } from "@/lib/adapters/dune";
import { HyperliquidAdapter } from "@/lib/adapters/hyperliquid";
import { collect } from "@/lib/adapters";

const request = {
  platformSlug: "example",
  periodStart: "2025-01-01",
  periodEnd: "2025-08-01",
  resourceId: "12345",
};

function mockJson(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => body,
  } as unknown as Response);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Dune adapter", () => {
  it("reports missing credentials rather than returning a number", async () => {
    vi.stubEnv("DUNE_API_KEY", "");
    const result = await new DuneAdapter().fetchProfitability(request);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/DUNE_API_KEY/);
  });

  it("refuses to guess when required columns are absent", async () => {
    vi.stubEnv("DUNE_API_KEY", "key");
    vi.stubGlobal("fetch", mockJson({ result: { rows: [{ total_users: 5000 }] } }));

    const result = await new DuneAdapter().fetchProfitability(request);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/missing required columns/);
      expect(result.reason).toMatch(/will not infer/);
    }
  });

  it("rejects a row whose counts do not sum to the analyzed total", async () => {
    vi.stubEnv("DUNE_API_KEY", "key");
    vi.stubGlobal(
      "fetch",
      mockJson({
        result: {
          rows: [
            {
              wallets_analyzed: 1000,
              wallets_profitable: 100,
              wallets_unprofitable: 800,
              wallets_break_even: 50,
              wallets_unknown: 10,
            },
          ],
        },
      }),
    );

    const result = await new DuneAdapter().fetchProfitability(request);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/do not sum/);
  });

  it("returns counts and provenance when the shape is right", async () => {
    vi.stubEnv("DUNE_API_KEY", "key");
    vi.stubGlobal(
      "fetch",
      mockJson({
        execution_ended_at: "2025-08-02T00:00:00Z",
        result: {
          rows: [
            {
              wallets_analyzed: 1000,
              wallets_profitable: 100,
              wallets_unprofitable: 850,
              wallets_break_even: 40,
              wallets_unknown: 10,
              median_pnl_usd: -120,
              top_1pct_profit_share: 0.61,
            },
          ],
        },
      }),
    );

    const result = await new DuneAdapter().fetchProfitability(request);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.counts.analyzed).toBe(1000);
      expect(result.counts.profitable).toBe(100);
      expect(result.medianPnlUsd).toBe(-120);
      expect(result.topOnePctProfitShare).toBe(0.61);
      expect(result.source.provider).toBe("Dune Analytics");
      expect(result.source.url).toContain("12345");
      expect(result.source.reproducible).toBe(true);
    }
  });

  it("treats a 404 as non-retriable and a 500 as retriable", async () => {
    vi.stubEnv("DUNE_API_KEY", "key");

    vi.stubGlobal("fetch", mockJson({}, 404));
    const missing = await new DuneAdapter().fetchProfitability(request);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.retriable).toBe(false);

    vi.stubGlobal("fetch", mockJson({}, 500));
    const broken = await new DuneAdapter().fetchProfitability(request);
    expect(broken.ok).toBe(false);
    if (!broken.ok) expect(broken.retriable).toBe(true);
  });
});

describe("Hyperliquid adapter", () => {
  it("declines to fabricate an aggregate it cannot compute", async () => {
    const result = await new HyperliquidAdapter().fetchProfitability(request);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/No number is produced/);
  });
});

describe("adapter registry", () => {
  it("fails clearly on an unknown adapter id", async () => {
    const result = await collect("does-not-exist", request);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/Unknown adapter/);
  });

  it("refuses to run an adapter with no credentials", async () => {
    vi.stubEnv("DUNE_API_KEY", "");
    const result = await collect("dune", request);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/no credentials configured/);
  });
});
