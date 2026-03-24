/**
 * Health route tests
 */

import { describe, it, expect } from "vitest";
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
