import type { ProfitabilityStat } from "@/lib/types";
import { activityBandPct, losingBuckets, unprofitablePct } from "./profitability";

/**
 * PAIN INDEX -- a site-created metric, 0-100. It is not an industry standard
 * and nobody else computes it. The formula is published here and on
 * /methodology so a reader can disagree with the weights on the record.
 *
 * Higher means the observed wallet outcomes were worse.
 */
export const PAIN_INDEX_VERSION = "pain-index-v1";

export const PAIN_INDEX_WEIGHTS = {
  unprofitableShare: 0.35,
  medianLoss: 0.2,
  lossSeverity: 0.2,
  profitConcentration: 0.15,
  activityAdjusted: 0.1,
} as const;

export interface PainIndexBreakdown {
  score: number;
  components: Array<{
    key: keyof typeof PAIN_INDEX_WEIGHTS;
    label: string;
    weight: number;
    /** Normalised 0-100 before weighting. */
    normalised: number;
    contribution: number;
    inputLabel: string;
    available: boolean;
  }>;
  /** Weights of components we could not compute, redistributed proportionally. */
  redistributedWeight: number;
}

/** $2,500 of median loss is treated as the top of the scale. */
export const MEDIAN_LOSS_CEILING_USD = 2_500;

export function computePainIndex(stat: ProfitabilityStat): PainIndexBreakdown {
  const unprofitable = unprofitablePct(stat.counts);
  const medianLoss = Math.max(0, -stat.medianPnlUsd);
  const severity = lossSeverity(stat);
  const concentration = stat.topOnePctProfitShare;
  const activity = activityAdjustedPain(stat);

  const raw: Array<{
    key: keyof typeof PAIN_INDEX_WEIGHTS;
    label: string;
    normalised: number | null;
    inputLabel: string;
  }> = [
    {
      key: "unprofitableShare",
      label: "Unprofitable share",
      normalised: unprofitable,
      inputLabel: `${unprofitable.toFixed(1)}% of analyzed wallets`,
    },
    {
      key: "medianLoss",
      label: "Median loss",
      normalised: clamp((medianLoss / MEDIAN_LOSS_CEILING_USD) * 100),
      inputLabel:
        stat.medianPnlUsd >= 0
          ? `median wallet +$${stat.medianPnlUsd.toFixed(0)}`
          : `median wallet -$${medianLoss.toFixed(0)}`,
    },
    {
      key: "lossSeverity",
      label: "Loss severity",
      normalised: severity === null ? null : severity * 100,
      inputLabel:
        severity === null
          ? "distribution unavailable"
          : `${(severity * 100).toFixed(1)}% of losing wallets lost over $1,000`,
    },
    {
      key: "profitConcentration",
      label: "Profit concentration",
      normalised: concentration === null ? null : concentration * 100,
      inputLabel:
        concentration === null
          ? "concentration unavailable"
          : `top 1% captured ${(concentration * 100).toFixed(1)}% of profits`,
    },
    {
      key: "activityAdjusted",
      label: "Activity-adjusted profitability",
      normalised: activity === null ? null : activity,
      inputLabel:
        activity === null
          ? "activity bands unavailable"
          : `${(100 - activity).toFixed(1)}% profitable among the most active wallets`,
    },
  ];

  // Weight of anything we could not compute is spread across what we could,
  // so a missing input never silently reads as a zero.
  const availableWeight = raw
    .filter((c) => c.normalised !== null)
    .reduce((sum, c) => sum + PAIN_INDEX_WEIGHTS[c.key], 0);
  const redistributedWeight = 1 - availableWeight;

  const components = raw.map((c) => {
    const available = c.normalised !== null;
    const baseWeight = PAIN_INDEX_WEIGHTS[c.key];
    const weight = available && availableWeight > 0 ? baseWeight / availableWeight : 0;
    const normalised = clamp(c.normalised ?? 0);
    return {
      key: c.key,
      label: c.label,
      weight,
      normalised,
      contribution: available ? normalised * weight : 0,
      inputLabel: c.inputLabel,
      available,
    };
  });

  const score = components.reduce((sum, c) => sum + c.contribution, 0);
  return { score: Math.round(clamp(score)), components, redistributedWeight };
}

/** Share of losing wallets that lost more than $1,000. */
export function lossSeverity(stat: ProfitabilityStat): number | null {
  const losing = losingBuckets(stat);
  if (losing.length === 0) return null;
  const total = losing.reduce((sum, b) => sum + b.wallets, 0);
  if (total <= 0) return null;
  // A bucket counts as heavy only when its whole range sits below -$1,000.
  // Testing `min <= -1000` would sweep in the -$1k to -$100 bucket, whose
  // wallets lost less than $1,000.
  const heavy = losing
    .filter((b) => b.max !== null && b.max <= -1_000)
    .reduce((sum, b) => sum + b.wallets, 0);
  return heavy / total;
}

/**
 * Pain among wallets that actually stuck around. On most venues the profitable
 * share falls as trade count rises; this captures that without asserting it.
 */
export function activityAdjustedPain(stat: ProfitabilityStat): number | null {
  const bands = stat.activityBands.filter((b) => b.wallets > 0);
  if (bands.length === 0) return null;
  const mostActive = bands.reduce((a, b) => (b.minTrades > a.minTrades ? b : a));
  return clamp(100 - activityBandPct(mostActive));
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}
