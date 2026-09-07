import { pct } from "@/lib/format";

/**
 * The site's primary figure: one horizontal bar, profitable against
 * unprofitable. Break-even and unknown wallets keep their own segments rather
 * than being folded into either side.
 */
export function ProfitabilityBar({
  profitable,
  unprofitable,
  breakEven = 0,
  unknown = 0,
  height = "h-2.5",
  animate = true,
  showLegend = false,
}: {
  profitable: number;
  unprofitable: number;
  breakEven?: number;
  unknown?: number;
  height?: string;
  animate?: boolean;
  showLegend?: boolean;
}) {
  const segments = [
    { key: "profitable", value: profitable, className: "bg-profit", label: "Profitable" },
    { key: "break-even", value: breakEven, className: "bg-muted/50", label: "Break-even" },
    { key: "unknown", value: unknown, className: "bg-ink-600", label: "Unknown" },
    { key: "unprofitable", value: unprofitable, className: "bg-loss", label: "Unprofitable" },
  ].filter((s) => s.value > 0);

  return (
    <div>
      <div
        className={`flex w-full overflow-hidden rounded-sm bg-ink-800 ${height}`}
        role="img"
        aria-label={`${pct(profitable)} of analyzed wallets profitable, ${pct(unprofitable)} unprofitable`}
      >
        {segments.map((segment) => (
          <div
            key={segment.key}
            className={`${segment.className} ${animate ? "bar-grow" : ""}`}
            style={{ width: `${segment.value}%` }}
          />
        ))}
      </div>
      {showLegend && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {segments.map((segment) => (
            <span key={segment.key} className="flex items-center gap-1.5 text-xs text-muted">
              <span className={`h-2 w-2 rounded-[1px] ${segment.className}`} />
              {segment.label}
              <span className="tnum text-paper/80">{pct(segment.value)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
