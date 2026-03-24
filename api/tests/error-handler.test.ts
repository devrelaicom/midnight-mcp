/**
 * Global error handler and CORS tests
 */

import { describe, it, expect } from "vitest";
import app from "../src/index";
import { createMockBindings, createMockExecutionCtx } from "./helpers/mock-bindings";

const ctx = createMockExecutionCtx();

describe("Global error handler", () => {
  it("returns 404 for unknown routes", async () => {
    const env = createMockBindings();
    const res = await app.request("/nonexistent-route", {}, env, ctx);
    expect(res.status).toBe(404);
  });

  it("CORS headers are present on public routes", async () => {
    const env = createMockBindings();
    const res = await app.request("/health", {}, env, ctx);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("CORS allows configurable origins", async () => {
    const env = createMockBindings({
      CORS_ORIGINS: "https://example.com" as unknown as string,
    });
    const res = await app.request(
      "/health",
      { headers: { Origin: "https://example.com" } },
      env,
      ctx,
    );
    expect(res.headers.get("access-control-allow-origin")).toBe("https://example.com");
  });
});
