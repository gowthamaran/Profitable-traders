import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { isDemoMode } from "@/lib/data/mode";

const siteUrl = process.env.SITE_URL
  ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Trader Profitability Database",
    template: "%s · Trader Profitability Database",
  },
  description:
    "What percentage of wallets on speculative crypto platforms actually finish profitable? Every figure carries its source, its query and its methodology.",
  openGraph: {
    type: "website",
    title: "Trader Profitability Database",
    description:
      "Wallet-level profitability across prediction markets, memecoin launchpads and perps — with the evidence attached.",
  },
  robots: { index: !isDemoMode(), follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-paper focus:px-3 focus:py-2 focus:font-mono focus:text-2xs focus:text-ink-950"
        >
          SKIP TO CONTENT
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
