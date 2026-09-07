/**
 * Number formatting. Percentages carry one decimal everywhere so a reader can
 * compare two platforms without wondering whether 31% and 31.4% differ.
 */

export function pct(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return "--";
  return `${value.toFixed(digits)}%`;
}

export function compactNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "--";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString("en-US");
}

export function fullNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "--";
  return value.toLocaleString("en-US");
}

export function usd(value: number | null, digits = 0): string {
  if (value === null || !Number.isFinite(value)) return "--";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toLocaleString("en-US", { maximumFractionDigits: digits })}`;
}

export function signedUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "--";
  return value > 0 ? `+${usd(value)}` : usd(value);
}

/** Dates render as YYYY-MM-DD everywhere. No locale surprises in a data table. */
export function isoDate(value: string | null): string {
  if (!value) return "--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

export function relativeAge(value: string | null, now = new Date()): string {
  if (!value) return "never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "unknown";
  const days = Math.floor((now.getTime() - parsed.getTime()) / 86_400_000);
  if (days < 0) return "scheduled";
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 60) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 24) return `${months} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}
