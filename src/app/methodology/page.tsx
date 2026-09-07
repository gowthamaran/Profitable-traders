import type { Metadata } from "next";
import { EVIDENCE_RUBRIC, LARGE_SAMPLE_THRESHOLD, RECENT_DATA_MAX_AGE_DAYS } from "@/lib/metrics/evidence";
import { MEDIAN_LOSS_CEILING_USD, PAIN_INDEX_VERSION, PAIN_INDEX_WEIGHTS } from "@/lib/metrics/painIndex";
import { BADGE_RULES } from "@/lib/metrics/badges";
import { Panel } from "@/components/ui";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How profitability is calculated, how PnL is defined, how evidence is scored, and what these numbers cannot tell you.",
};

/**
 * Section 38. Humour is switched off entirely on this page -- it is the
 * document a reader consults when deciding whether to trust anything else.
 */
export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-paper sm:text-3xl">
        Boring but important
      </h1>
      <p className="mt-4 leading-relaxed text-muted">
        This page describes exactly how every figure on this site is produced, and the specific
        things those figures cannot tell you. If a claim elsewhere on the site conflicts with this
        page, this page is correct and the other page is a bug.
      </p>

      <div className="mt-12 space-y-12">
        <Section title="What is being measured">
          <p>
            For each platform we take the set of addresses that transacted with that platform&apos;s
            contracts inside a stated window, compute a realised profit or loss for each address,
            and report the share of those addresses that finished above zero.
          </p>
          <p>
            The unit of analysis is an <Term>address</Term>, not a person and not an account. This
            distinction is not a technicality; see &ldquo;Wallets are not people&rdquo; below.
          </p>
        </Section>

        <Section title="How profitability is calculated">
          <Formula>
            profitable % = profitable wallets ÷ wallets analyzed × 100
          </Formula>
          <p>
            Break-even wallets and wallets whose outcome could not be resolved remain in the
            denominator. Removing them would raise the reported profitable share without any wallet
            having changed outcome, so they stay in and are reported as their own counts.
          </p>
          <p>
            &ldquo;Break-even&rdquo; means a realised result within the rounding tolerance of zero
            stated on the record. &ldquo;Unknown&rdquo; means the address transacted but a complete
            cost basis could not be reconstructed from available data.
          </p>
        </Section>

        <Section title="PnL definition">
          <p>
            Realised PnL is proceeds from closes and sells minus the cost basis of opens and buys,
            converted to USD at the price prevailing at each transaction&apos;s block timestamp.
          </p>
          <ul>
            <li>
              <Term>Fees.</Term> Where a record states fees are included, trading fees, funding and
              gas are deducted. Where they are not, the record carries a warning card, because
              excluding fees makes outcomes look better than they were.
            </li>
            <li>
              <Term>Unrealized positions.</Term> Open positions are excluded by default. A wallet
              still holding is measured on what it has actually realised.
            </li>
            <li>
              <Term>Airdrops and rewards.</Term> Excluded unless the record states otherwise. Token
              incentives are not trading outcomes.
            </li>
          </ul>
        </Section>

        <Section title="Wallets are not people">
          <p>
            One person can operate any number of addresses, and one address can be operated by any
            number of people. Wallet clustering — grouping addresses that appear to share an
            operator — is not applied unless a record explicitly says so, and no clustering method
            is reliable enough for us to present its output as a count of individuals.
          </p>
          <p>
            Every figure on this site is therefore phrased as a share of{" "}
            <Term>analyzed wallets</Term>. A sentence of the form &ldquo;XX% of traders lost
            money&rdquo; does not appear on this site, because we cannot support it.
          </p>
        </Section>

        <Section title="Platforms with no participant data">
          <p>
            Centralized venues — most casinos and sportsbooks, and some exchanges — settle
            internally. Deposits and withdrawals may be visible on chain, but per-account results
            are held in a private ledger. For these platforms we show{" "}
            <Term>PROFITABILITY: UNKNOWN</Term> and record what is and is not available.
          </p>
          <p>
            A published house edge is not a substitute. House edge is a property of a game&apos;s
            rules and describes an expected long-run margin. It is not a measurement of what any
            group of users actually finished with, and this site does not present it as one.
          </p>
        </Section>

        <Section title="Evidence scoring">
          <p>
            The evidence score grades <Term>the evidence behind a number</Term>, not the platform
            and not the outcomes. A venue where wallets did badly can score 100 because its data is
            fully reproducible.
          </p>
          <Panel className="not-prose my-4 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-700 text-left">
                  <th className="label px-4 py-2.5 font-normal">Criterion</th>
                  <th className="label px-4 py-2.5 text-right font-normal">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {EVIDENCE_RUBRIC.map((rule) => (
                  <tr key={rule.key}>
                    <td className="px-4 py-3">
                      <p className="text-paper/85">{rule.label}</p>
                      <p className="text-xs text-muted">{rule.detail}</p>
                    </td>
                    <td className="tnum px-4 py-3 text-right text-paper">+{rule.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <p>
            &ldquo;Large sample&rdquo; means at least{" "}
            <Term>{LARGE_SAMPLE_THRESHOLD.toLocaleString("en-US")}</Term> analyzed wallets.
            &ldquo;Recent&rdquo; means the dataset window ends within{" "}
            <Term>{RECENT_DATA_MAX_AGE_DAYS} days</Term>. Grades: 90–100 very high, 75–89 high,
            55–74 medium, below 55 low.
          </p>
        </Section>

        <Section title="Pain index" id="pain-index">
          <p>
            The pain index is a <Term>metric invented by this site</Term>. Nobody else computes it,
            it is not comparable to anything published elsewhere, and it carries no authority beyond
            the inputs below. It exists to make one number out of five that usually move together.
          </p>
          <Formula>
            {Object.entries(PAIN_INDEX_WEIGHTS)
              .map(([key, weight]) => `${(weight * 100).toFixed(0)}% × ${key}`)
              .join("\n+ ")}
          </Formula>
          <ul>
            <li>Each input is normalised to 0–100 before weighting.</li>
            <li>
              Median loss is scaled against a ceiling of{" "}
              <Term>${MEDIAN_LOSS_CEILING_USD.toLocaleString("en-US")}</Term>; losses beyond that
              do not increase the component further.
            </li>
            <li>Loss severity is the share of losing wallets that lost more than $1,000.</li>
            <li>
              Activity-adjusted profitability uses the most active band on record for the platform.
            </li>
            <li>
              If an input is unavailable its weight is redistributed proportionally across the
              inputs that are available. A missing input is never scored as zero, and the platform
              page shows how much weight was redistributed.
            </li>
          </ul>
          <p className="text-sm text-muted">Version: {PAIN_INDEX_VERSION}</p>
        </Section>

        <Section title="Badges">
          <p>Badges are assigned by rule from computed values. None is ever applied by hand.</p>
          <Panel className="not-prose my-4 overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-ink-700">
                {Object.entries(BADGE_RULES).map(([id, rule]) => (
                  <tr key={id}>
                    <td className="px-4 py-3 font-mono text-2xs tracking-widest text-paper">{id}</td>
                    <td className="px-4 py-3 text-xs text-muted">{rule.criterion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <p>
            Negative badges describe observed wallet outcomes or the absence of public data. They
            are not statements about a company&apos;s conduct, and none is ever assigned to
            criticise an operator.
          </p>
        </Section>

        <Section title="Source selection">
          <p>Sources are accepted in roughly this order of preference:</p>
          <ol>
            <li>Raw chain data queried directly, or a first-party API from the platform itself.</li>
            <li>A published, re-runnable query on a public analytics platform.</li>
            <li>A maintained indexer with documented methodology.</li>
            <li>Peer-reviewed or otherwise public academic datasets.</li>
          </ol>
          <p>
            A statistic needs at least one primary source. An independent second source from a
            different provider is what earns the final ten points of the evidence score.
          </p>
        </Section>

        <Section title="Historical snapshots">
          <p>
            Statistics are never overwritten. Each recalculation is appended as a new snapshot with
            its own timestamp and calculation version, so a figure quoted from this site six months
            ago remains inspectable even after the current figure has moved.
          </p>
        </Section>

        <Section title="Limitations">
          <ul>
            <li>
              Survivorship in the data itself: addresses that never transacted do not appear, so
              these figures describe people who participated, not people who considered it.
            </li>
            <li>
              Window sensitivity: profitable share depends heavily on the window chosen. A bull
              window flatters every platform in this database.
            </li>
            <li>
              Cross-platform activity: a wallet that trades on several venues is counted separately
              on each, and its overall result may differ from any single row.
            </li>
            <li>
              Price sourcing: USD conversion depends on an oracle or reference price at each
              timestamp. Thin markets make that conversion less reliable.
            </li>
            <li>
              Bots and market makers: known addresses are excluded where identifiable, but
              identification is incomplete, and automated strategies remain in some datasets.
            </li>
          </ul>
        </Section>

        <Section title="Corrections">
          <p>
            If a figure here is wrong, the correction path is the same as the verification path:
            open the platform page, read the query, run it, and report the discrepancy with your
            result. Numbers on this site are meant to be attacked.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="border-b border-ink-700 pb-2 text-lg font-semibold tracking-tight text-paper">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-paper/80 [&_li]:ml-5 [&_li]:list-item [&_ol]:list-decimal [&_ol]:space-y-2 [&_ul]:list-disc [&_ul]:space-y-2">
        {children}
      </div>
    </section>
  );
}

function Term({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-paper">{children}</strong>;
}

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-sm border border-ink-700 bg-ink-950 p-3 font-mono text-xs leading-relaxed text-paper/90">
      {children}
    </pre>
  );
}
