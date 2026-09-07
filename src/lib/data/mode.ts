/**
 * Demo mode versus production mode.
 *
 * Demo mode serves the synthetic dataset and shows a DEMO DATA banner site
 * wide plus a badge on every figure. Production mode reads verified records
 * from the database and shows INSUFFICIENT VERIFIABLE DATA wherever a
 * statistic has not cleared review. There is deliberately no third mode that
 * mixes unlabelled synthetic numbers into a production page.
 */
export type DataMode = "demo" | "production";

export function dataMode(): DataMode {
  const raw = (process.env.DATA_MODE ?? "").trim().toLowerCase();
  if (raw === "production") return "production";
  if (raw === "demo") return "demo";
  // Default follows the infrastructure: a configured database means someone
  // intends to serve real records.
  return process.env.DATABASE_URL ? "production" : "demo";
}

export function isDemoMode(): boolean {
  return dataMode() === "demo";
}
