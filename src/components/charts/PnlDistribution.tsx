"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PnlBucket } from "@/lib/types";
import { compactNumber, fullNumber, pct } from "@/lib/format";
import { isLosingBucket } from "@/lib/metrics/profitability";

/**
 * The distribution behind the headline. A single percentage hides whether the
 * losses were $40 or $40,000, and that difference is most of the story.
 */
export function PnlDistribution({ buckets }: { buckets: PnlBucket[] }) {
  const total = buckets.reduce((sum, b) => sum + b.wallets, 0);
  const data = buckets.map((b) => ({
    ...b,
    share: total > 0 ? (b.wallets / total) * 100 : 0,
    losing: isLosingBucket(b),
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fill: "#8b949e", fontSize: 10, fontFamily: "var(--font-mono)" }}
            axisLine={{ stroke: "#1e2429" }}
            tickLine={false}
            interval={0}
            angle={-25}
            textAnchor="end"
            height={54}
          />
          <YAxis
            tick={{ fill: "#8b949e", fontSize: 10, fontFamily: "var(--font-mono)" }}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={(v: number) => compactNumber(v)}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0].payload as (typeof data)[number];
              return (
                <div className="rounded-sm border border-ink-600 bg-ink-950 p-2.5 shadow-lg">
                  <p className="font-mono text-xs font-semibold text-paper">{item.label}</p>
                  <p className="tnum mt-1 text-xs text-muted">
                    {fullNumber(item.wallets)} wallets · {pct(item.share)} of analyzed
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="wallets" radius={[2, 2, 0, 0]} animationDuration={600}>
            {data.map((entry) => (
              <Cell key={entry.label} fill={entry.losing ? "#f05f5f" : "#3fb950"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
