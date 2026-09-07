import { LOADING_STATES } from "@/lib/metrics/microcopy";

/** Section 35. Rendered server-side, so it shows one state rather than cycling. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
      <p className="font-mono text-xs tracking-widest text-muted">{LOADING_STATES[0]}</p>
      <div className="mt-6 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-md border border-ink-700 bg-ink-900" />
        ))}
      </div>
    </div>
  );
}
