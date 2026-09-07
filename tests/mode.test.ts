import { afterEach, describe, expect, it, vi } from "vitest";
import { dataMode, isDemoMode } from "@/lib/data/mode";
import { adminConfigured, isAuthorised } from "@/lib/admin/auth";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("data mode", () => {
  it("defaults to demo with no database configured", () => {
    vi.stubEnv("DATA_MODE", "");
    vi.stubEnv("DATABASE_URL", "");
    expect(dataMode()).toBe("demo");
    expect(isDemoMode()).toBe(true);
  });

  it("switches to production once a database is configured", () => {
    vi.stubEnv("DATA_MODE", "");
    vi.stubEnv("DATABASE_URL", "postgres://localhost/db");
    expect(dataMode()).toBe("production");
  });

  it("honours an explicit override in both directions", () => {
    vi.stubEnv("DATABASE_URL", "postgres://localhost/db");
    vi.stubEnv("DATA_MODE", "demo");
    expect(dataMode()).toBe("demo");

    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("DATA_MODE", "production");
    expect(dataMode()).toBe("production");
  });
});

describe("admin auth", () => {
  it("is disabled when no token is set", () => {
    vi.stubEnv("ADMIN_TOKEN", "");
    expect(adminConfigured()).toBe(false);
    expect(isAuthorised("Bearer anything")).toBe(false);
  });

  it("rejects a token shorter than 16 characters", () => {
    vi.stubEnv("ADMIN_TOKEN", "short");
    expect(adminConfigured()).toBe(false);
    expect(isAuthorised("Bearer short")).toBe(false);
  });

  it("accepts the configured token with and without the Bearer prefix", () => {
    const token = "a".repeat(32);
    vi.stubEnv("ADMIN_TOKEN", token);
    expect(adminConfigured()).toBe(true);
    expect(isAuthorised(`Bearer ${token}`)).toBe(true);
    expect(isAuthorised(token)).toBe(true);
  });

  it("rejects a wrong token of the same length", () => {
    vi.stubEnv("ADMIN_TOKEN", "a".repeat(32));
    expect(isAuthorised(`Bearer ${"b".repeat(32)}`)).toBe(false);
  });

  it("rejects a missing header", () => {
    vi.stubEnv("ADMIN_TOKEN", "a".repeat(32));
    expect(isAuthorised(null)).toBe(false);
  });
});
