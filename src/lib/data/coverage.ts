import type { Platform } from "@/lib/types";

// Report discovery is separate from a reviewed statistic. Never infer counts
// or attach these reports to a synthetic demo record.
export const fomo: Platform = {
  slug: "fomo",
  name: "Fomo",
  category: "other",
  description: "Social crypto trading app. Public reports examine wallet profitability on its Solana trades.",
  chains: ["Solana (report scope)"],
  website: null,
  stat: null,
  isDemo: false,
  unknownReason: "research-pending",
  dataAvailabilityNote: "Public profitability reports are available on Dune. Their result rows have not been independently reproduced here, so no percentage, wallet count, or ranking is claimed on this site yet.",
  profitabilityReports: [
    { title: "Profitable wallets · 90-day Solana study", url: "https://dune.com/queries/8361981" },
    { title: "Four definitions of profitability", url: "https://dune.com/archietools3037/fomo-trader-profitability-four-definitions" },
    { title: "Fomo app · 30-day trader performance", url: "https://dune.com/nocoffeenobrain/fomo-app-trader-performance" },
  ],
};

export function visiblePlatforms(platforms: Platform[]): Platform[] {
  const hasFomo = platforms.some((p) => p.slug === "fomo");
  return (hasFomo ? platforms : [...platforms, fomo]).filter(
    (p) => p.stat !== null || Boolean(p.profitabilityReports?.length),
  );
}
