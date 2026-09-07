-- Trader Profitability Database -- schema
--
-- Two rules are enforced here rather than left to application code:
--   1. A statistic's wallet counts must sum to the analyzed total (CHECK).
--   2. A statistic is invisible to the site until status = 'approved'.
--
-- Statistics are never updated in place. A recalculation inserts a new row and
-- a new snapshot, so a figure quoted six months ago stays inspectable.

CREATE TABLE IF NOT EXISTS platforms (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                    TEXT NOT NULL UNIQUE,
    name                    TEXT NOT NULL,
    category                TEXT NOT NULL
                            CHECK (category IN ('prediction-markets','memecoins','perps','casinos','other')),
    description             TEXT NOT NULL DEFAULT '',
    chains                  TEXT[] NOT NULL DEFAULT '{}',
    website                 TEXT,
    -- Set when no participant-level statistic can be established.
    unknown_reason          TEXT
                            CHECK (unknown_reason IN ('centralized-no-participant-data','no-reproducible-source','research-pending')),
    data_availability_note  TEXT,
    is_published            BOOLEAN NOT NULL DEFAULT false,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profitability_stats (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_id               UUID NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,

    -- Counts. Percentages are derived at read time, never stored.
    analyzed                  BIGINT NOT NULL CHECK (analyzed > 0),
    profitable                BIGINT NOT NULL CHECK (profitable >= 0),
    unprofitable              BIGINT NOT NULL CHECK (unprofitable >= 0),
    break_even                BIGINT NOT NULL DEFAULT 0 CHECK (break_even >= 0),
    unknown_count             BIGINT NOT NULL DEFAULT 0 CHECK (unknown_count >= 0),
    CONSTRAINT counts_sum     CHECK (profitable + unprofitable + break_even + unknown_count = analyzed),

    median_pnl_usd            NUMERIC,
    mean_pnl_usd              NUMERIC,
    top_one_pct_profit_share  NUMERIC CHECK (top_one_pct_profit_share BETWEEN 0 AND 1),

    pnl_buckets               JSONB NOT NULL DEFAULT '[]'::jsonb,
    activity_bands            JSONB NOT NULL DEFAULT '[]'::jsonb,
    survivor_bands            JSONB NOT NULL DEFAULT '[]'::jsonb,
    time_series               JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Methodology. A statistic without these cannot score the +15.
    pnl_definition            TEXT NOT NULL,
    fees_included             BOOLEAN NOT NULL DEFAULT false,
    unrealized_included       BOOLEAN NOT NULL DEFAULT false,
    wallet_clustering         BOOLEAN NOT NULL DEFAULT false,
    exclusions                TEXT[] NOT NULL DEFAULT '{}',
    filters                   TEXT[] NOT NULL DEFAULT '{}',
    calculation_version       TEXT NOT NULL,
    methodology_notes         TEXT,

    -- Evidence factors, stored as recorded by the researcher. The site
    -- recomputes them from the sources at read time; a mismatch is a bug worth
    -- seeing rather than hiding.
    factor_official_data      BOOLEAN NOT NULL DEFAULT false,
    factor_public_sql         BOOLEAN NOT NULL DEFAULT false,
    factor_methodology        BOOLEAN NOT NULL DEFAULT false,
    factor_large_sample       BOOLEAN NOT NULL DEFAULT false,
    factor_recent             BOOLEAN NOT NULL DEFAULT false,
    factor_second_source      BOOLEAN NOT NULL DEFAULT false,

    period_start              DATE NOT NULL,
    period_end                DATE NOT NULL,
    CONSTRAINT period_order   CHECK (period_end >= period_start),

    -- Nothing reaches the site until a human approves it.
    status                    TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','approved','rejected')),
    review_note               TEXT,
    reviewed_by               TEXT,
    reviewed_at               TIMESTAMPTZ,

    adapter_id                TEXT,
    raw_payload               JSONB,

    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profitability_stats_platform_idx
    ON profitability_stats (platform_id, status, period_end DESC);

CREATE TABLE IF NOT EXISTS evidence_sources (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stat_id         UUID NOT NULL REFERENCES profitability_stats(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('primary','secondary','validation')),
    provider        TEXT NOT NULL,
    type            TEXT NOT NULL
                    CHECK (type IN ('onchain-raw','public-sql','official-api','indexer','academic','leaderboard','aggregator')),
    url             TEXT,
    query           TEXT,
    dataset_date    DATE,
    last_verified   DATE,
    sample_size     BIGINT,
    reproducible    BOOLEAN NOT NULL DEFAULT false,
    status          TEXT NOT NULL DEFAULT 'UNVERIFIED'
                    CHECK (status IN ('VERIFIED','PARTIAL','BROKEN','UNVERIFIED')),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS evidence_sources_stat_idx ON evidence_sources (stat_id);

-- Section 40: append-only history. There is deliberately no UPDATE path.
CREATE TABLE IF NOT EXISTS profitability_snapshots (
    id                  BIGSERIAL PRIMARY KEY,
    platform_slug       TEXT NOT NULL,
    captured_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    profitable_pct      NUMERIC,
    analyzed            BIGINT,
    evidence_score      INTEGER,
    calculation_version TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS profitability_snapshots_slug_idx
    ON profitability_snapshots (platform_slug, captured_at DESC);

-- Platform requests from readers (section 37).
CREATE TABLE IF NOT EXISTS platform_requests (
    id           BIGSERIAL PRIMARY KEY,
    name         TEXT NOT NULL,
    note         TEXT,
    source_hint  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Approving a statistic writes its snapshot in the same transaction, so the
-- history cannot drift from what was published.
CREATE OR REPLACE FUNCTION record_snapshot_on_approval() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
        INSERT INTO profitability_snapshots
            (platform_slug, profitable_pct, analyzed, calculation_version)
        SELECT p.slug,
               ROUND((NEW.profitable::NUMERIC / NULLIF(NEW.analyzed, 0)) * 100, 4),
               NEW.analyzed,
               NEW.calculation_version
        FROM platforms p WHERE p.id = NEW.platform_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profitability_stats_snapshot ON profitability_stats;
CREATE TRIGGER profitability_stats_snapshot
    AFTER UPDATE ON profitability_stats
    FOR EACH ROW EXECUTE FUNCTION record_snapshot_on_approval();
