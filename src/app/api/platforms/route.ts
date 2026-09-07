import { NextResponse } from "next/server";
import { getPlatforms } from "@/lib/data/repository";
import { evidenceScoreFor, gradeEvidence } from "@/lib/metrics/evidence";
import { painIndexFor } from "@/lib/metrics/badges";
import { profitablePct, unprofitablePct } from "@/lib/metrics/profitability";
import type { Category } from "@/lib/types";
import { dataMode } from "@/lib/data/mode";

export const revalidate = 300;

/**
 * Public read API. Every row carries `isDemo` and the evidence score, so a
 * consumer of this endpoint cannot accidentally treat a synthetic record as a
 * measurement.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category") as Category | "all" | null;
  const search = url.searchParams.get("q") ?? undefined;

  const platforms = await getPlatforms({ category: category ?? undefined, search });

  return NextResponse.json({
    dataMode: dataMode(),
    disclaimer:
      dataMode() === "demo"
        ? "DEMO DATA: every figure is synthetic and is not a measurement of the named platform."
        : "Figures describe analyzed wallets, not people. See /methodology.",
    count: platforms.length,
    platforms: platforms.map((platform) => ({
      slug: platform.slug,
      name: platform.name,
      category: platform.category,
      isDemo: platform.isDemo,
      profitability: platform.stat
        ? {
            profitablePct: Number(profitablePct(platform.stat.counts).toFixed(4)),
            unprofitablePct: Number(unprofitablePct(platform.stat.counts).toFixed(4)),
            counts: platform.stat.counts,
            medianPnlUsd: platform.stat.medianPnlUsd,
            topOnePctProfitShare: platform.stat.topOnePctProfitShare,
            periodStart: platform.stat.periodStart,
            periodEnd: platform.stat.periodEnd,
            evidenceScore: evidenceScoreFor(platform.stat),
            evidenceGrade: gradeEvidence(evidenceScoreFor(platform.stat)),
            painIndex: painIndexFor(platform),
            sources: platform.stat.sources.map((s) => ({
              provider: s.provider,
              type: s.type,
              url: s.url,
              reproducible: s.reproducible,
              status: s.status,
            })),
          }
        : null,
      unknownReason: platform.unknownReason,
      dataAvailabilityNote: platform.dataAvailabilityNote,
    })),
  });
}
