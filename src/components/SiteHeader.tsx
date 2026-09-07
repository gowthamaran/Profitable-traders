import Link from "next/link";
import { DemoBanner } from "./DemoBanner";

const NAV = [
  { href: "/", label: "Database" },
  { href: "/rankings", label: "Rankings" },
  { href: "/compare", label: "Compare" },
  { href: "/methodology", label: "Methodology" },
  { href: "/sources", label: "Sources" },
];

export function SiteHeader() {
  return (
    <>
      <DemoBanner />
      <header className="sticky top-0 z-40 border-b border-ink-700 bg-ink-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 sm:px-6">
          <Link href="/" className="group flex items-baseline gap-2">
            <span className="font-mono text-sm font-semibold tracking-tight text-paper">
              TRADER<span className="text-muted">/</span>PROFITABILITY
            </span>
            <span className="hidden font-mono text-2xs tracking-widest text-faint sm:inline">DB</span>
          </Link>
          <nav className="ml-auto flex items-center gap-1 overflow-x-auto">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-sm px-2.5 py-1.5 font-mono text-2xs tracking-widest text-muted transition-colors hover:bg-ink-800 hover:text-paper"
              >
                {item.label.toUpperCase()}
              </Link>
            ))}
          </nav>
        </div>
      </header>
    </>
  );
}
