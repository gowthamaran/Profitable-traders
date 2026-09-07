import { isDemoMode } from "@/lib/data/mode";

/**
 * Section 44: mock data is permitted during development but must be visibly
 * labelled. This banner is unmissable and sits above the header on every page.
 */
export function DemoBanner() {
  if (!isDemoMode()) return null;
  return (
    <div className="border-b border-warn/40 bg-warn-wash">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 sm:px-6">
        <span className="rounded-sm border border-warn/60 px-1.5 py-0.5 font-mono text-2xs font-semibold tracking-widest text-warn">
          DEMO DATA
        </span>
        <p className="text-sm text-paper/80">
          Numbers marked DEMO are examples, not real platform results. Fomo links to public reports; its percentages have not been verified here.
        </p>
      </div>
    </div>
  );
}

/** The per-figure marker, used anywhere a synthetic number is rendered. */
export function DemoTag({ className = "" }: { className?: string }) {
  return (
    <span
      title="Synthetic record. Not a measurement of this platform."
      className={`rounded-sm border border-warn/50 px-1 py-px font-mono text-2xs font-semibold tracking-wider text-warn ${className}`}
    >
      DEMO
    </span>
  );
}
