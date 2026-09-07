import { DuneAdapter } from "./dune";
import { FlipsideAdapter } from "./flipside";
import { HyperliquidAdapter } from "./hyperliquid";
import type { AdapterRequest, AdapterResponse, SourceAdapter } from "./types";

export const ADAPTERS: SourceAdapter[] = [
  new DuneAdapter(),
  new FlipsideAdapter(),
  new HyperliquidAdapter(),
];

export function adapterById(id: string): SourceAdapter | null {
  return ADAPTERS.find((a) => a.id === id) ?? null;
}

export function configuredAdapters(): SourceAdapter[] {
  return ADAPTERS.filter((a) => a.isConfigured());
}

/**
 * Run one adapter and hand the result to the review queue.
 *
 * Note what this does NOT do: publish. A successful fetch produces a pending
 * record. Section 43 requires a human approval before any number is public.
 */
export async function collect(adapterId: string, request: AdapterRequest): Promise<AdapterResponse> {
  const adapter = adapterById(adapterId);
  if (!adapter) {
    return { ok: false, reason: `Unknown adapter: ${adapterId}`, retriable: false };
  }
  if (!adapter.isConfigured()) {
    return { ok: false, reason: `${adapter.provider} has no credentials configured`, retriable: false };
  }
  return adapter.fetchProfitability(request);
}

export type { AdapterRequest, AdapterResponse, SourceAdapter };
