import type { Platform } from "@/lib/types";

export function ProfitabilityReports({ platform }: { platform: Platform }) {
  return (
    <section className="report-panel mt-6 rounded-md border border-ink-600 bg-ink-900 p-6">
      <p className="text-sm font-medium text-accent">Public reports · results not yet verified here</p>
      <h2 className="mt-3 text-2xl font-semibold">Fomo has receipts. Start here.</h2>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">{platform.dataAvailabilityNote}</p>
      <div className="mt-6 grid gap-3">
        {platform.profitabilityReports?.map((report) => (
          <a key={report.url} href={report.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between gap-4 rounded-md border border-ink-600 px-4 py-4 text-base text-paper hover:border-accent">
            {report.title}<span aria-hidden>↗</span>
          </a>
        ))}
      </div>
      <p className="mt-5 text-sm text-muted">Different time windows and profit definitions can produce different results. These reports are not used to rank Fomo.</p>
    </section>
  );
}
