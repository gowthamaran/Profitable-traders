import { timingSafeEqual } from "node:crypto";

/**
 * Admin access is a shared bearer token in ADMIN_TOKEN.
 *
 * Deliberately simple, and deliberately closed by default: with no token
 * configured the admin surface is unavailable rather than open. Compared in
 * constant time so the check does not leak the token's prefix.
 */
export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_TOKEN && process.env.ADMIN_TOKEN.length >= 16);
}

export function isAuthorised(header: string | null): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || expected.length < 16) return false;
  if (!header) return false;

  const presented = header.startsWith("Bearer ") ? header.slice(7) : header;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
