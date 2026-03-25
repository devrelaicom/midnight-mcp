/**
 * Tool tracking route tests
 */

import { describe, it, expect } from "vitest";
import app from "../src/index";
import { createMockBindings, createMockExecutionCtx } from "./helpers/mock-bindings";

const env = createMockBindings();
const ctx = createMockExecutionCtx();

describe("Track routes", () => {
  it("POST /v1/track/tool with valid body returns 200", async () => {
    const res = await app.request(
      "/v1/track/tool",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "midnight-search-compact", success: true, durationMs: 42 }),
      },
      env,
      ctx,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("tracked", true);
  });

  it("POST /v1/track/tool with missing tool name returns 400", async () => {
    const res = await app.request(
      "/v1/track/tool",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true }),
      },
      env,
      ctx,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("POST /v1/track/tool truncates oversized tool name", async () => {
    const longTool = "a".repeat(200);
    const res = await app.request(
      "/v1/track/tool",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: longTool, success: true }),
      },
      env,
      ctx,
    );
    // Should still succeed — tool name is truncated to 100 chars internally
    expect(res.status).toBe(200);
  });

  it("POST /v1/track/tool filters invalid durationMs", async () => {
    const res = await app.request(
      "/v1/track/tool",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "test", success: true, durationMs: -1 }),
      },
      env,
      ctx,
    );
    expect(res.status).toBe(200);
  });
});
