import type { Category, Platform, Snapshot } from "@/lib/types";
import { demoPlatforms } from "./demo";
import { db } from "./db";
import { dataMode } from "./mode";
import { rowsToPlatforms, rowsToSnapshots } from "./mapping";

/**
 * The only place the rest of the app gets platform data from.
 *
 * Production reads approved rows from Postgres. A statistic that has not been
 * approved does not appear at all -- an unreviewed number never reaches a page
 * by accident, which is the point of section 43.
 */

export interface PlatformQuery {
  category?: Category | "all";
  search?: string;
}

export async function getPlatforms(query: PlatformQuery = {}): Promise<Platform[]> {
  const all = await loadAll();
  const category = query.category && query.category !== "all" ? query.category : null;
  const search = query.search?.trim().toLowerCase();

  return all.filter((p) => {
    if (category && p.category !== category) return false;
    if (search) {
      const haystack = `${p.name} ${p.slug} ${p.description}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

export async function getPlatform(slug: string): Promise<Platform | null> {
  const all = await loadAll();
  return all.find((p) => p.slug === slug) ?? null;
}

export async function getSnapshots(slug: string): Promise<Snapshot[]> {
  if (dataMode() === "demo") return [];
  const sql = db();
  if (!sql) return [];
  const rows = await sql`
    SELECT platform_slug, captured_at, profitable_pct, analyzed, evidence_score, calculation_version
    FROM profitability_snapshots
    WHERE platform_slug = ${slug}
    ORDER BY captured_at ASC
  `;
  return rowsToSnapshots(rows);
}

/** Counts for the hero. Shown only where the underlying records exist. */
export interface DatabaseCounts {
  platforms: number;
  withVerifiedStat: number;
  walletsAnalyzed: number;
  sources: number;
}

export async function getDatabaseCounts(): Promise<DatabaseCounts> {
  const all = await loadAll();
  const withStat = all.filter((p) => p.stat);
  return {
    platforms: all.length,
    withVerifiedStat: withStat.length,
    walletsAnalyzed: withStat.reduce((sum, p) => sum + (p.stat?.counts.analyzed ?? 0), 0),
    sources: withStat.reduce((sum, p) => sum + (p.stat?.sources.length ?? 0), 0),
  };
}

let cache: { at: number; platforms: Platform[] } | null = null;
const CACHE_MS = 60_000;

async function loadAll(): Promise<Platform[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.platforms;

  const platforms = dataMode() === "demo" ? demoPlatforms() : await loadFromDatabase();
  cache = { at: Date.now(), platforms };
  return platforms;
}

/** Exposed for tests and for the admin tools after an approval. */
export function clearPlatformCache(): void {
  cache = null;
}

async function loadFromDatabase(): Promise<Platform[]> {
  const sql = db();
  if (!sql) {
    // Production mode without a database: no verified records exist, so the
    // site shows nothing rather than falling back to synthetic numbers.
    return [];
  }

  const platformRows = await sql`
    SELECT slug, name, category, description, chains, website,
           unknown_reason, data_availability_note
    FROM platforms
    WHERE is_published = true
    ORDER BY name ASC
  `;

  const statRows = await sql`
    SELECT s.*, p.slug AS platform_slug
    FROM profitability_stats s
    JOIN platforms p ON p.id = s.platform_id
    WHERE s.status = 'approved' AND p.is_published = true
      AND s.id = (
        SELECT id FROM profitability_stats s2
        WHERE s2.platform_id = s.platform_id AND s2.status = 'approved'
        ORDER BY s2.period_end DESC, s2.created_at DESC LIMIT 1
      )
  `;

  const sourceRows = await sql`
    SELECT e.*, p.slug AS platform_slug
    FROM evidence_sources e
    JOIN profitability_stats s ON s.id = e.stat_id
    JOIN platforms p ON p.id = s.platform_id
    WHERE s.status = 'approved'
  `;

  return rowsToPlatforms(platformRows, statRows, sourceRows);
}
