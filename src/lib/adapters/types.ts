import type { EvidenceSource, WalletCounts } from "@/lib/types";

/**
 * The contract every upstream must satisfy.
 *
 * An adapter's job is to return counts plus the provenance that justifies
 * them. An adapter that cannot reach its upstream returns a failure -- it
 * never returns partial counts, because a partial count is indistinguishable
 * from a real one once it is in the database.
 */

export interface AdapterRequest {
  platformSlug: string;
  periodStart: string;
  periodEnd: string;
  /** Adapter-specific handle: a query id, a contract address, a market id. */
  resourceId: string;
}

export interface AdapterResult {
  ok: true;
  counts: WalletCounts;
  medianPnlUsd: number | null;
  meanPnlUsd: number | null;
  topOnePctProfitShare: number | null;
  source: EvidenceSource;
  raw: unknown;
}

export interface AdapterFailure {
  ok: false;
  /** Why no number is available. Surfaced verbatim in the admin queue. */
  reason: string;
  retriable: boolean;
}

export type AdapterResponse = AdapterResult | AdapterFailure;

export interface SourceAdapter {
  id: string;
  provider: string;
  /** False when the adapter has no credentials configured. */
  isConfigured(): boolean;
  fetchProfitability(request: AdapterRequest): Promise<AdapterResponse>;
}

export function failure(reason: string, retriable = false): AdapterFailure {
  return { ok: false, reason, retriable };
}
