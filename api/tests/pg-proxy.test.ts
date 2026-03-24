/**
 * Playground proxy route tests
 */

import { describe, it, expect } from "vitest";
import app from "../src/index";
import { createMockBindings, createMockExecutionCtx } from "./helpers/mock-bindings";

const env = createMockBindings();
const ctx = createMockExecutionCtx();

describe("Playground proxy routes", () => {
  it("rejects simulate IDs with path traversal characters", async () => {
    const res = await app.request(
      "/pg/simulate/../../../etc/passwd/call",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ circuit: "test" }),
      },
      env,
      ctx,
    );
    // Should be 400 (invalid param) or 404 (route not matched)
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("rejects simulate IDs with special characters", async () => {
    const res = await app.request(
      "/pg/simulate/abc%3Brm/call",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ circuit: "test" }),
      },
      env,
      ctx,
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("allows valid alphanumeric simulate IDs", async () => {
    const res = await app.request("/pg/simulate/abc-123_def/state", {}, env, ctx);
    // Will get 503 since the mock playground URL doesn't resolve
    // but should NOT be 400 (the ID format is valid)
    // Should not be 400 — the ID format is valid; any other status is fine
    // (network errors from mock URL produce 503)
    expect(res.status).not.toBe(400);
  });
});
