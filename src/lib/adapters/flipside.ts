import type { AdapterRequest, AdapterResponse, SourceAdapter } from "./types";
import { failure } from "./types";
import { getJson } from "./http";

/**
 * Flipside Crypto. `resourceId` is a query run id from their REST API.
 * Used mainly as the independent second source that earns the final ten
 * points of the evidence score.
 */
export class FlipsideAdapter implements SourceAdapter {
  id = "flipside";
  provider = "Flipside Crypto";

  isConfigured(): boolean {
    return Boolean(process.env.FLIPSIDE_API_KEY);
  }

  async fetchProfitability(request: AdapterRequest): Promise<AdapterResponse> {
    const key = process.env.FLIPSIDE_API_KEY;
    if (!key) return failure("FLIPSIDE_API_KEY is not configured");

    const response = await getJson(
      `https://api-v2.flipsidecrypto.xyz/json-rpc/queryRun/${encodeURIComponent(request.resourceId)}/results`,
      { headers: { "x-api-key": key } },
    );
    if (!response.ok) return failure(response.reason, response.retriable);

    const payload = response.data as { rows?: Array<Record<string, unknown>> };
    const row = payload.rows?.[0];
    if (!row) return failure(`Flipside run ${request.resourceId} returned no rows`, true);

    const analyzed = Number(row.wallets_analyzed);
    const profitable = Number(row.wallets_profitable);
    const unprofitable = Number(row.wallets_unprofitable);
    if (![analyzed, profitable, unprofitable].every(Number.isFinite)) {
      return failure(`Flipside run ${request.resourceId} did not return the required counts`);
    }

    const breakEven = Number(row.wallets_break_even ?? 0) || 0;
    const unknown = Number(row.wallets_unknown ?? 0) || 0;
    if (profitable + unprofitable + breakEven + unknown !== analyzed) {
      return failure(`Flipside run ${request.resourceId} counts do not sum to the analyzed total`);
    }

    return {
      ok: true,
      counts: { analyzed, profitable, unprofitable, breakEven, unknown },
      medianPnlUsd: Number.isFinite(Number(row.median_pnl_usd)) ? Number(row.median_pnl_usd) : null,
      meanPnlUsd: Number.isFinite(Number(row.mean_pnl_usd)) ? Number(row.mean_pnl_usd) : null,
      topOnePctProfitShare: Number.isFinite(Number(row.top_1pct_profit_share))
        ? Number(row.top_1pct_profit_share)
        : null,
      source: {
        id: `flipside-${request.resourceId}`,
        role: "secondary",
        provider: this.provider,
        type: "public-sql",
        url: `https://flipsidecrypto.xyz/`,
        query: typeof row.query_sql === "string" ? row.query_sql : null,
        datasetDate: request.periodEnd,
        lastVerified: new Date().toISOString(),
        sampleSize: analyzed,
        reproducible: true,
        status: "VERIFIED",
        notes: null,
      },
      raw: payload,
    };
  }
}
