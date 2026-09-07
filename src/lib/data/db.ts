import postgres from "postgres";

/**
 * Lazily created Postgres client. Absent DATABASE_URL the site runs in demo
 * mode and never touches this module.
 */
let client: postgres.Sql | null = null;

export function db(): postgres.Sql | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!client) {
    client = postgres(url, {
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      idle_timeout: 20,
      prepare: false,
      ssl: url.includes("sslmode=disable") ? false : "require",
    });
  }
  return client;
}
