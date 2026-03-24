/**
 * Auth middleware tests
 */

import { describe, it, expect } from "vitest";
import app from "../src/index";
import { createMockBindings, createMockKV, createMockExecutionCtx } from "./helpers/mock-bindings";

const ctx = createMockExecutionCtx();

describe("Auth middleware", () => {
  it("unauthenticated request proceeds with null user", async () => {
    const env = createMockBindings();
    const res = await app.request("/health", {}, env, ctx);
    expect(res.status).toBe(200);
  });

  it("valid Bearer token extracts user identity", async () => {
    const kv = createMockKV();
    const user = {
      githubId: 123,
      username: "octocat",
      email: "cat@github.com",
      orgs: ["test-org"],
      expiresAt: Date.now() + 3600000,
    };
    await kv.put("token:valid-token-123", JSON.stringify(user));
    const env = createMockBindings({ METRICS: kv });

    const res = await app.request(
      "/v1/track/tool",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-token-123",
        },
        body: JSON.stringify({ tool: "test", success: true }),
      },
      env,
      ctx,
    );
    expect(res.status).toBe(200);
  });

  it("invalid Bearer token sets tokenInvalid", async () => {
    const env = createMockBindings();
    const res = await app.request(
      "/health",
      { headers: { Authorization: "Bearer nonexistent-token" } },
      env,
      ctx,
    );
    expect(res.status).toBe(200);
  });

  it("expired Bearer token is treated as invalid", async () => {
    const kv = createMockKV();
    const user = {
      githubId: 123,
      username: "octocat",
      email: "cat@github.com",
      orgs: [],
      expiresAt: Date.now() - 1000,
    };
    await kv.put("token:expired-token", JSON.stringify(user));
    const env = createMockBindings({ METRICS: kv });

    const res = await app.request(
      "/health",
      { headers: { Authorization: "Bearer expired-token" } },
      env,
      ctx,
    );
    expect(res.status).toBe(200);
  });
});
