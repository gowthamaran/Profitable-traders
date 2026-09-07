import type { Platform } from "@/lib/types";
import { evidenceScoreFor } from "./evidence";
import { computePainIndex } from "./painIndex";
import { profitablePct, unprofitablePct } from "./profitability";

/**
 * Badges are awarded by rule, never by hand.
 *
 * Every negative badge is a statement about observed wallet outcomes or about
 * data availability -- never an accusation about a company's conduct.
 */
export type BadgeId =
  | "MOST WALLET-FRIENDLY"
  | "THE MEAT GRINDER"
  | "WHALE PLAYGROUND"
  | "SURVIVOR MODE"
  | "COIN FLIP"
  | "RECEIPTS PROVIDED"
  | "DATA BLACK HOLE";

export type BadgeTone = "good" | "bad" | "neutral";

export interface Badge {
  id: BadgeId;
  tone: BadgeTone;
  /** Why this platform earned it, in plain numbers. */
  reason: string;
}

export const BADGE_RULES: Record<BadgeId, { tone: BadgeTone; criterion: string }> = {
  "MOST WALLET-FRIENDLY": {
    tone: "good",
    criterion: "Highest profitable share among platforms with an evidence score of 75 or more.",
  },
  "THE MEAT GRINDER": {
    tone: "bad",
    criterion: "Unprofitable share of 90% or more.",
  },
  "WHALE PLAYGROUND": {
    tone: "neutral",
    criterion: "Top 1% of wallets captured 60% or more of observed profits.",
  },
  "SURVIVOR MODE": {
    tone: "neutral",
    criterion:
      "Profitable share among the most active wallets is at least 25% lower, in relative terms, than across all wallets (most active band must hold 100+ wallets).",
  },
  "COIN FLIP": {
    tone: "neutral",
    criterion: "Profitable share within 5 points of 50%.",
  },
  "RECEIPTS PROVIDED": {
    tone: "good",
    criterion: "Evidence score of 90 or more with reproducible SQL published.",
  },
  "DATA BLACK HOLE": {
    tone: "neutral",
    criterion: "No participant-level profitability data is publicly available.",
  },
};

export function badgesFor(platform: Platform, allPlatforms: Platform[], now = new Date()): Badge[] {
  const badges: Badge[] = [];
  const stat = platform.stat;

  if (!stat) {
    badges.push({
      id: "DATA BLACK HOLE",
      tone: "neutral",
      reason: "No participant-level profitability data is published for this platform.",
    });
    return badges;
  }

  const profitable = profitablePct(stat.counts);
  const unprofitable = unprofitablePct(stat.counts);
  const score = evidenceScoreFor(stat, now);

  if (unprofitable >= 90) {
    badges.push({
      id: "THE MEAT GRINDER",
      tone: "bad",
      reason: `${unprofitable.toFixed(1)}% of ${stat.counts.analyzed.toLocaleString()} analyzed wallets finished down.`,
    });
  }

  if (Math.abs(profitable - 50) <= 5) {
    badges.push({
      id: "COIN FLIP",
      tone: "neutral",
      reason: `${profitable.toFixed(1)}% profitable is within 5 points of even.`,
    });
  }

  if (stat.topOnePctProfitShare !== null && stat.topOnePctProfitShare >= 0.6) {
    badges.push({
      id: "WHALE PLAYGROUND",
      tone: "neutral",
      reason: `The top 1% of wallets captured ${(stat.topOnePctProfitShare * 100).toFixed(1)}% of observed profits.`,
    });
  }

  const decline = activityDecline(platform);
  if (decline !== null && decline.ratio >= SURVIVOR_MODE_RELATIVE_DROP) {
    badges.push({
      id: "SURVIVOR MODE",
      tone: "neutral",
      reason:
        `Profitable share falls from ${decline.baseline.toFixed(1)}% across all wallets to ` +
        `${decline.active.toFixed(1)}% among the ${decline.bandLabel} band — a ` +
        `${(decline.ratio * 100).toFixed(0)}% relative decline.`,
    });
  }

  if (score >= 90 && stat.sources.some((s) => s.reproducible && s.query)) {
    badges.push({
      id: "RECEIPTS PROVIDED",
      tone: "good",
      reason: `Evidence score ${score} with a published, re-runnable query.`,
    });
  }

  if (isMostWalletFriendly(platform, allPlatforms, now)) {
    badges.push({
      id: "MOST WALLET-FRIENDLY",
      tone: "good",
      reason: `Highest profitable share (${profitable.toFixed(1)}%) among well-evidenced platforms.`,
    });
  }

  return badges;
}

/**
 * Relative decline in profitable share between all wallets and the most active
 * band.
 *
 * Measured in relative terms rather than percentage points on purpose. On a
 * venue where only 3% of wallets finish up, an absolute 10-point fall is
 * arithmetically impossible, so an absolute rule would exempt exactly the
 * platforms where activity punishes traders hardest.
 */
export const SURVIVOR_MODE_RELATIVE_DROP = 0.25;
export const SURVIVOR_MODE_MIN_BAND_WALLETS = 100;

export interface ActivityDecline {
  baseline: number;
  active: number;
  /** 0-1: the share of the baseline rate that is lost in the active band. */
  ratio: number;
  bandLabel: string;
}

export function activityDecline(platform: Platform): ActivityDecline | null {
  const stat = platform.stat;
  if (!stat) return null;
  const bands = stat.activityBands.filter((b) => b.wallets >= SURVIVOR_MODE_MIN_BAND_WALLETS);
  if (bands.length < 2) return null;

  const baseline = profitablePct(stat.counts);
  if (baseline <= 0) return null;

  const mostActive = bands.reduce((a, b) => (b.minTrades > a.minTrades ? b : a));
  const active = (mostActive.profitable / mostActive.wallets) * 100;
  return {
    baseline,
    active,
    ratio: (baseline - active) / baseline,
    bandLabel: mostActive.label,
  };
}

/** Points of profitable share lost, kept for display alongside the ratio. */
export function activityDrop(platform: Platform): number | null {
  const decline = activityDecline(platform);
  return decline === null ? null : decline.baseline - decline.active;
}

function isMostWalletFriendly(platform: Platform, all: Platform[], now: Date): boolean {
  const eligible = all.filter((p) => p.stat && evidenceScoreFor(p.stat, now) >= 75);
  if (eligible.length < 2) return false;
  const best = eligible.reduce((a, b) =>
    profitablePct(b.stat!.counts) > profitablePct(a.stat!.counts) ? b : a,
  );
  return best.slug === platform.slug;
}

export function painIndexFor(platform: Platform): number | null {
  return platform.stat ? computePainIndex(platform.stat).score : null;
}
