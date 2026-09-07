import type { ReactNode } from "react";

export function SectionHeading({
  label,
  title,
  note,
  children,
}: {
  label?: string;
  title: string;
  note?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        {label && <p className="label">{label}</p>}
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-paper">{title}</h2>
        {note && <p className="mt-1 max-w-2xl text-sm text-muted">{note}</p>}
      </div>
      {children}
    </div>
  );
}

export function Panel({
  children,
  className = "",
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return (
    <Tag className={`rounded-md border border-ink-700 bg-ink-900 ${className}`}>{children}</Tag>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "neutral" | "profit" | "loss" | "warn";
}) {
  const toneClass =
    tone === "profit"
      ? "text-profit"
      : tone === "loss"
        ? "text-loss"
        : tone === "warn"
          ? "text-warn"
          : "text-paper";
  return (
    <div className="min-w-0">
      <p className="label truncate">{label}</p>
      <p className={`tnum mt-1 text-xl font-semibold ${toneClass}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs leading-snug text-muted">{sub}</p>}
    </div>
  );
}

/**
 * The state a platform sits in when nothing verifiable exists. It is a
 * first-class result, styled as data rather than as an error.
 */
export function InsufficientData({ note }: { note?: string | null }) {
  return (
    <div className="rounded-md border border-dashed border-ink-600 bg-ink-850 p-4">
      <p className="font-mono text-xs font-semibold tracking-widest text-muted">
        INSUFFICIENT VERIFIABLE DATA
      </p>
      {note && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-paper/70">{note}</p>}
    </div>
  );
}

/** Methodological warnings. Section 28: no jokes in this component. */
export function WarningCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-warn/35 bg-warn-wash p-3">
      <p className="font-mono text-2xs font-semibold tracking-widest text-warn">{title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-paper/75">{children}</p>
    </div>
  );
}

export function Microcopy({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="mt-2 text-sm italic text-muted">{children}</p>;
}

export function EvidenceScorePill({ score, grade }: { score: number; grade: string }) {
  const tone =
    score >= 90
      ? "border-profit/50 text-profit"
      : score >= 75
        ? "border-accent/50 text-accent"
        : score >= 55
          ? "border-warn/50 text-warn"
          : "border-ink-600 text-muted";
  return (
    <span
      className={`tnum inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-2xs font-semibold tracking-wider ${tone}`}
      title={`Evidence score ${score}/100 (${grade}). Grades the evidence behind the number, not the platform.`}
    >
      <span>EVIDENCE {score}</span>
      <span className="opacity-60">{grade}</span>
    </span>
  );
}
