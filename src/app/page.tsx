import { getDatabaseCounts, getPlatforms } from "@/lib/data/repository";
import { Hero } from "@/components/Hero";
import { PlatformGrid } from "@/components/PlatformGrid";
import { SurprisingStatStrip } from "@/components/SurprisingStatStrip";
import { InsufficientData } from "@/components/ui";

export const revalidate = 300;

export default async function HomePage() {
  const [platforms, counts] = await Promise.all([getPlatforms(), getDatabaseCounts()]);
  const withStat = platforms.filter((p) => p.stat);

  return (
    <>
      <Hero counts={counts} hasData={withStat.length > 0} />

      {withStat.length > 0 && <SurprisingStatStrip platforms={platforms} />}

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        {platforms.length === 0 ? (
          <InsufficientData note="No platform has cleared review yet. Production mode shows only statistics that have been reproduced and approved, so this page stays empty until the first record lands rather than filling itself with estimates." />
        ) : (
          <PlatformGrid platforms={platforms} />
        )}
      </div>
    </>
  );
}
