"use client";

import { useState } from "react";
import type { ProfitabilityStat } from "@/lib/types";
import { EVIDENCE_RUBRIC, deriveEvidenceFactors, gradeEvidence, scoreEvidence } from "@/lib/metrics/evidence";
import { profitablePct } from "@/lib/metrics/profitability";
import { fullNumber, isoDate } from "@/lib/format";

/**
 * SHOW ME THE RECEIPTS and CHECK THE MATH.
 *
 * Section 26: the reader must be able to reconstruct the headline number from
 * what is printed here. The numerator, denominator and formula are rendered
 * from the same values that produced the figure on the page, so they cannot
 * drift apart.
 */
export function EvidenceDrawer({ stat, platformName }: { stat: ProfitabilityStat; platformName: string }) {
  const [tab, setTab] = useState<"receipts" | "math">("receipts");
  const [open, setOpen] = useState(false);
  const factors = deriveEvidenceFactors(stat);
  const score = scoreEvidence(factors);

  return (
    <div className="rounded-md border border-ink-700 bg-ink-900">
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-700 p-3">
        <button
          type="button"
          onClick={() => {
            setTab("receipts");
            setOpen(true);
          }}
          className={`rounded-sm px-2.5 py-1.5 font-mono text-2xs font-semibold tracking-widest transition-colors ${
            open && tab === "receipts" ? "bg-ink-700 text-paper" : "text-muted hover:text-paper"
          }`}
        >
          SHOW ME THE RECEIPTS
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("math");
            setOpen(true);
          }}
          className={`rounded-sm px-2.5 py-1.5 font-mono text-2xs font-semibold tracking-widest transition-colors ${
            open && tab === "math" ? "bg-ink-700 text-paper" : "text-muted hover:text-paper"
          }`}
        >
          CHECK THE MATH
        </button>
        {open && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="ml-auto rounded-sm px-2 py-1.5 font-mono text-2xs tracking-widest text-faint hover:text-paper"
          >
            CLOSE
          </button>
        )}
      </div>

      {open && (
        <div className="animate-fade-up p-4">
          {tab === "receipts" ? (
            <Receipts stat={stat} score={score} factors={factors} />
          ) : (
            <CheckTheMath stat={stat} platformName={platformName} />
          )}
        </div>
      )}
    </div>
  );
}

function Receipts({
  stat,
  score,
  factors,
}: {
  stat: ProfitabilityStat;
  score: number;
  factors: ReturnType<typeof deriveEvidenceFactors>;
}) {
  const byRole = (role: string) => stat.sources.filter((s) => s.role === role);
  return (
    <div className="space-y-6">
      <div>
        <p className="label">Evidence score</p>
        <p className="tnum mt-1 text-2xl font-semibold text-paper">
          {score}
          <span className="ml-2 text-sm font-normal text-muted">/ 100 · {gradeEvidence(score)}</span>
        </p>
        <ul className="mt-3 space-y-1.5">
          {EVIDENCE_RUBRIC.map((rule) => {
            const earned = factors[rule.key];
            return (
              <li key={rule.key} className="flex items-start gap-2 text-sm">
                <span
                  className={`tnum mt-0.5 w-10 shrink-0 text-right font-mono text-xs ${
                    earned ? "text-profit" : "text-faint"
                  }`}
                >
                  {earned ? `+${rule.points}` : "0"}
                </span>
                <span className={earned ? "text-paper/85" : "text-faint"}>
                  {rule.label}
                  <span className="ml-1.5 text-xs text-muted">{rule.detail}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {(["primary", "secondary", "validation"] as const).map((role) => {
        const sources = byRole(role);
        if (sources.length === 0) return null;
        return (
          <div key={role}>
            <p className="label">{role} source{sources.length > 1 ? "s" : ""}</p>
            <ul className="mt-2 space-y-2">
              {sources.map((source) => (
                <li key={source.id} className="rounded-sm border border-ink-700 bg-ink-850 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-paper">{source.provider}</span>
                    <span className="rounded-sm border border-ink-600 px-1 py-px font-mono text-2xs text-muted">
                      {source.type}
                    </span>
                    <StatusPill status={source.status} />
                    {source.reproducible && (
                      <span className="rounded-sm border border-profit/40 px-1 py-px font-mono text-2xs text-profit">
                        REPRODUCIBLE
                      </span>
                    )}
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
                    <Field label="Dataset date" value={isoDate(source.datasetDate)} />
                    <Field label="Last verified" value={isoDate(source.lastVerified)} />
                    <Field
                      label="Sample"
                      value={source.sampleSize ? fullNumber(source.sampleSize) : "not stated"}
                    />
                  </dl>
                  {source.notes && <p className="mt-2 text-xs text-muted">{source.notes}</p>}
                  {source.url ? (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-2 inline-block font-mono text-2xs tracking-widest text-accent hover:underline"
                    >
                      OPEN SOURCE →
                    </a>
                  ) : (
                    <p className="mt-2 font-mono text-2xs tracking-widest text-faint">
                      NO PUBLIC LINK ON RECORD
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function CheckTheMath({ stat, platformName }: { stat: ProfitabilityStat; platformName: string }) {
  const { counts, methodology } = stat;
  const query = stat.sources.find((s) => s.query)?.query ?? null;

  return (
    <div className="space-y-6">
      <div>
        <p className="label">The calculation</p>
        <div className="mt-2 overflow-x-auto rounded-sm border border-ink-700 bg-ink-950 p-3">
          <code className="tnum whitespace-pre text-sm text-paper/90">
            {`profitable %  =  profitable wallets / wallets analyzed × 100
              =  ${fullNumber(counts.profitable)} / ${fullNumber(counts.analyzed)} × 100
              =  ${profitablePct(counts).toFixed(4)}%`}
          </code>
        </div>
        <p className="mt-2 text-xs text-muted">
          Break-even and unknown wallets stay in the denominator. Removing them would raise the
          profitable share without any wallet changing outcome.
        </p>
      </div>

      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <Field label="Numerator" value={`${fullNumber(counts.profitable)} profitable wallets`} mono />
        <Field label="Denominator" value={`${fullNumber(counts.analyzed)} analyzed wallets`} mono />
        <Field label="PnL definition" value={methodology.pnlDefinition} />
        <Field label="Fees" value={methodology.feesIncluded ? "Included" : "Not included"} />
        <Field
          label="Unrealized positions"
          value={methodology.unrealizedIncluded ? "Included" : "Excluded"}
        />
        <Field
          label="Wallet clustering"
          value={methodology.walletClustering ? "Applied" : "Not applied"}
        />
        <Field
          label="Date range"
          value={`${isoDate(methodology.dateRangeStart)} to ${isoDate(methodology.dateRangeEnd)}`}
          mono
        />
        <Field label="Calculation version" value={methodology.calculationVersion} mono />
      </dl>

      <div>
        <p className="label">Exclusions</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-paper/80">
          {methodology.exclusions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      {methodology.filters.length > 0 && (
        <div>
          <p className="label">Filters</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-paper/80">
            {methodology.filters.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="label">Dataset query</p>
        {query ? (
          <pre className="mt-2 max-h-72 overflow-auto rounded-sm border border-ink-700 bg-ink-950 p-3 text-xs leading-relaxed text-paper/85">
            {query}
          </pre>
        ) : (
          <p className="mt-2 text-sm text-muted">
            No query is on record for {platformName}. Until one is published this statistic cannot
            reach an evidence grade above LOW.
          </p>
        )}
      </div>

      <p className="border-t border-ink-700 pt-3 font-mono text-2xs tracking-widest text-faint">
        DON&apos;T TRUST US. THAT&apos;S THE POINT.
      </p>
    </div>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="label">{label}</dt>
      <dd className={`mt-0.5 text-sm text-paper/85 ${mono ? "tnum" : ""}`}>{value}</dd>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone =
    status === "VERIFIED"
      ? "border-profit/40 text-profit"
      : status === "PARTIAL"
        ? "border-warn/40 text-warn"
        : status === "BROKEN"
          ? "border-loss/40 text-loss"
          : "border-ink-600 text-muted";
  return (
    <span className={`rounded-sm border px-1 py-px font-mono text-2xs tracking-wider ${tone}`}>
      {status}
    </span>
  );
}
