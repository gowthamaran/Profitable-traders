import type { Metadata } from "next";
import { getPlatforms } from "@/lib/data/repository";
import { PlatformFaceOff } from "@/components/PlatformFaceOff";
import { InsufficientData } from "@/components/ui";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Compare",
  description:
    "Put two platforms side by side on profitability, loss rate, median PnL, profit concentration, sample size and evidence quality.",
};

export default async function ComparePage() {
  const platforms = await getPlatforms();
  const comparable = platforms.filter((p) => p.stat);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <p className="label">Section 20</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-paper sm:text-3xl">
        Platform face-off
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        Two platforms, the same six measures. Where the two records use different methodologies the
        comparison says so rather than quietly putting the numbers side by side as if they were
        computed the same way.
      </p>

      <div className="mt-8">
        {comparable.length < 2 ? (
          <InsufficientData note="At least two platforms need an approved statistic before a comparison means anything." />
        ) : (
          <PlatformFaceOff platforms={comparable} />
        )}
      </div>
    </div>
  );
}
