import type { AdapterRequest, AdapterResponse, SourceAdapter } from "./types";
import { failure } from "./types";
import { getJson } from "./http";

/**
 * Dune Analytics. `resourceId` is the query id whose latest execution holds the
 * wallet counts.
 *
 * The adapter requires the query to return the counts it needs under known
 * column names. If the shape does not match we fail loudly rather than guess
 * which column meant "profitable" -- a mis-mapped column would produce a
 * plausible number with no relationship to reality.
 */
const REQUIRED_COLUMNS = ["wallets_analyzed", "wallets_profitable", "wallets_unprofitable"] as const;

export class DuneAdapter implements SourceAdapter {
  id = "dune";
  provider = "Dune Analytics";

  isConfigured(): boolean {
    return Boolean(process.env.DUNE_API_KEY);
  }

  async fetchProfitability(request: AdapterRequest): Promise<AdapterResponse> {
    const key = process.env.DUNE_API_KEY;
    if (!key) return failure("DUNE_API_KEY is not configured");

    const response = await getJson(
      `https://api.dune.com/api/v1/query/${encodeURIComponent(request.resourceId)}/results?limit=1`,
      { headers: { "X-Dune-API-Key": key } },
    );
    if (!response.ok) return failure(response.reason, response.retriable);

    const payload = response.data as {
      result?: { rows?: Array<Record<string, unknown>> };
      execution_ended_at?: string;
    };
    const row = payload.result?.rows?.[0];
    if (!row) return failure(`Dune query ${request.resourceId} returned no rows`, true);

    const missing = REQUIRED_COLUMNS.filter((column) => !(column in row));
    if (missing.length > 0) {
      return failure(
        `Dune query ${request.resourceId} is missing required columns: ${missing.join(", ")}. ` +
          `The adapter will not infer them from other columns.`,
      );
    }

    const analyzed = numeric(row.wallets_analyzed);
    const profitable = numeric(row.wallets_profitable);
    const unprofitable = numeric(row.wallets_unprofitable);
    const breakEven = numeric(row.wallets_break_even) ?? 0;
    const unknown = numeric(row.wallets_unknown) ?? 0;

    if (analyzed === null || profitable === null || unprofitable === null) {
      return failure(`Dune query ${request.resourceId} returned non-numeric counts`);
    }
    if (profitable + unprofitable + breakEven + unknown !== analyzed) {
      return failure(
        `Dune query ${request.resourceId} counts do not sum to the analyzed total ` +
          `(${profitable} + ${unprofitable} + ${breakEven} + ${unknown} != ${analyzed})`,
      );
    }

    return {
      ok: true,
      counts: { analyzed, profitable, unprofitable, breakEven, unknown },
      medianPnlUsd: numeric(row.median_pnl_usd),
      meanPnlUsd: numeric(row.mean_pnl_usd),
      topOnePctProfitShare: numeric(row.top_1pct_profit_share),
      source: {
        id: `dune-${request.resourceId}`,
        role: "primary",
        provider: this.provider,
        type: "public-sql",
        url: `https://dune.com/queries/${request.resourceId}`,
        query: typeof row.query_sql === "string" ? row.query_sql : null,
        datasetDate: payload.execution_ended_at ?? request.periodEnd,
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

function numeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
