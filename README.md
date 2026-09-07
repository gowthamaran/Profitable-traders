# Trader Profitability Database

A research site that answers one question for speculative crypto venues:
**what percentage of wallets actually finished profitable?**

Bloomberg terminal meets crypto culture — credible enough to cite, blunt enough
to screenshot. Every percentage carries its numerator, denominator, source,
query and methodology, and any figure that cannot be established reads
`INSUFFICIENT VERIFIABLE DATA` rather than an estimate.

> **Core principle:** you don't have to trust this website. You can check the
> calculation yourself.

---

## ⚠️ Read this before looking at any number

**This repository ships in DEMO MODE.** The dataset is synthetic — generated to
exercise the interface. It is **not** a measurement of Pump.fun, Hyperliquid,
Kalshi or any other named platform.

That is enforced, not just documented:

- A site-wide `DEMO DATA` banner and a `DEMO` badge on every card and figure.
- Demo evidence sources are `provider: "DEMO"`, `status: UNVERIFIED`, `url: null`.
  **No real Dune query, dataset or paper is ever cited for a synthetic number** —
  a fabricated figure behind a plausible source link is the most damaging thing
  this codebase could ship, so a test asserts it cannot happen.
- Demo records score **LOW** on the evidence rubric, which is the honest result
  for a figure with no reproducible source.

Production mode (`DATA_MODE=production`) ignores the demo dataset entirely and
serves only statistics that have been reproduced and approved in the database.
With no approved records the site is empty — by design.

---

## Interface update

The homepage starts with made-money / lost-money percentages and a short path
into each platform's results and evidence. Advanced charts and metrics remain
available in an expandable section on the detail page.

Public pages omit entries with neither a statistic nor a linked profitability
report. This removes Rollbit, Stake, Shuffle, BC.Game, Drift, and dYdX from the
demo's public catalogue. Their research records remain in the underlying data.

Fomo now has a report-only entry with public Dune links. Its result rows have
not been reproduced here: there is no invented percentage, no synthetic Fomo
statistic, and no Fomo entry in numerical rankings or comparisons. Existing
example statistics remain explicitly labelled DEMO.

## What it does

### The database
Platform cards showing profitable %, unprofitable %, wallets analyzed, median
PnL, evidence score and last-updated, filterable by category
(`ALL / PREDICTION MARKETS / MEMECOINS / PERPS / CASINOS / OTHER`) and sortable
without a page reload.

### Platform detail — `/platform/[slug]`
Headline split, raw counts (analyzed / profitable / unprofitable / break-even /
unknown), reality check, PnL distribution histogram, profitability by activity
level, the survivors, the graveyard, profitability over time (7D–ALL), pain
index with its full breakdown, algorithmic badges, methodological warnings, the
evidence drawer, and a share card.

### Verification — the point of the whole thing
- **SHOW ME THE RECEIPTS** — every source with provider, type, dataset date,
  sample, last-verified, reproducibility and status, plus the evidence score
  broken down line by line.
- **CHECK THE MATH** — numerator, denominator, the formula with the actual
  numbers substituted in, PnL definition, fee and unrealized treatment,
  exclusions, filters, date range, calculation version and the SQL.

### Other routes
`/rankings` (six boards) · `/compare` (two-platform face-off) ·
`/methodology` · `/sources` · `/admin` (research queue) · `/api/platforms`

---

## The rules the code enforces

These are the parts worth reviewing, because they are where a site like this
usually goes wrong.

**Percentages are never stored.** They are computed from counts at render time,
so the figure on the page and the figure in CHECK THE MATH cannot drift apart.

**Break-even and unknown wallets stay in the denominator.** Dropping them would
raise the profitable share without any wallet changing outcome. A test pins
this.

**Wallets are not people.** Every figure is phrased as a share of *analyzed
wallets*. The sentence "XX% of traders lost money" does not appear, because one
person can run many wallets and no clustering method is good enough to claim
otherwise.

**Centralized venues get UNKNOWN, not a guess.** Casinos settle internally, so
`PROFITABILITY: UNKNOWN` + `DATA BLACK HOLE` plus a note on exactly what is and
is not public. **House edge is never presented as observed trader
profitability** — it describes a game's expected margin, not what anyone
finished with.

**Nothing publishes itself.** Adapters produce `pending` records. Only a signed
POST to `/api/admin/review` with a named reviewer makes one public. Rejected
records are kept, because a rejected calculation is part of the audit trail.

**Statistics are never overwritten.** Approval appends a snapshot in the same
transaction, so a figure quoted six months ago stays inspectable.

**Adapters fail loudly.** A missing column, counts that don't sum, or absent
credentials all return a failure with a reason. No adapter ever infers which
column meant "profitable" — a mis-mapped column produces a plausible number with
no relationship to reality.

**Polymarket is excluded everywhere**, per the specification. A test asserts it.

---

## Running it

```bash
npm install
cp .env.example .env    # works as-is: demo mode, no services needed
npm run dev             # http://localhost:3000
```

### Production mode

```bash
psql "$DATABASE_URL" -f db/schema.sql
export DATABASE_URL=postgres://...
export DATA_MODE=production
export ADMIN_TOKEN=$(openssl rand -hex 32)
npm run build && npm start
```

The site now serves only approved records. Approve one with:

```bash
curl -X POST "$SITE_URL/api/admin/review" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"statId":"<uuid>","decision":"approve","reviewer":"your-name",
       "note":"Re-ran the query, counts match within 0.1%."}'
```

Deploy target is Vercel (`vercel.json` included); any Node host works.

### Deploy the website to Vercel

1. In Vercel, import `gowthamaran/Profitable-traders` and select its default
   branch, `claude/build-deploy-github-cfmglm`.
2. Keep the repository root and the detected **Next.js** preset. Use project
   name `profitable-traders` and set `DATA_MODE=demo` for the initial preview.
3. Deploy. No database or API keys are needed to explore the demo.

Demo pages are marked `noindex` to keep synthetic figures out of search results.
Page metadata uses Vercel's deployment domain automatically; set `SITE_URL` only
when you have a custom domain. To publish real figures, configure Postgres,
apply the schema, populate and review evidence, then set `DATA_MODE=production`.
Deploying the code does not collect or verify profitability data automatically.

### Environment

| Variable | Purpose |
| --- | --- |
| `DATA_MODE` | `demo` or `production`. Defaults by whether `DATABASE_URL` is set. |
| `DATABASE_URL` | Postgres / Supabase connection string. |
| `ADMIN_TOKEN` | 32+ chars. Absent ⇒ the review endpoint is disabled. |
| `DUNE_API_KEY` | Optional. Absent ⇒ the adapter reports it cannot run. |
| `FLIPSIDE_API_KEY` | Optional, used as the independent second source. |
| `SITE_URL` | Canonical URL for metadata and share links. |

---

## Layout

```
src/
  app/            routes: home, platform/[slug], compare, rankings,
                  methodology, sources, admin, api/
  components/     cards, charts, evidence drawer, share card, primitives
  lib/
    types.ts      a percentage cannot exist without its evidence
    metrics/      profitability · evidence · painIndex · badges · microcopy
    data/         repository · mapping · demo dataset · mode
    adapters/     dune · flipside · defillama · hyperliquid
db/schema.sql     counts CHECK, approval gate, append-only snapshots
tests/            88 tests, no network
```

## Development

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

The suite covers the arithmetic (denominators, bucket classification,
percentage identities), the evidence rubric and its grade bands, the pain index
including weight redistribution, every badge rule, the microcopy triggers, the
demo dataset's internal consistency **and its labelling**, adapter failure
modes, and row mapping's rejection of inconsistent records.

## Humour policy

Roughly one playful element per screen, always as secondary copy under the
statistic, and never on `/methodology` or a data warning. Nothing jokes about
individuals, addiction, or anyone's real losses — the target is speculative
markets in aggregate. Where humour and credibility conflict, credibility wins.

## Not advice

Historical observation of wallet-level outcomes. Nothing here forecasts any
future result.

## License

MIT — see [LICENSE](LICENSE).
