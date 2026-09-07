"use client";

import { useState } from "react";
import type { Platform } from "@/lib/types";
import { evidenceScoreFor, gradeEvidence } from "@/lib/metrics/evidence";
import { compactNumber, isoDate } from "@/lib/format";

/**
 * Section 32-33. The statistic dominates; the site's name is small. Sample,
 * period and evidence grade travel with the number so a screenshot cannot
 * strip the context away from it.
 */
export function ShareCard({ platform, headline }: { platform: Platform; headline: string | null }) {
  const [copied, setCopied] = useState(false);
  const stat = platform.stat;
  if (!stat || !headline) return null;

  const score = evidenceScoreFor(stat);
  const url = typeof window !== "undefined" ? window.location.href : "";
  const text = `${headline} — ${platform.name}, ${compactNumber(stat.counts.analyzed)} wallets analyzed (${isoDate(stat.periodStart)} to ${isoDate(stat.periodEnd)}). Evidence score ${score}/100.`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <figure className="overflow-hidden rounded-md border border-ink-700 bg-ink-950">
        <div className="p-6 sm:p-8">
          {platform.isDemo && (
            <p className="mb-3 inline-block rounded-sm border border-warn/50 px-1.5 py-0.5 font-mono text-2xs font-semibold tracking-widest text-warn">
              DEMO DATA — NOT A MEASUREMENT
            </p>
          )}
          <p className="font-mono text-2xs tracking-widest text-muted">
            {platform.name.toUpperCase()}
          </p>
          <p className="mt-3 text-2xl font-semibold leading-tight tracking-tight text-paper sm:text-3xl">
            {headline}
          </p>
          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-t border-ink-700 pt-4">
            <div>
              <dt className="label">Sample</dt>
              <dd className="tnum mt-0.5 text-sm text-paper">
                {compactNumber(stat.counts.analyzed)} wallets
              </dd>
            </div>
            <div>
              <dt className="label">Period</dt>
              <dd className="tnum mt-0.5 text-sm text-paper">
                {isoDate(stat.periodStart)} → {isoDate(stat.periodEnd)}
              </dd>
            </div>
            <div>
              <dt className="label">Evidence</dt>
              <dd className="tnum mt-0.5 text-sm text-paper">
                {score}/100 · {gradeEvidence(score)}
              </dd>
            </div>
          </dl>
          <p className="mt-5 font-mono text-2xs tracking-widest text-faint">
            TRADER/PROFITABILITY DB · WALLETS, NOT PEOPLE
          </p>
        </div>
      </figure>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={copy}
          className="rounded-sm bg-paper px-4 py-2.5 font-mono text-2xs font-semibold tracking-widest text-ink-950 transition-opacity hover:opacity-90"
        >
          {copied ? "COPIED" : "POST THE RECEIPTS"}
        </button>
        <a
          href={`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noreferrer noopener"
          className="rounded-sm border border-ink-600 px-4 py-2.5 text-center font-mono text-2xs font-semibold tracking-widest text-paper transition-colors hover:border-muted"
        >
          SHARE THE DAMAGE
        </a>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          The card carries its sample, period and evidence grade so the number cannot be quoted
          without them.
        </p>
      </div>
    </div>
  );
}
