import type { Metadata } from "next";
import { db } from "@/lib/data/db";
import { adminConfigured } from "@/lib/admin/auth";
import { dataMode } from "@/lib/data/mode";
import { configuredAdapters, ADAPTERS } from "@/lib/adapters";
import { fullNumber, isoDate } from "@/lib/format";
import { Panel, SectionHeading, WarningCard } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Research queue",
  robots: { index: false, follow: false },
};

/**
 * The research console (section 43).
 *
 * This page is read-only: it shows what is waiting for review and what the
 * pipeline can currently reach. Approving is a POST to /api/admin/review with
 * the admin bearer token, so a mis-click in a browser cannot publish a number.
 */
export default async function AdminPage() {
  const sql = db();
  const pending = sql
    ? await sql`
        SELECT s.id, s.analyzed, s.profitable, s.unprofitable, s.period_start, s.period_end,
               s.calculation_version, s.adapter_id, s.created_at, p.name AS platform_name
        FROM profitability_stats s
        JOIN platforms p ON p.id = s.platform_id
        WHERE s.status = 'pending'
        ORDER BY s.created_at DESC
        LIMIT 50
      `
    : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-paper sm:text-3xl">
        Research queue
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        Statistics land here as <span className="font-mono text-xs">pending</span> and stay
        invisible to the site until a reviewer approves them. Nothing on this page publishes
        anything; approval is a signed POST to the review endpoint.
      </p>

      <div className="mt-8 space-y-8">
        <section>
          <SectionHeading title="Environment" />
          <Panel className="divide-y divide-ink-700">
            <Row label="Data mode" value={dataMode()} />
            <Row label="Database" value={sql ? "connected" : "not configured"} />
            <Row
              label="Admin token"
              value={adminConfigured() ? "configured" : "not set — review endpoint disabled"}
            />
          </Panel>
        </section>

        {dataMode() === "demo" && (
          <WarningCard title="DEMO MODE ACTIVE">
            The public site is serving synthetic records. Set DATA_MODE=production with a
            DATABASE_URL to serve reviewed statistics instead. Demo records are never written to the
            database and cannot be approved.
          </WarningCard>
        )}

        <section>
          <SectionHeading
            title="Adapters"
            note="An adapter with no credentials returns a failure rather than a partial number."
          />
          <Panel className="divide-y divide-ink-700">
            {ADAPTERS.map((adapter) => (
              <Row
                key={adapter.id}
                label={adapter.provider}
                value={adapter.isConfigured() ? "configured" : "no credentials"}
              />
            ))}
          </Panel>
          <p className="mt-2 text-xs text-muted">
            {configuredAdapters().length} of {ADAPTERS.length} adapters can currently run.
          </p>
        </section>

        <section>
          <SectionHeading title="Pending review" />
          {!sql ? (
            <Panel className="p-4">
              <p className="text-sm text-muted">
                No database configured, so there is no queue to show.
              </p>
            </Panel>
          ) : pending.length === 0 ? (
            <Panel className="p-4">
              <p className="text-sm text-muted">Nothing is waiting for review.</p>
            </Panel>
          ) : (
            <Panel className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-sm">
                <thead>
                  <tr className="border-b border-ink-700 text-left">
                    {["Platform", "Analyzed", "Profitable", "Period", "Version", "Adapter", "Stat id"].map(
                      (h) => (
                        <th key={h} className="label whitespace-nowrap px-3 py-2.5 font-normal">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-700">
                  {pending.map((row: Record<string, unknown>) => (
                    <tr key={String(row.id)}>
                      <td className="px-3 py-3 text-paper">{String(row.platform_name)}</td>
                      <td className="tnum px-3 py-3 text-paper/80">
                        {fullNumber(Number(row.analyzed))}
                      </td>
                      <td className="tnum px-3 py-3 text-paper/80">
                        {fullNumber(Number(row.profitable))}
                      </td>
                      <td className="tnum whitespace-nowrap px-3 py-3 text-xs text-paper/70">
                        {isoDate(String(row.period_start))} → {isoDate(String(row.period_end))}
                      </td>
                      <td className="px-3 py-3 font-mono text-2xs text-muted">
                        {String(row.calculation_version)}
                      </td>
                      <td className="px-3 py-3 font-mono text-2xs text-muted">
                        {row.adapter_id ? String(row.adapter_id) : "manual"}
                      </td>
                      <td className="px-3 py-3 font-mono text-2xs text-faint">{String(row.id)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}
        </section>

        <section>
          <SectionHeading title="Approving a record" />
          <pre className="overflow-x-auto rounded-md border border-ink-700 bg-ink-950 p-4 font-mono text-xs leading-relaxed text-paper/85">
{`curl -X POST "$SITE_URL/api/admin/review" \\
  -H "Authorization: Bearer $ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "statId":   "<uuid from the table above>",
    "decision": "approve",
    "reviewer": "your-name",
    "note":     "Re-ran the query, counts match within 0.1%."
  }'`}
          </pre>
          <p className="mt-2 text-xs text-muted">
            A reviewer name is required and stored against the row. Rejected records are kept, not
            deleted — the fact that a calculation was rejected is part of the audit trail.
          </p>
        </section>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3">
      <span className="text-sm text-muted">{label}</span>
      <span className="font-mono text-xs text-paper">{value}</span>
    </div>
  );
}
