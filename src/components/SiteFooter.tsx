import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-ink-700 bg-ink-950">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-mono text-2xs tracking-widest text-muted">THE PRINCIPLE</p>
            <p className="mt-2 max-w-xs text-sm text-paper/80">
              You do not have to trust this website. You can check the calculation yourself.
            </p>
          </div>
          <div>
            <p className="font-mono text-2xs tracking-widest text-muted">READ</p>
            <ul className="mt-2 space-y-1 text-sm">
              <li>
                <Link href="/methodology" className="text-paper/80 hover:text-accent">
                  Methodology
                </Link>
              </li>
              <li>
                <Link href="/sources" className="text-paper/80 hover:text-accent">
                  Sources
                </Link>
              </li>
              <li>
                <Link href="/rankings" className="text-paper/80 hover:text-accent">
                  Rankings
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-mono text-2xs tracking-widest text-muted">SCOPE</p>
            <p className="mt-2 max-w-xs text-sm text-paper/70">
              Wallet-level outcomes on speculative crypto venues. A wallet is not a person, and this
              site never claims otherwise.
            </p>
          </div>
          <div>
            <p className="font-mono text-2xs tracking-widest text-muted">NOT ADVICE</p>
            <p className="mt-2 max-w-xs text-sm text-paper/70">
              Historical observation only. Nothing here forecasts any future result.
            </p>
          </div>
        </div>
        <p className="mt-10 border-t border-ink-700 pt-6 font-mono text-2xs tracking-widest text-faint">
          DON&apos;T TRUST US. THAT&apos;S THE POINT.
        </p>
      </div>
    </footer>
  );
}
