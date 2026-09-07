"use client";

import { useMemo, useState } from "react";
import type { Platform } from "@/lib/types";
import { evidenceScoreFor, gradeEvidence } from "@/lib/metrics/evidence";
import { profitablePct, unprofitablePct } from "@/lib/metrics/profitability";
import { painIndexFor } from "@/lib/metrics/badges";
import { compactNumber, pct, signedUsd } from "@/lib/format";
import { ProfitabilityBar } from "./ProfitabilityBar";
import { DemoTag } from "./DemoBanner";
import { Panel, WarningCard } from "./ui";

type Winner = "a" | "b" | "tie" | "none";

interface Measure {
  label: string;
  note: string;
  value: (p: Platform) => number | null;
  format: (v: number) => string;
  /** Which direction counts as the better outcome for a wallet. */
  better: "higher" | "lower" | "neutral";
}

const MEASURES: Measure[] = [
  {
    label: "Profitable share",
    note: "Analyzed wallets finishing above break-even",
    value: (p) => (p.stat ? profitablePct(p.stat.counts) : null),
    format: (v) => pct(v),
    better: "higher",
  },
  {
    label: "Loss rate",
    note: "Analyzed wallets finishing below break-even",
    value: (p) => (p.stat ? unprofitablePct(p.stat.counts) : null),
    format: (v) => pct(v),
    better: "lower",
  },
  {
    label: "Median PnL",
    note: "The middle wallet's realised result",
    value: (p) => p.stat?.medianPnlUsd ?? null,
    format: (v) => signedUsd(v),
    better: "higher",
  },
  {
    label: "Top 1% profit share",
    note: "Concentration of observed profit",
    value: (p) => (p.stat?.topOnePctProfitShare != null ? p.stat.topOnePctProfitShare * 100 : null),
    format: (v) => pct(v),
    better: "lower",
  },
  {
    label: "Sample size",
    note: "Wallets in the analysis window",
    value: (p) => p.stat?.counts.analyzed ?? null,
    format: (v) => compactNumber(v),
    better: "neutral",
  },
  {
    label: "Evidence score",
    note: "Strength of sourcing, not of outcomes",
    value: (p) => (p.stat ? evidenceScoreFor(p.stat) : null),
    format: (v) => `${v.toFixed(0)}/100`,
    better: "higher",
  },
  {
    label: "Pain index",
    note: "Site-created composite",
    value: (p) => painIndexFor(p),
    format: (v) => v.toFixed(0),
    better: "lower",
  },
];

export function PlatformFaceOff({ platforms }: { platforms: Platform[] }) {
  const [slugA, setSlugA] = useState(platforms[0]?.slug ?? "");
  const [slugB, setSlugB] = useState(platforms[1]?.slug ?? "");
  const [copied, setCopied] = useState(false);

  const a = platforms.find((p) => p.slug === slugA) ?? platforms[0];
  const b = platforms.find((p) => p.slug === slugB) ?? platforms[1];

  const rows = useMemo(
    () =>
      MEASURES.map((measure) => {
        const va = measure.value(a);
        const vb = measure.value(b);
        return { measure, va, vb, winner: decide(measure, va, vb) };
      }),
    [a, b],
  );

  const methodologyDiffers =
    a.stat && b.stat
      ? a.stat.methodology.feesIncluded !== b.stat.methodology.feesIncluded ||
        a.stat.methodology.unrealizedIncluded !== b.stat.methodology.unrealizedIncluded ||
        a.stat.methodology.calculationVersion !== b.stat.methodology.calculationVersion
      : false;

  const verdict = summarise(rows, a, b);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(
        `${a.name} vs ${b.name}: ${pct(profitablePct(a.stat!.counts))} vs ${pct(profitablePct(b.stat!.counts))} of analyzed wallets profitable. ${typeof window !== "undefined" ? window.location.href : ""}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Selector label="Platform A" value={slugA} onChange={setSlugA} platforms={platforms} />
        <Selector label="Platform B" value={slugB} onChange={setSlugB} platforms={platforms} />
      </div>

      {a.slug === b.slug ? (
        <p className="text-sm text-muted">Pick two different platforms.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {[a, b].map((p) => (
              <Panel key={p.slug} className="p-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-paper">{p.name}</h2>
                  {p.isDemo && <DemoTag />}
                </div>
                <div className="mt-3">
                  <ProfitabilityBar
                    profitable={profitablePct(p.stat!.counts)}
                    unprofitable={unprofitablePct(p.stat!.counts)}
                    showLegend
                  />
                </div>
              </Panel>
            ))}
          </div>

          <Panel className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-ink-700 text-left">
                  <th className="label px-4 py-2.5 font-normal">Measure</th>
                  <th className="label px-4 py-2.5 text-right font-normal">{a.name}</th>
                  <th className="label px-4 py-2.5 text-right font-normal">{b.name}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {rows.map(({ measure, va, vb, winner }) => (
                  <tr key={measure.label}>
                    <td className="px-4 py-3">
                      <p className="text-paper/85">{measure.label}</p>
                      <p className="text-xs text-muted">{measure.note}</p>
                    </td>
                    <Cell value={va} measure={measure} highlight={winner === "a"} />
                    <Cell value={vb} measure={measure} highlight={winner === "b"} />
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          {methodologyDiffers && (
            <WarningCard title="METHODOLOGIES DIFFER">
              These two records were not computed the same way — fee treatment, unrealized handling
              or calculation version differ. The rows above are still each correct on their own
              terms, but the difference between them is not purely a difference in outcomes.
            </WarningCard>
          )}

          <Panel className="p-5">
            <p className="label">The numbers have spoken</p>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-paper/85">{verdict}</p>
            <button
              type="button"
              onClick={share}
              className="mt-4 rounded-sm border border-ink-600 px-3 py-2 font-mono text-2xs font-semibold tracking-widest text-paper hover:border-muted"
            >
              {copied ? "COPIED" : "SHARE THIS MATCHUP"}
            </button>
          </Panel>
        </>
      )}
    </div>
  );
}

function Cell({
  value,
  measure,
  highlight,
}: {
  value: number | null;
  measure: Measure;
  highlight: boolean;
}) {
  return (
    <td
      className={`tnum px-4 py-3 text-right ${
        highlight ? "font-semibold text-paper" : "text-paper/70"
      }`}
    >
      {value === null ? <span className="text-faint">not on record</span> : measure.format(value)}
    </td>
  );
}

function Selector({
  label,
  value,
  onChange,
  platforms,
}: {
  label: string;
  value: string;
  onChange: (slug: string) => void;
  platforms: Platform[];
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-sm border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-paper"
      >
        {platforms.map((p) => (
          <option key={p.slug} value={p.slug}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function decide(measure: Measure, va: number | null, vb: number | null): Winner {
  if (va === null || vb === null || measure.better === "neutral") return "none";
  if (va === vb) return "tie";
  const aWins = measure.better === "higher" ? va > vb : va < vb;
  return aWins ? "a" : "b";
}

function summarise(
  rows: Array<{ measure: Measure; va: number | null; vb: number | null; winner: Winner }>,
  a: Platform,
  b: Platform,
): string {
  const profitRow = rows.find((r) => r.measure.label === "Profitable share");
  if (!profitRow || profitRow.va === null || profitRow.vb === null) {
    return "Not enough shared measures to draw a comparison.";
  }
  const gap = Math.abs(profitRow.va - profitRow.vb);
  const leader = profitRow.va > profitRow.vb ? a : b;
  const trailer = profitRow.va > profitRow.vb ? b : a;

  if (gap < 1) {
    return `${a.name} and ${b.name} are within one point of each other on profitable share. On this measure the choice between them is not the thing that decides an outcome.`;
  }
  return `${leader.name} shows ${pct(gap)} more of its analyzed wallets finishing profitable than ${trailer.name}. Both figures describe wallets over their own sample window, and neither predicts what happens next. Technically, someone won.`;
}
