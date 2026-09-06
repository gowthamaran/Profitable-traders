# Sri WAGMI

A Solana meme coin scanner that runs as a Telegram bot. It reports what it can
confirm on chain, and says plainly when it could not read something.

The design rule, enforced in the filters and covered by tests: **an unknown is
never a pass.** If the mint authority could not be read, the coin does not clear
the safety gate — it lands in the unknowns list with the reason attached.

---

## What it does

### Watch

**Trench scan** — every 10 minutes over the pump.fun feed:

- bonding curve 30–70% complete
- mint authority dead, freeze authority dead (read from the SPL mint account)
- holders not clustered — top 10 non-pool accounts under 25% of supply
- buys up — buy/sell ratio at least 1.3× over 30+ prints

**Secondary scan** — every 30 minutes over Dexscreener, for coins that already
took their beating:

- 7 days or older
- $2m–$25m market cap
- LP not thin — at least $80k and at least 3% of market cap
- volume back after the dump — 6h pace at least 1.2× the trailing 24h pace

Both cap at **3 names per report, or silence**. Nothing clearing is a result,
not a failure, and a scheduled scan that finds nothing says nothing. A name
already called is suppressed for 24 hours.

**Culture scan** — what is spreading on X *outside* CT, then whether a coin for
it exists yet. This job ships **off**. Turn it on with `/on culture`.

### Check a ticker

Paste a contract, a pump.fun link, a Dexscreener link, or a name. You get mint
authority, freeze authority, LP, age, market cap, volume, buy/sell flow, holder
concentration, and whether CT has already flooded it.

Names resolve through Dexscreener search and ambiguity is reported — if four
Solana pairs match `$DOG`, it shows the deepest and tells you to paste the
contract if you meant another one. **It will not invent a contract.** No
address is ever constructed; every one is either read out of your input or
returned by a source.

### Commands

| Command | What it does |
| --- | --- |
| `/check <CA \| link \| name>` | Full read on one coin |
| `/scan` | Run the trench pass now |
| `/secondary` | Run the survivors pass now |
| `/culture` | One-off culture scan |
| `/jobs` | What is running, and how often |
| `/on <job>` / `/off <job>` | `trench`, `secondary`, `culture` — survives restart |
| `/why [job]` | Why the last batch was rejected, with reasons |
| `/thresholds` | The exact numbers being filtered on |
| `/whoami` | Your chat id, for the allowlist |

Pasting a bare contract address into the chat runs `/check` on it.

---

## What it cannot do

Stated up front because a scanner that hides its blind spots is worse than no
scanner:

- **GMGN unique holders — no.** Cloudflare blocks a plain API client. There is
  no read here, and none is faked.
- **Clustering is approximate.** `getTokenLargestAccounts` returns the top 20
  token accounts. One entity behind thirty wallets still reads as thirty
  holders. Known pool and bonding-curve programs are excluded so deep LP does
  not read as a whale, but the ceiling is real and every holder line says so.
- **CT flood counts need an X API key.** Without `TWITTER_BEARER_TOKEN` the
  report says the check did not run. It never estimates a mention count.
- **It does not predict.** No targets, no calls, no "this is going to run."
  Numbers, sources, and the reasons a coin failed.

---

## Running it

### Setup

```bash
git clone https://github.com/gowthamaran/Profitable-traders.git
cd Profitable-traders
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Fill in `.env`:

1. `TELEGRAM_BOT_TOKEN` — from [@BotFather](https://t.me/BotFather).
2. `ALLOWED_CHAT_IDS` — message the bot `/whoami` to get your chat id. **The bot
   refuses to start without this**, so a leaked token does not become an open
   bot.
3. `SOLANA_RPC_URL` — strongly recommended. The public endpoint is rate limited
   and will throttle the holder reads, which shows up as "holders: unread".

Then:

```bash
python -m sri_wagmi
```

### Docker

```bash
docker compose up -d --build
```

State (the repeat-suppression window and the job switches) lives on a named
volume, so restarts do not re-call the same coins.

### Every threshold is an environment variable

`.env.example` lists all of them with their defaults. Nothing is hardcoded in
the scan logic; `sri_wagmi/config.py` is the single place they live, and
`/thresholds` prints whatever is actually loaded.

---

## Layout

```
sri_wagmi/
  config.py         every threshold, env-driven, one place
  models.py         Token / Market / MintAuthorities / HolderSpread / Verdict
  resolve.py        CA, pump.fun link, Dexscreener link, solscan link or name
  scanner.py        the engine: fetch, confirm on chain, filter, rank
  state.py          sqlite: what was called, which jobs are on
  formatting.py     Telegram output (HTML, everything upstream escaped)
  sources/
    http.py         one aiohttp session, concurrency gate, bounded retries
    dexscreener.py  price, LP, volume, txn counts, pair age
    pumpfun.py      trench feed, bonding curve progress from curve reserves
    solana.py       mint/freeze authority, holder spread, pool-owner exclusion
    ct.py           X reads: flood counts and the culture pass
  analysis/
    filters.py      the two passes, each rejection carrying its reason
  jobs/scans.py     scheduled passes, silent when empty
  bot/              handlers and application wiring
```

Cost discipline is in the ordering: the free cuts (bonding band, repeat
suppression) run first, then one batched Dexscreener call, and only the top 12
survivors by volume are worth paying RPC for.

## Development

```bash
pip install -r requirements-dev.txt
pytest -q
ruff check sri_wagmi tests
ruff format --check sri_wagmi tests
```

84 tests, no network: `tests/test_scanner.py` stubs the HTTP layer at the URL
level, so the real source parsers, the real filters and the real budget logic
all run against canned upstream payloads.

## Not advice

This reads public data and prints it. It does not know what a chart does next,
and neither does anyone else. Size it yourself.

## License

MIT — see [LICENSE](LICENSE).
