/**
 * OAuth and dashboard route-flow tests.
 * Verifies client registration, authorize, callback, token exchange,
 * dashboard session creation, org gating, and logout flows.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "../src/index";
import { createMockBindings, createMockKV, createMockExecutionCtx } from "./helpers/mock-bindings";

// Mock GitHub API calls in the OAuth service
vi.mock("../src/services/oauth", async (importOriginal) => {
  const real = await importOriginal<typeof import("../src/services/oauth")>();
  return {
    ...real,
    exchangeCodeWithGitHub: vi.fn(async () => "mock-github-token"),
    getGitHubUser: vi.fn(async () => ({ id: 42, login: "testuser", email: "test@example.com" })),
    getGitHubOrgs: vi.fn(async () => ["test-org", "another-org"]),
  };
});

function jsonPost(path: string, body: Record<string, unknown>, env: ReturnType<typeof createMockBindings>) {
  return app.request(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    env,
    createMockExecutionCtx(),
  );
}

function get(path: string, env: ReturnType<typeof createMockBindings>, headers?: Record<string, string>) {
  return app.request(path, { headers }, env, createMockExecutionCtx());
}

function formPost(path: string, body: Record<string, string>, env: ReturnType<typeof createMockBindings>) {
  const formBody = new URLSearchParams(body).toString();
  return app.request(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody,
    },
    env,
    createMockExecutionCtx(),
  );
}

// ============================================================================
// OAuth /register
// ============================================================================

describe("POST /oauth/register", () => {
  let env: ReturnType<typeof createMockBindings>;

  beforeEach(() => {
    env = createMockBindings();
  });

  it("registers a valid client and returns client_id", async () => {
    const res = await jsonPost("/oauth/register", {
      redirect_uris: ["http://localhost:3000/callback"],
      client_name: "Test MCP Client",
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.client_id).toBeDefined();
    expect(body.client_name).toBe("Test MCP Client");
    expect(body.redirect_uris).toEqual(["http://localhost:3000/callback"]);
  });

  it("rejects when redirect_uris is missing", async () => {
    const res = await jsonPost("/oauth/register", { client_name: "Test" }, env);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("redirect_uris");
  });

  it("rejects when client_name is missing", async () => {
    const res = await jsonPost("/oauth/register", {
      redirect_uris: ["http://localhost:3000/callback"],
    }, env);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("client_name");
  });

  it("rejects non-localhost http redirect URIs", async () => {
    const res = await jsonPost("/oauth/register", {
      redirect_uris: ["http://evil.com/callback"],
      client_name: "Test",
    }, env);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid redirect_uri");
  });

  it("accepts https redirect URIs", async () => {
    const res = await jsonPost("/oauth/register", {
      redirect_uris: ["https://myapp.com/callback"],
      client_name: "HTTPS App",
    }, env);
    expect(res.status).toBe(200);
  });
});

// ============================================================================
// OAuth /authorize
// ============================================================================

describe("GET /oauth/authorize", () => {
  let env: ReturnType<typeof createMockBindings>;
  let kv: KVNamespace;

  beforeEach(async () => {
    kv = createMockKV();
    // Pre-register a client
    await kv.put("client:test-client-id", JSON.stringify({
      clientName: "Test Client",
      redirectUris: ["http://localhost:3000/callback"],
    }));
    env = createMockBindings({ METRICS: kv });
  });

  it("redirects to GitHub OAuth with valid parameters", async () => {
    const res = await get(
      "/oauth/authorize?response_type=code&client_id=test-client-id&redirect_uri=http://localhost:3000/callback&code_challenge=abc123&code_challenge_method=S256",
      env,
    );
    expect(res.status).toBe(302);
    const location = res.headers.get("location");
    expect(location).toContain("github.com/login/oauth/authorize");
  });

  it("rejects missing client_id", async () => {
    const res = await get(
      "/oauth/authorize?response_type=code&redirect_uri=http://localhost:3000/callback&code_challenge=abc&code_challenge_method=S256",
      env,
    );
    expect(res.status).toBe(400);
  });

  it("rejects missing code_challenge (PKCE required)", async () => {
    const res = await get(
      "/oauth/authorize?response_type=code&client_id=test-client-id&redirect_uri=http://localhost:3000/callback&code_challenge_method=S256",
      env,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error_description).toContain("code_challenge");
  });

  it("rejects non-S256 code_challenge_method", async () => {
    const res = await get(
      "/oauth/authorize?response_type=code&client_id=test-client-id&redirect_uri=http://localhost:3000/callback&code_challenge=abc&code_challenge_method=plain",
      env,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error_description).toContain("S256");
  });

  it("rejects unregistered redirect_uri", async () => {
    const res = await get(
      "/oauth/authorize?response_type=code&client_id=test-client-id&redirect_uri=http://localhost:9999/evil&code_challenge=abc&code_challenge_method=S256",
      env,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("redirect_uri");
  });

  it("rejects unknown client_id", async () => {
    const res = await get(
      "/oauth/authorize?response_type=code&client_id=nonexistent&redirect_uri=http://localhost:3000/callback&code_challenge=abc&code_challenge_method=S256",
      env,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Unknown client_id");
  });

  it("stores state in KV with code_challenge data", async () => {
    const res = await get(
      "/oauth/authorize?response_type=code&client_id=test-client-id&redirect_uri=http://localhost:3000/callback&code_challenge=test-challenge&code_challenge_method=S256",
      env,
    );
    expect(res.status).toBe(302);
    // The state parameter in the GitHub redirect URL should have a corresponding KV entry
    const location = res.headers.get("location")!;
    const url = new URL(location);
    const state = url.searchParams.get("state");
    expect(state).toBeDefined();
    const stateData = await kv.get(`state:${state}`);
    expect(stateData).not.toBeNull();
    const parsed = JSON.parse(stateData!);
    expect(parsed.codeChallenge).toBe("test-challenge");
    expect(parsed.redirectUri).toBe("http://localhost:3000/callback");
  });
});

// ============================================================================
// OAuth /callback
// ============================================================================

describe("GET /oauth/callback", () => {
  let env: ReturnType<typeof createMockBindings>;
  let kv: KVNamespace;

  beforeEach(async () => {
    kv = createMockKV();
    // Pre-store state for callback
    await kv.put("state:valid-state", JSON.stringify({
      codeChallenge: "test-challenge",
      redirectUri: "http://localhost:3000/callback",
      clientId: "test-client-id",
      clientState: "user-state-123",
    }));
    env = createMockBindings({ METRICS: kv });
  });

  it("exchanges code and redirects with auth code", async () => {
    const res = await get("/oauth/callback?code=github-code&state=valid-state", env);
    expect(res.status).toBe(302);
    const location = res.headers.get("location")!;
    expect(location).toContain("localhost:3000/callback");
    expect(location).toContain("code=");
    expect(location).toContain("state=user-state-123");
  });

  it("stores auth code in KV with user data", async () => {
    const res = await get("/oauth/callback?code=github-code&state=valid-state", env);
    expect(res.status).toBe(302);
    const location = res.headers.get("location")!;
    const url = new URL(location);
    const authCode = url.searchParams.get("code")!;
    const codeData = await kv.get(`code:${authCode}`);
    expect(codeData).not.toBeNull();
    const parsed = JSON.parse(codeData!);
    expect(parsed.user.username).toBe("testuser");
    expect(parsed.user.orgs).toEqual(["test-org", "another-org"]);
  });

  it("deletes state from KV after use (prevents reuse)", async () => {
    await get("/oauth/callback?code=github-code&state=valid-state", env);
    const stateData = await kv.get("state:valid-state");
    expect(stateData).toBeNull();
  });

  it("rejects missing code parameter", async () => {
    const res = await get("/oauth/callback?state=valid-state", env);
    expect(res.status).toBe(400);
  });

  it("rejects invalid state parameter", async () => {
    const res = await get("/oauth/callback?code=github-code&state=invalid-state", env);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid or expired state");
  });
});

// ============================================================================
// OAuth /token
// ============================================================================

describe("POST /oauth/token", () => {
  let env: ReturnType<typeof createMockBindings>;
  let kv: KVNamespace;
  const codeVerifier = "test-code-verifier-value-at-least-43-characters-long";

  beforeEach(async () => {
    kv = createMockKV();
    // Compute the expected S256 challenge from the verifier
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
    const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    await kv.put("code:valid-auth-code", JSON.stringify({
      user: { githubId: 42, username: "testuser", email: "test@example.com", orgs: ["test-org"], expiresAt: Date.now() + 86400000 },
      codeChallenge,
      redirectUri: "http://localhost:3000/callback",
      clientId: "test-client-id",
    }));
    env = createMockBindings({ METRICS: kv });
  });

  it("exchanges valid code for access token", async () => {
    const res = await formPost("/oauth/token", {
      grant_type: "authorization_code",
      code: "valid-auth-code",
      client_id: "test-client-id",
      redirect_uri: "http://localhost:3000/callback",
      code_verifier: codeVerifier,
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.access_token).toBeDefined();
    expect(body.token_type).toBe("Bearer");
    expect(body.expires_in).toBe(86400);
  });

  it("stores token in KV with user data", async () => {
    const res = await formPost("/oauth/token", {
      grant_type: "authorization_code",
      code: "valid-auth-code",
      client_id: "test-client-id",
      redirect_uri: "http://localhost:3000/callback",
      code_verifier: codeVerifier,
    }, env);

    const body = await res.json();
    const tokenData = await kv.get(`token:${body.access_token}`);
    expect(tokenData).not.toBeNull();
    const parsed = JSON.parse(tokenData!);
    expect(parsed.username).toBe("testuser");
  });

  it("deletes auth code after exchange (prevents reuse)", async () => {
    await formPost("/oauth/token", {
      grant_type: "authorization_code",
      code: "valid-auth-code",
      client_id: "test-client-id",
      redirect_uri: "http://localhost:3000/callback",
      code_verifier: codeVerifier,
    }, env);

    const codeData = await kv.get("code:valid-auth-code");
    expect(codeData).toBeNull();
  });

  it("rejects unsupported grant_type", async () => {
    const res = await formPost("/oauth/token", {
      grant_type: "client_credentials",
      code: "valid-auth-code",
      client_id: "test-client-id",
      redirect_uri: "http://localhost:3000/callback",
      code_verifier: codeVerifier,
    }, env);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("unsupported_grant_type");
  });

  it("rejects invalid auth code", async () => {
    const res = await formPost("/oauth/token", {
      grant_type: "authorization_code",
      code: "nonexistent-code",
      client_id: "test-client-id",
      redirect_uri: "http://localhost:3000/callback",
      code_verifier: codeVerifier,
    }, env);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_grant");
  });

  it("rejects redirect_uri mismatch", async () => {
    const res = await formPost("/oauth/token", {
      grant_type: "authorization_code",
      code: "valid-auth-code",
      client_id: "test-client-id",
      redirect_uri: "http://localhost:9999/wrong",
      code_verifier: codeVerifier,
    }, env);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_grant");
  });

  it("rejects missing code_verifier (PKCE required)", async () => {
    const res = await formPost("/oauth/token", {
      grant_type: "authorization_code",
      code: "valid-auth-code",
      client_id: "test-client-id",
      redirect_uri: "http://localhost:3000/callback",
    }, env);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error_description).toContain("code_verifier");
  });

  it("rejects wrong code_verifier (PKCE mismatch)", async () => {
    const res = await formPost("/oauth/token", {
      grant_type: "authorization_code",
      code: "valid-auth-code",
      client_id: "test-client-id",
      redirect_uri: "http://localhost:3000/callback",
      code_verifier: "wrong-verifier-that-does-not-match-the-challenge-at-all",
    }, env);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_grant");
  });
});

// ============================================================================
// OAuth /logout
// ============================================================================

describe("GET /oauth/logout", () => {
  it("clears session and token from KV and redirects", async () => {
    const kv = createMockKV();
    await kv.put("token:user-access-token", JSON.stringify({ username: "testuser" }));
    await kv.put("session:session-123", JSON.stringify({ accessToken: "user-access-token" }));
    const env = createMockBindings({ METRICS: kv });

    const res = await app.request(
      "/oauth/logout",
      { headers: { Cookie: "midnight_session=session-123" } },
      env,
      createMockExecutionCtx(),
    );

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/");

    // Verify KV cleanup
    const tokenData = await kv.get("token:user-access-token");
    expect(tokenData).toBeNull();
    const sessionData = await kv.get("session:session-123");
    expect(sessionData).toBeNull();

    // Verify cookie cleared
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("Max-Age=0");
  });
});

// ============================================================================
// Dashboard
// ============================================================================

describe("GET /dashboard", () => {
  it("redirects unauthenticated users to OAuth authorize", async () => {
    const env = createMockBindings();
    const res = await get("/dashboard", env);

    expect(res.status).toBe(302);
    const location = res.headers.get("location")!;
    expect(location).toContain("/oauth/authorize");
    expect(location).toContain("client_id=dashboard-internal");
    expect(location).toContain("code_challenge");
  });

  it("denies access to users outside allowed orgs", async () => {
    const kv = createMockKV();
    const user = {
      githubId: 42,
      username: "outsider",
      email: "outsider@example.com",
      orgs: ["wrong-org"],
      expiresAt: Date.now() + 86400000,
    };
    await kv.put("token:outsider-token", JSON.stringify(user));
    const env = createMockBindings({ METRICS: kv });

    const res = await app.request(
      "/dashboard",
      { headers: { Authorization: "Bearer outsider-token" } },
      env,
      createMockExecutionCtx(),
    );

    expect(res.status).toBe(403);
    const text = await res.text();
    expect(text).toContain("Access denied");
  });

  it("allows access for users in allowed orgs", async () => {
    const kv = createMockKV();
    const user = {
      githubId: 42,
      username: "member",
      email: "member@example.com",
      orgs: ["test-org"],
      expiresAt: Date.now() + 86400000,
    };
    await kv.put("token:member-token", JSON.stringify(user));
    const env = createMockBindings({ METRICS: kv });

    const res = await app.request(
      "/dashboard",
      { headers: { Authorization: "Bearer member-token" } },
      env,
      createMockExecutionCtx(),
    );

    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("html");
  });

  it("exchanges auth code and creates session via KV (authenticated)", async () => {
    const kv = createMockKV();
    const user = {
      githubId: 42,
      username: "testuser",
      email: "test@example.com",
      orgs: ["test-org"],
      expiresAt: Date.now() + 86400000,
    };
    // Pre-store an auth code for the dashboard client
    await kv.put("code:dashboard-auth-code", JSON.stringify({
      user,
      clientId: "dashboard-internal",
      redirectUri: "http://localhost/dashboard",
    }));
    // Also need a valid token for the auth middleware to pass
    await kv.put("token:existing-token", JSON.stringify(user));
    const env = createMockBindings({ METRICS: kv });

    const res = await app.request(
      "/dashboard?code=dashboard-auth-code",
      { headers: { Authorization: "Bearer existing-token" } },
      env,
      createMockExecutionCtx(),
    );

    // Should redirect to clean dashboard URL after session creation
    expect(res.status).toBe(302);
    const location = res.headers.get("location")!;
    expect(location).toContain("/dashboard");
    expect(location).not.toContain("code=");

    // Verify auth code was consumed
    const codeData = await kv.get("code:dashboard-auth-code");
    expect(codeData).toBeNull();

    // Verify session cookie was set
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("midnight_session=");
  });

  it("unauthenticated OAuth callback exchanges code and creates session (first-time login)", async () => {
    const kv = createMockKV();
    const user = {
      githubId: 42,
      username: "newuser",
      email: "new@example.com",
      orgs: ["test-org"],
      expiresAt: Date.now() + 86400000,
    };
    await kv.put("code:first-login-code", JSON.stringify({
      user,
      clientId: "dashboard-internal",
      redirectUri: "http://localhost/dashboard",
    }));
    const env = createMockBindings({ METRICS: kv });

    // No Authorization header — simulates the real first-time login callback
    const res = await app.request(
      "/dashboard?code=first-login-code",
      {},
      env,
      createMockExecutionCtx(),
    );

    // Should consume the code and redirect with a session cookie
    expect(res.status).toBe(302);
    const location = res.headers.get("location")!;
    expect(location).toContain("/dashboard");
    expect(location).not.toContain("code=");

    // Verify auth code was consumed
    const codeData = await kv.get("code:first-login-code");
    expect(codeData).toBeNull();

    // Verify session cookie was set
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("midnight_session=");
  });
});
