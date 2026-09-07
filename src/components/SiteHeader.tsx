import Link from "next/link";
import { DemoBanner } from "./DemoBanner";

const NAV = [
  { href: "/", label: "Platforms" },
  { href: "/rankings", label: "Rankings" },
  { href: "/compare", label: "Compare" },
  { href: "/methodology", label: "How it works" },
  { href: "/sources", label: "Proof" },
];

export function SiteHeader() {
  return (
    <>
      <DemoBanner />
      <header className="sticky top-0 z-40 border-b border-ink-700 bg-ink-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="group flex items-baseline gap-2">
            <span className="font-mono text-sm font-semibold tracking-tight text-paper">
              PROFIT<span className="text-accent">/</span>CHECK
            </span>
            <span className="hidden font-mono text-2xs tracking-widest text-faint sm:inline">by Themaran</span>
          </Link>
          <nav className="flex w-full items-center gap-1 overflow-x-auto sm:ml-auto sm:w-auto">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-sm px-2.5 py-1.5 text-sm text-muted transition-colors hover:bg-ink-800 hover:text-paper"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
    </>
  );
}
