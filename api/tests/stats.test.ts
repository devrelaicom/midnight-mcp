/**
 * Stats route tests — validates privacy: only aggregate metrics, no raw queries
 */

import { describe, it, expect } from "vitest";
import app from "../src/index";
import { createMockBindings, createMockExecutionCtx } from "./helpers/mock-bindings";

const env = createMockBindings();
const ctx = createMockExecutionCtx();

describe("Stats routes", () => {
  it("GET /v1/stats returns aggregate metrics", async () => {
    const res = await app.request("/v1/stats", {}, env, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("service", "midnight-mcp-api");
    expect(body).toHaveProperty("metrics");
  });

  it("GET /v1/stats response does not contain raw queries", async () => {
    const res = await app.request("/v1/stats", {}, env, ctx);
    const body = await res.json();
    const text = JSON.stringify(body);
    expect(text).not.toContain("recentQueries");
    expect(text).not.toContain("rawQueries");
  });
});
