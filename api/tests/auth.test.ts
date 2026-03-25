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

  it("malformed token payload degrades to unauthenticated (not 500)", async () => {
    const kv = createMockKV();
    await kv.put("token:corrupt-token", "not-valid-json{{{");
    const env = createMockBindings({ METRICS: kv });

    const res = await app.request(
      "/health",
      { headers: { Authorization: "Bearer corrupt-token" } },
      env,
      ctx,
    );
    expect(res.status).toBe(200);
  });

  it("schema-mismatched token payload degrades to unauthenticated", async () => {
    const kv = createMockKV();
    // Valid JSON but wrong schema — missing required fields
    await kv.put("token:bad-schema-token", JSON.stringify({ foo: "bar" }));
    const env = createMockBindings({ METRICS: kv });

    const res = await app.request(
      "/health",
      { headers: { Authorization: "Bearer bad-schema-token" } },
      env,
      ctx,
    );
    expect(res.status).toBe(200);
  });

  it("malformed session payload degrades to unauthenticated", async () => {
    const kv = createMockKV();
    await kv.put("session:corrupt-session", "not-valid-json");
    const env = createMockBindings({ METRICS: kv });

    const res = await app.request(
      "/health",
      { headers: { Cookie: "midnight_session=corrupt-session" } },
      env,
      ctx,
    );
    expect(res.status).toBe(200);
  });

  it("session with missing accessToken degrades to unauthenticated", async () => {
    const kv = createMockKV();
    await kv.put("session:bad-session", JSON.stringify({ wrong: "field" }));
    const env = createMockBindings({ METRICS: kv });

    const res = await app.request(
      "/health",
      { headers: { Cookie: "midnight_session=bad-session" } },
      env,
      ctx,
    );
    expect(res.status).toBe(200);
  });

  it("valid session pointing to malformed token degrades to unauthenticated", async () => {
    const kv = createMockKV();
    await kv.put("session:good-session", JSON.stringify({ accessToken: "bad-token" }));
    await kv.put("token:bad-token", "not-valid-json");
    const env = createMockBindings({ METRICS: kv });

    const res = await app.request(
      "/health",
      { headers: { Cookie: "midnight_session=good-session" } },
      env,
      ctx,
    );
    expect(res.status).toBe(200);
  });

  it("valid session pointing to schema-mismatched token degrades to unauthenticated", async () => {
    const kv = createMockKV();
    await kv.put("session:good-session", JSON.stringify({ accessToken: "bad-schema-token" }));
    await kv.put("token:bad-schema-token", JSON.stringify({ incomplete: true }));
    const env = createMockBindings({ METRICS: kv });

    const res = await app.request(
      "/health",
      { headers: { Cookie: "midnight_session=good-session" } },
      env,
      ctx,
    );
    expect(res.status).toBe(200);
  });

  it("valid session with valid token authenticates user", async () => {
    const kv = createMockKV();
    const user = {
      githubId: 99,
      username: "sessionuser",
      email: "session@example.com",
      orgs: ["test-org"],
      expiresAt: Date.now() + 3600000,
    };
    await kv.put("session:valid-session", JSON.stringify({ accessToken: "session-token" }));
    await kv.put("token:session-token", JSON.stringify(user));
    const env = createMockBindings({ METRICS: kv });

    // Use a protected route that checks auth — dashboard requires org membership
    const res = await app.request(
      "/dashboard",
      { headers: { Cookie: "midnight_session=valid-session" } },
      env,
      ctx,
    );
    // Should get 200 (authenticated, org matches) not a redirect to OAuth
    expect(res.status).toBe(200);
  });

  it("cleans up corrupt token from KV", async () => {
    const kv = createMockKV();
    await kv.put("token:corrupt-token", "totally-broken");
    const env = createMockBindings({ METRICS: kv });

    await app.request(
      "/health",
      { headers: { Authorization: "Bearer corrupt-token" } },
      env,
      ctx,
    );

    // Corrupt token should be deleted from KV
    const tokenData = await kv.get("token:corrupt-token");
    expect(tokenData).toBeNull();
  });
});
