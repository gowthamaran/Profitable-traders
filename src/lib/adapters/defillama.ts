import { getJson } from "./http";

/**
 * DefiLlama supplies venue context -- TVL, volume, chains -- not participant
 * profitability. It is deliberately NOT a SourceAdapter: nothing it returns
 * can support a profitability percentage, and typing it as one would invite
 * exactly that mistake.
 */
export interface VenueContext {
  tvlUsd: number | null;
  volume24hUsd: number | null;
  chains: string[];
}

export class DefiLlamaContext {
  id = "defillama";
  provider = "DefiLlama";

  isConfigured(): boolean {
    return true; // No key required.
  }

  async fetchContext(protocolSlug: string): Promise<VenueContext | null> {
    const response = await getJson(`https://api.llama.fi/protocol/${encodeURIComponent(protocolSlug)}`);
    if (!response.ok) return null;
    const payload = response.data as {
      currentChainTvls?: Record<string, number>;
      chains?: string[];
    };
    const tvls = payload.currentChainTvls ?? {};
    const total = Object.values(tvls).reduce((sum, v) => sum + (Number.isFinite(v) ? v : 0), 0);
    return {
      tvlUsd: total > 0 ? total : null,
      volume24hUsd: null,
      chains: Array.isArray(payload.chains) ? payload.chains : [],
    };
  }
}
