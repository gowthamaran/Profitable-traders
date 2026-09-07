"use client";

import { useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TimeSeriesPoint, Timeframe } from "@/lib/types";
import { fullNumber, isoDate, pct } from "@/lib/format";

const ORDER: Timeframe[] = ["7D", "30D", "90D", "1Y", "ALL"];

export function ProfitabilityTrend({
  series,
}: {
  series: Partial<Record<Timeframe, TimeSeriesPoint[]>>;
}) {
  const available = ORDER.filter((tf) => (series[tf]?.length ?? 0) > 1);
  const [timeframe, setTimeframe] = useState<Timeframe>(available.at(-1) ?? "ALL");

  if (available.length === 0) {
    return (
      <p className="text-sm text-muted">
        No time series is on record for this platform, so profitability over time is not shown.
      </p>
    );
  }

  const data = series[timeframe] ?? [];

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1">
        {available.map((tf) => (
          <button
            key={tf}
            type="button"
            onClick={() => setTimeframe(tf)}
            className={`rounded-sm px-2 py-1 font-mono text-2xs font-semibold tracking-widest transition-colors ${
              tf === timeframe ? "bg-ink-700 text-paper" : "text-muted hover:bg-ink-800 hover:text-paper"
            }`}
          >
            {tf}
          </button>
        ))}
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3fb950" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#3fb950" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fill: "#8b949e", fontSize: 10, fontFamily: "var(--font-mono)" }}
              axisLine={{ stroke: "#1e2429" }}
              tickLine={false}
              minTickGap={24}
              tickFormatter={(v: string) => v.slice(5)}
            />
            <YAxis
              tick={{ fill: "#8b949e", fontSize: 10, fontFamily: "var(--font-mono)" }}
              axisLine={false}
              tickLine={false}
              width={42}
              domain={["dataMin - 2", "dataMax + 2"]}
              tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            />
            <Tooltip
              cursor={{ stroke: "#2a3238" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as TimeSeriesPoint;
                return (
                  <div className="rounded-sm border border-ink-600 bg-ink-950 p-2.5 shadow-lg">
                    <p className="font-mono text-xs text-muted">{isoDate(point.date)}</p>
                    <p className="tnum mt-0.5 text-sm font-semibold text-profit">
                      {pct(point.profitablePct)} profitable
                    </p>
                    <p className="tnum text-xs text-muted">
                      {fullNumber(point.analyzed)} wallets in window
                    </p>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="profitablePct"
              stroke="#3fb950"
              strokeWidth={1.75}
              fill="url(#trendFill)"
              animationDuration={600}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
