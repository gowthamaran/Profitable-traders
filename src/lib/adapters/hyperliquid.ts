import type { AdapterRequest, AdapterResponse, SourceAdapter } from "./types";
import { failure } from "./types";

/**
 * Hyperliquid's public info API exposes per-address state, but there is no
 * endpoint that returns an aggregate profitability distribution.
 *
 * Rather than page every address and call the result a census, this adapter
 * reports what it cannot do. Building the wallet set is an indexing job that
 * belongs in the pipeline, not in a request handler, and until that exists the
 * platform stays at PROFITABILITY: UNKNOWN.
 */
export class HyperliquidAdapter implements SourceAdapter {
  id = "hyperliquid";
  provider = "Hyperliquid";

  isConfigured(): boolean {
    return true;
  }

  async fetchProfitability(_request: AdapterRequest): Promise<AdapterResponse> {
    return failure(
      "Hyperliquid's info API returns per-address state but no aggregate distribution. " +
        "A profitability figure requires an indexed fill history for the full address set, " +
        "which this adapter does not build. No number is produced.",
    );
  }
}
