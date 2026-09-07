/** Small fetch wrapper: a timeout, one retry on 5xx, and no silent failures. */
export async function getJson(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<{ ok: true; data: unknown } | { ok: false; reason: string; retriable: boolean }> {
  const { timeoutMs = 20_000, ...rest } = init;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...rest, signal: controller.signal });
      if (response.status >= 500) {
        if (attempt === 1) continue;
        return { ok: false, reason: `${url} returned ${response.status}`, retriable: true };
      }
      if (!response.ok) {
        return { ok: false, reason: `${url} returned ${response.status}`, retriable: false };
      }
      return { ok: true, data: await response.json() };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === 2) return { ok: false, reason: `${url} failed: ${message}`, retriable: true };
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, reason: `${url} failed`, retriable: true };
}
