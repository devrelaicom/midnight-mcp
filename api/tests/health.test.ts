/**
 * Health route tests
 */

import { describe, it, expect, vi } from "vitest";
import app from "../src/index";
import { createMockBindings, createMockExecutionCtx } from "./helpers/mock-bindings";

const env = createMockBindings();
const ctx = createMockExecutionCtx();

describe("Health routes", () => {
  it("GET / returns ok status", async () => {
    const res = await app.request("/", {}, env, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("status", "ok");
    expect(body).toHaveProperty("service", "midnight-mcp-api");
  });

  it("GET /health returns healthy with environment", async () => {
    const res = await app.request("/health", {}, env, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("status", "healthy");
    expect(body).toHaveProperty("environment", "test");
  });
});

describe("Readiness endpoint", () => {
  it("GET /ready returns 200 when all dependencies are healthy", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    const res = await app.request("/ready", {}, env, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ready");
    expect(body.checks.d1.ok).toBe(true);
    expect(body.checks.playground.ok).toBe(true);

    fetchSpy.mockRestore();
  });

  it("GET /ready returns 503 when D1 is down", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    const brokenD1 = {
      prepare: () => ({
        bind: () => ({ first: () => Promise.reject(new Error("D1 connection failed")) }),
        first: () => Promise.reject(new Error("D1 connection failed")),
        all: async () => ({ results: [], success: false, meta: {} }),
        run: async () => ({ success: false, meta: {} }),
        raw: async () => [],
      }),
      batch: async () => [],
      exec: async () => ({ count: 0, duration: 0 }),
      dump: async () => new ArrayBuffer(0),
    } as unknown as D1Database;

    const degradedEnv = createMockBindings({ DB: brokenD1 });
    const res = await app.request("/ready", {}, degradedEnv, ctx);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.d1.ok).toBe(false);
    expect(body.checks.d1.error).toBeDefined();

    fetchSpy.mockRestore();
  });

  it("GET /ready returns 503 when playground is unreachable", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("fetch failed"));

    const res = await app.request("/ready", {}, env, ctx);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.playground.ok).toBe(false);
    expect(body.checks.playground.error).toBeDefined();

    fetchSpy.mockRestore();
  });

  it("GET /ready returns 503 when playground returns non-200", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("Service Unavailable", { status: 503 }));

    const res = await app.request("/ready", {}, env, ctx);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.playground.ok).toBe(false);
    expect(body.checks.playground.error).toContain("503");

    fetchSpy.mockRestore();
  });
});
