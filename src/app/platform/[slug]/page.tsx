import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPlatform, getPlatforms } from "@/lib/data/repository";
import { PlatformDetail } from "@/components/PlatformDetail";
import { profitablePct } from "@/lib/metrics/profitability";
import { pct } from "@/lib/format";

export const revalidate = 300;

export async function generateStaticParams() {
  const platforms = await getPlatforms();
  return platforms.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const platform = await getPlatform(slug);
  if (!platform) return { title: "Platform not found" };

  const description = platform.stat
    ? `${platform.isDemo ? "DEMO example, not real results: " : ""}${pct(profitablePct(platform.stat.counts))} of ${platform.stat.counts.analyzed.toLocaleString("en-US")} analyzed ${platform.name} wallets finished profitable. Sources, query and methodology included.`
    : `Read public profitability reports for ${platform.name}. External results are not independently verified on this site.`;

  return {
    title: platform.name,
    description,
    openGraph: { title: `${platform.name} · Trader Profitability Database`, description },
  };
}

export default async function PlatformPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [platform, allPlatforms] = await Promise.all([getPlatform(slug), getPlatforms()]);
  if (!platform) notFound();
  return <PlatformDetail platform={platform} allPlatforms={allPlatforms} />;
}
