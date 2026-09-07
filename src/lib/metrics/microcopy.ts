import type { ProfitabilityStat } from "@/lib/types";
import { profitablePct, unprofitablePct } from "./profitability";

/**
 * The 10% of the 70/20/10 split.
 *
 * Two hard rules encoded here rather than left to a writer's judgement:
 *   1. Humour is always secondary copy. The caller renders the statistic
 *      first; this module only ever returns the line that sits underneath.
 *   2. At most one line per primary statistic. `microcopyFor` returns a single
 *      string, so there is no way to stack jokes on one number.
 *
 * Nothing here jokes about individuals, addiction, or anyone's real losses --
 * the subject is always the market's absurdity in aggregate.
 */

export interface MicrocopyRule {
  id: string;
  test: (ctx: MicrocopyContext) => boolean;
  line: string;
}

export interface MicrocopyContext {
  profitablePct: number;
  unprofitablePct: number;
  medianPnlUsd: number;
  topOnePctProfitShare: number | null;
}

/** Data-triggered lines, in priority order. First match wins. */
export const MICROCOPY_RULES: MicrocopyRule[] = [
  {
    id: "extreme-median-loss",
    test: (c) => c.medianPnlUsd <= -500,
    line: "Median wallet: financially humbled.",
  },
  {
    id: "high-concentration",
    test: (c) => c.topOnePctProfitShare !== null && c.topOnePctProfitShare >= 0.6,
    line: "A few wallets appear to be having considerably more fun.",
  },
  {
    id: "brutal",
    test: (c) => c.unprofitablePct > 90,
    line: "The chart is not upside down.",
  },
  {
    id: "rough",
    test: (c) => c.unprofitablePct >= 80 && c.unprofitablePct <= 90,
    line: "Most wallets did not enjoy this experiment.",
  },
  {
    id: "unfriendly",
    test: (c) => c.unprofitablePct >= 60 && c.unprofitablePct < 80,
    line: "The odds were not exactly friendly.",
  },
  {
    id: "coin-flip",
    test: (c) => Math.abs(c.profitablePct - 50) <= 5,
    line: "Surprisingly democratic.",
  },
  {
    id: "profitable",
    test: (c) => c.profitablePct > 50,
    line: "Wait. People actually made money?",
  },
];

export function contextFor(stat: ProfitabilityStat): MicrocopyContext {
  return {
    profitablePct: profitablePct(stat.counts),
    unprofitablePct: unprofitablePct(stat.counts),
    medianPnlUsd: stat.medianPnlUsd,
    topOnePctProfitShare: stat.topOnePctProfitShare,
  };
}

/** The one line that goes under the headline statistic, or null for silence. */
export function microcopyFor(stat: ProfitabilityStat | null): string | null {
  if (!stat) return null;
  const ctx = contextFor(stat);
  return MICROCOPY_RULES.find((rule) => rule.test(ctx))?.line ?? null;
}

/** Rotating asides. Never attached to a number that already has a data line. */
export const AMBIENT_LINES = [
  "Financial character development.",
  "The liquidity found a new owner.",
  "Not everyone made it.",
  "A statistically expensive hobby.",
  "The top 1% send their regards.",
  "Someone had to provide the exit liquidity.",
  "The chart speaks for itself.",
  "Your group chat may not be representative.",
  "Survivorship bias has entered the chat.",
  "At least the transactions were fast.",
  "Numbers > screenshots.",
  "Receipts included.",
] as const;

/**
 * Deterministic pick from a seed. Server and client render the same string, so
 * the page never hydrates with a different joke than it was sent with.
 */
export function ambientLine(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AMBIENT_LINES[hash % AMBIENT_LINES.length];
}

/** Loading states, cycled while a query runs. */
export const LOADING_STATES = [
  "VERIFYING RECEIPTS...",
  "QUERYING THE CHAIN...",
  "COUNTING SURVIVORS...",
  "CALCULATING PNL...",
] as const;

/**
 * The shareable one-liner. Built only from computed values -- if the inputs
 * are missing the function returns null rather than reaching for a phrase.
 */
export function surprisingStat(stat: ProfitabilityStat | null): string | null {
  if (!stat || stat.counts.analyzed <= 0) return null;
  const profitable = profitablePct(stat.counts);

  if (stat.counts.profitable > 0) {
    const n = Math.round(stat.counts.analyzed / stat.counts.profitable);
    if (n >= 3) return `ONLY 1 IN ${n} ANALYZED WALLETS FINISHED PROFITABLE`;
  }
  if (stat.topOnePctProfitShare !== null && stat.topOnePctProfitShare >= 0.4) {
    return `THE TOP 1% CAPTURED ${(stat.topOnePctProfitShare * 100).toFixed(0)}% OF OBSERVED PROFITS`;
  }
  return `${profitable.toFixed(1)}% OF ANALYZED WALLETS FINISHED PROFITABLE`;
}
