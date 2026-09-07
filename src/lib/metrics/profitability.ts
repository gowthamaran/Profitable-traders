import type { ActivityBand, PnlBucket, ProfitabilityStat, WalletCounts } from "@/lib/types";

/**
 * Percentages are always computed from counts here, never stored, so what the
 * page shows and what "CHECK THE MATH" prints can never disagree.
 *
 * Denominator choice: break-even and unknown wallets stay in the denominator.
 * Dropping them would quietly inflate the profitable share, which is exactly
 * the kind of massaging this site exists to avoid.
 */
export function profitablePct(counts: WalletCounts): number {
  if (counts.analyzed <= 0) return 0;
  return (counts.profitable / counts.analyzed) * 100;
}

export function unprofitablePct(counts: WalletCounts): number {
  if (counts.analyzed <= 0) return 0;
  return (counts.unprofitable / counts.analyzed) * 100;
}

export function breakEvenPct(counts: WalletCounts): number {
  if (counts.analyzed <= 0) return 0;
  return (counts.breakEven / counts.analyzed) * 100;
}

export function unknownPct(counts: WalletCounts): number {
  if (counts.analyzed <= 0) return 0;
  return (counts.unknown / counts.analyzed) * 100;
}

/** The counts must actually add up, or the record is rejected on ingest. */
export function countsAreConsistent(counts: WalletCounts): boolean {
  const sum = counts.profitable + counts.unprofitable + counts.breakEven + counts.unknown;
  return sum === counts.analyzed;
}

export function activityBandPct(band: ActivityBand): number {
  if (band.wallets <= 0) return 0;
  return (band.profitable / band.wallets) * 100;
}

/** "1 in N finished profitable" -- the shareable form of the headline. */
export function oneInN(counts: WalletCounts): number | null {
  if (counts.profitable <= 0) return null;
  return counts.analyzed / counts.profitable;
}

/**
 * Whether a bucket's entire range sits at or below zero.
 *
 * The null checks matter in both directions: the bottom bucket is open-ended
 * downward (min null, max negative) and the top is open-ended upward (min
 * positive, max null). Reading a null max as 0 would file the biggest winners
 * under losses.
 */
export function isLosingBucket(bucket: PnlBucket): boolean {
  return bucket.max !== null && bucket.max <= 0;
}

export function losingBuckets(stat: ProfitabilityStat): PnlBucket[] {
  return stat.buckets.filter(isLosingBucket);
}

export function totalLosingWallets(stat: ProfitabilityStat): number | null {
  const negative = losingBuckets(stat);
  if (negative.length === 0) return null;
  return negative.reduce((sum, b) => sum + b.wallets, 0);
}
