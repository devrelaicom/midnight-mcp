# API Auth, Rate Limiting, and Caching Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add GitHub OAuth 2.1 with PKCE, tiered rate limiting, embedding cache, and request size limits to the Cloudflare Workers API.

**Architecture:** Self-managed OAuth 2.1 server in a Hono Worker, using Cloudflare KV for session/token/cache storage and Workers rate limit bindings for tiered rate limiting. Dashboard access restricted to GitHub org members.

**Tech Stack:** Hono, Cloudflare Workers, Cloudflare KV, Cloudflare Workers Rate Limiting, GitHub OAuth API

**Spec:** `docs/superpowers/specs/2026-03-10-api-auth-rate-limiting-design.md`

---

## Chunk 1: Foundation (Types, Config, Body Limit)

### Task 1: Update Bindings interface and wrangler.toml

**Files:**
- Modify: `api/src/interfaces/index.ts:7-13`
- Modify: `api/wrangler.toml`

- [ ] **Step 1: Add new bindings to the `Bindings` type**

In `api/src/interfaces/index.ts`, replace the existing `Bindings` type:

```typescript
export type Bindings = {
  // Existing
  VECTORIZE: VectorizeIndex;
  OPENAI_API_KEY: string;
  ENVIRONMENT: string;
  METRICS: KVNamespace;
  // Auth
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  DASHBOARD_ALLOWED_ORGS: string;
  // Rate limiting
  RATE_LIMIT_ANON: RateLimit;
  RATE_LIMIT_AUTH: RateLimit;
  // Caching
  EMBEDDING_CACHE: KVNamespace;
};
```

Note: Remove `DASHBOARD_PASSWORD?: string` — it is deleted by this design.

- [ ] **Step 2: Add an `AuthUser` interface**

In the same file, add below the `Bindings` type:

```typescript
export interface AuthUser {
  githubId: number;
  username: string;
  email: string;
  orgs: string[];
  expiresAt: number;
}

export interface AuthState {
  user: AuthUser | null;
  tokenInvalid: boolean;
}
```

- [ ] **Step 3: Update wrangler.toml**

Replace the commented-out rate limiting section and add the embedding cache KV namespace in `api/wrangler.toml`:

```toml
name = "midnight-mcp-api"
main = "src/index.ts"
compatibility_date = "2024-12-01"

[vars]
ENVIRONMENT = "production"

# Vectorize index for semantic search
[[vectorize]]
binding = "VECTORIZE"
index_name = "midnight-code"

# KV namespace for metrics storage
[[kv_namespaces]]
binding = "METRICS"
id = "adc06e61998c417684ee353791077992"

# KV namespace for embedding cache
[[kv_namespaces]]
binding = "EMBEDDING_CACHE"
id = "REPLACE_WITH_ACTUAL_KV_NAMESPACE_ID"

# Rate limiting — anonymous users
[[unsafe.bindings]]
name = "RATE_LIMIT_ANON"
type = "ratelimit"
namespace_id = "1001"
simple = { limit = 10, period = 60 }

# Rate limiting — authenticated users
[[unsafe.bindings]]
name = "RATE_LIMIT_AUTH"
type = "ratelimit"
namespace_id = "1002"
simple = { limit = 60, period = 60 }
```

Note: The `EMBEDDING_CACHE` KV namespace ID must be created via `wrangler kv namespace create EMBEDDING_CACHE` and the output ID pasted into `wrangler.toml` before deploying. Leave the placeholder for now.

- [ ] **Step 4: Commit**

```bash
cd api && git add src/interfaces/index.ts wrangler.toml
git commit -m "feat(api): update bindings for auth, rate limiting, and embedding cache"
```

---

### Task 2: Body limit middleware

**Files:**
- Create: `api/src/middleware/body-limit.ts`

- [ ] **Step 1: Create the body limit middleware**

```typescript
/**
 * Request body size limit middleware.
 * Rejects requests with Content-Length > 1MB before parsing.
 */

import type { MiddlewareHandler } from "hono";
import type { Bindings } from "../interfaces";

const MAX_BODY_SIZE = 1_048_576; // 1MB

export const bodyLimit: MiddlewareHandler<{ Bindings: Bindings }> = async (
  c,
  next
) => {
  const contentLength = parseInt(c.req.header("content-length") || "0", 10);
  if (contentLength > MAX_BODY_SIZE) {
    return c.json(
      { error: "Request body too large. Maximum size is 1MB." },
      413
    );
  }
  await next();
};
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware/body-limit.ts
git commit -m "feat(api): add body limit middleware (1MB)"
```

---

## Chunk 2: OAuth 2.1 Implementation

### Task 3: OAuth utilities — crypto helpers and GitHub API client

**Files:**
- Create: `api/src/services/oauth.ts`

- [ ] **Step 1: Create OAuth utility functions**

This file contains: random token generation, PKCE S256 verification, and GitHub API calls for user profile and org membership.

```typescript
/**
 * OAuth utility functions.
 * Handles token generation, PKCE verification, and GitHub API calls.
 */

/**
 * Generate a cryptographically random hex string.
 */
export function generateToken(bytes = 32): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generate a UUID v4 for client IDs.
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Verify a PKCE code_verifier against a stored code_challenge (S256 method).
 * Returns true if the verifier hashes to the challenge.
 */
export async function verifyPKCE(
  codeVerifier: string,
  codeChallenge: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return base64 === codeChallenge;
}

/**
 * Exchange an authorization code with GitHub for an access token.
 */
export async function exchangeCodeWithGitHub(
  code: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub token exchange failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (data.error || !data.access_token) {
    throw new Error(
      data.error_description || data.error || "GitHub token exchange failed"
    );
  }

  return data.access_token;
}

/**
 * Fetch the authenticated GitHub user's profile.
 */
export async function getGitHubUser(
  accessToken: string
): Promise<{ id: number; login: string; email: string }> {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "midnight-mcp-api",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub user fetch failed: ${response.status}`);
  }

  const user = (await response.json()) as {
    id: number;
    login: string;
    email: string | null;
  };

  // If email is null (private), try the emails endpoint
  let email = user.email || "";
  if (!email) {
    try {
      const emailsResponse = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "midnight-mcp-api",
        },
      });
      if (emailsResponse.ok) {
        const emails = (await emailsResponse.json()) as Array<{
          email: string;
          primary: boolean;
        }>;
        const primary = emails.find((e) => e.primary);
        email = primary?.email || emails[0]?.email || "";
      }
    } catch {
      // Non-critical, proceed without email
    }
  }

  return { id: user.id, login: user.login, email };
}

/**
 * Fetch the authenticated GitHub user's organization memberships.
 */
export async function getGitHubOrgs(
  accessToken: string
): Promise<string[]> {
  const response = await fetch("https://api.github.com/user/orgs", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "midnight-mcp-api",
    },
  });

  if (!response.ok) {
    return []; // Non-critical — user may have no orgs
  }

  const orgs = (await response.json()) as Array<{ login: string }>;
  return orgs.map((o) => o.login);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/oauth.ts
git commit -m "feat(api): add OAuth crypto helpers and GitHub API client"
```

---

### Task 4: OAuth routes

**Files:**
- Create: `api/src/routes/oauth.ts`

- [ ] **Step 1: Create the OAuth routes file**

This is the largest single file. It implements all 6 OAuth endpoints.

```typescript
/**
 * OAuth 2.1 routes with PKCE support.
 * Implements authorization server for GitHub SSO.
 */

import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { Bindings, AuthUser } from "../interfaces";
import {
  generateToken,
  generateUUID,
  verifyPKCE,
  exchangeCodeWithGitHub,
  getGitHubUser,
  getGitHubOrgs,
} from "../services/oauth";

const oauthRoutes = new Hono<{ Bindings: Bindings }>();

// ============================================================================
// Discovery
// ============================================================================

/**
 * OAuth Authorization Server Metadata (RFC 8414).
 * MCP clients fetch this to discover auth endpoints.
 */
oauthRoutes.get("/.well-known/oauth-authorization-server", (c) => {
  const baseUrl = new URL(c.req.url).origin;
  return c.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    registration_endpoint: `${baseUrl}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: [
      "client_secret_post",
      "none",
    ],
  });
});

// ============================================================================
// Dynamic Client Registration
// ============================================================================

oauthRoutes.post("/oauth/register", async (c) => {
  try {
    const body = await c.req.json<{
      redirect_uris?: string[];
      client_name?: string;
    }>();

    if (
      !body.redirect_uris ||
      !Array.isArray(body.redirect_uris) ||
      body.redirect_uris.length === 0
    ) {
      return c.json({ error: "redirect_uris is required" }, 400);
    }

    if (!body.client_name || typeof body.client_name !== "string") {
      return c.json({ error: "client_name is required" }, 400);
    }

    // Validate redirect URIs: must be http://localhost:* or https://*
    for (const uri of body.redirect_uris) {
      try {
        const parsed = new URL(uri);
        const isLocalhost =
          parsed.protocol === "http:" && parsed.hostname === "localhost";
        const isHttps = parsed.protocol === "https:";
        if (!isLocalhost && !isHttps) {
          return c.json(
            {
              error: `Invalid redirect_uri: ${uri}. Must use http://localhost or https://`,
            },
            400
          );
        }
      } catch {
        return c.json({ error: `Invalid redirect_uri: ${uri}` }, 400);
      }
    }

    const clientId = generateUUID();
    const clientSecret = generateToken();

    await c.env.METRICS.put(
      `client:${clientId}`,
      JSON.stringify({
        clientName: body.client_name,
        redirectUris: body.redirect_uris,
        clientSecret,
      }),
      { expirationTtl: 30 * 24 * 60 * 60 } // 30 days
    );

    return c.json({
      client_id: clientId,
      client_secret: clientSecret,
      client_name: body.client_name,
      redirect_uris: body.redirect_uris,
    });
  } catch (error) {
    console.error("Client registration error:", error);
    return c.json({ error: "Registration failed" }, 500);
  }
});

// ============================================================================
// Authorization
// ============================================================================

oauthRoutes.get("/oauth/authorize", async (c) => {
  const clientId = c.req.query("client_id");
  const redirectUri = c.req.query("redirect_uri");
  const codeChallenge = c.req.query("code_challenge");
  const codeChallengeMethod = c.req.query("code_challenge_method");
  const clientState = c.req.query("state");

  if (!clientId || !redirectUri) {
    return c.json({ error: "client_id and redirect_uri are required" }, 400);
  }

  // Validate client registration
  const clientData = await c.env.METRICS.get(`client:${clientId}`);
  if (!clientData) {
    return c.json({ error: "Unknown client_id" }, 400);
  }

  const client = JSON.parse(clientData) as {
    redirectUris: string[];
  };
  if (!client.redirectUris.includes(redirectUri)) {
    return c.json({ error: "redirect_uri not registered for this client" }, 400);
  }

  if (codeChallengeMethod && codeChallengeMethod !== "S256") {
    return c.json(
      { error: "Only S256 code_challenge_method is supported" },
      400
    );
  }

  // Generate state for CSRF protection
  const state = generateToken();
  await c.env.METRICS.put(
    `state:${state}`,
    JSON.stringify({
      codeChallenge: codeChallenge || null,
      redirectUri,
      clientId,
      clientState: clientState || null,
    }),
    { expirationTtl: 300 } // 5 minutes
  );

  // Redirect to GitHub OAuth
  const githubUrl = new URL("https://github.com/login/oauth/authorize");
  githubUrl.searchParams.set("client_id", c.env.GITHUB_CLIENT_ID);
  githubUrl.searchParams.set("redirect_uri", `${new URL(c.req.url).origin}/oauth/callback`);
  githubUrl.searchParams.set("scope", "read:org user:email");
  githubUrl.searchParams.set("state", state);

  return c.redirect(githubUrl.toString());
});

// ============================================================================
// Callback
// ============================================================================

oauthRoutes.get("/oauth/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");

  if (!code || !state) {
    return c.json({ error: "Missing code or state parameter" }, 400);
  }

  // Verify state (CSRF protection) — lookup and delete to prevent reuse
  const stateData = await c.env.METRICS.get(`state:${state}`);
  if (!stateData) {
    return c.json({ error: "Invalid or expired state parameter" }, 400);
  }
  await c.env.METRICS.delete(`state:${state}`);

  const {
    codeChallenge,
    redirectUri,
    clientId,
    clientState,
  } = JSON.parse(stateData) as {
    codeChallenge: string | null;
    redirectUri: string;
    clientId: string;
    clientState: string | null;
  };

  try {
    // Exchange code with GitHub
    const githubAccessToken = await exchangeCodeWithGitHub(
      code,
      c.env.GITHUB_CLIENT_ID,
      c.env.GITHUB_CLIENT_SECRET
    );

    // Fetch user profile and orgs
    const [githubUser, orgs] = await Promise.all([
      getGitHubUser(githubAccessToken),
      getGitHubOrgs(githubAccessToken),
    ]);

    // Generate our own authorization code
    const authCode = generateToken();
    const userData: AuthUser = {
      githubId: githubUser.id,
      username: githubUser.login,
      email: githubUser.email,
      orgs,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24h
    };

    await c.env.METRICS.put(
      `code:${authCode}`,
      JSON.stringify({
        user: userData,
        codeChallenge,
        redirectUri,
        clientId,
      }),
      { expirationTtl: 60 } // 60 seconds
    );

    // Redirect back to client with authorization code
    const callbackUrl = new URL(redirectUri);
    callbackUrl.searchParams.set("code", authCode);
    if (clientState) {
      callbackUrl.searchParams.set("state", clientState);
    }

    return c.redirect(callbackUrl.toString());
  } catch (error) {
    console.error("OAuth callback error:", error);
    return c.json({ error: "Authentication failed" }, 500);
  }
});

// ============================================================================
// Token Exchange
// ============================================================================

oauthRoutes.post("/oauth/token", async (c) => {
  // Parse application/x-www-form-urlencoded body
  const body = await c.req.parseBody();
  const grantType = body["grant_type"] as string | undefined;
  const authCode = body["code"] as string | undefined;
  const clientId = body["client_id"] as string | undefined;
  const redirectUri = body["redirect_uri"] as string | undefined;
  const codeVerifier = body["code_verifier"] as string | undefined;

  if (grantType !== "authorization_code") {
    return c.json({ error: "unsupported_grant_type" }, 400);
  }

  if (!authCode || !clientId || !redirectUri) {
    return c.json({ error: "invalid_request" }, 400);
  }

  // Look up the authorization code
  const codeData = await c.env.METRICS.get(`code:${authCode}`);
  if (!codeData) {
    return c.json({ error: "invalid_grant" }, 400);
  }
  // Delete immediately to prevent reuse
  await c.env.METRICS.delete(`code:${authCode}`);

  const {
    user,
    codeChallenge,
    redirectUri: storedRedirectUri,
    clientId: storedClientId,
  } = JSON.parse(codeData) as {
    user: AuthUser;
    codeChallenge: string | null;
    redirectUri: string;
    clientId: string;
  };

  // Validate client_id and redirect_uri match the original request
  if (clientId !== storedClientId) {
    return c.json({ error: "invalid_grant" }, 400);
  }
  if (redirectUri !== storedRedirectUri) {
    return c.json({ error: "invalid_grant" }, 400);
  }

  // Verify PKCE if a code_challenge was provided during authorization
  if (codeChallenge) {
    if (!codeVerifier) {
      return c.json({ error: "invalid_grant" }, 400);
    }
    const valid = await verifyPKCE(codeVerifier, codeChallenge);
    if (!valid) {
      return c.json({ error: "invalid_grant" }, 400);
    }
  }

  // Generate access token and store session
  const accessToken = generateToken();
  await c.env.METRICS.put(
    `token:${accessToken}`,
    JSON.stringify(user),
    { expirationTtl: 24 * 60 * 60 } // 24 hours
  );

  return c.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 86400,
  });
});

// ============================================================================
// Logout
// ============================================================================

oauthRoutes.get("/oauth/logout", async (c) => {
  const sessionId = getCookie(c, "midnight_session");
  if (sessionId) {
    // Resolve session -> access token, delete both
    const sessionData = await c.env.METRICS.get(`session:${sessionId}`);
    if (sessionData) {
      const { accessToken } = JSON.parse(sessionData) as {
        accessToken: string;
      };
      await c.env.METRICS.delete(`token:${accessToken}`);
      await c.env.METRICS.delete(`session:${sessionId}`);
    }
  }

  // Clear cookie
  c.header(
    "Set-Cookie",
    "midnight_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
  );

  return c.redirect("/");
});

export default oauthRoutes;
```

- [ ] **Step 2: Export from routes barrel**

In `api/src/routes/index.ts`, add:

```typescript
export { default as oauthRoutes } from "./oauth";
```

- [ ] **Step 3: Export `oauth.ts` from services barrel**

In `api/src/services/index.ts`, add:

```typescript
export {
  generateToken,
  generateUUID,
  verifyPKCE,
  exchangeCodeWithGitHub,
  getGitHubUser,
  getGitHubOrgs,
} from "./oauth";
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/oauth.ts src/routes/index.ts src/services/oauth.ts src/services/index.ts
git commit -m "feat(api): implement OAuth 2.1 routes with PKCE and dynamic client registration"
```

---

## Chunk 3: Auth and Rate Limit Middleware

### Task 5: Auth middleware

**Files:**
- Create: `api/src/middleware/auth.ts`

- [ ] **Step 1: Create the auth middleware**

This middleware extracts user identity from either a Bearer token (API) or session cookie (dashboard). It sets the auth state on the Hono context for downstream middleware to use.

```typescript
/**
 * Authentication middleware.
 * Resolves user identity from Bearer token or session cookie.
 * Sets AuthState on context for rate limiting and route handlers.
 */

import type { MiddlewareHandler } from "hono";
import type { Bindings, AuthUser, AuthState } from "../interfaces";

declare module "hono" {
  interface ContextVariableMap {
    authState: AuthState;
  }
}

export const auth: MiddlewareHandler<{ Bindings: Bindings }> = async (
  c,
  next
) => {
  let user: AuthUser | null = null;
  let tokenInvalid = false;

  // Try Bearer token first (API clients)
  const authHeader = c.req.header("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const userData = await c.env.METRICS.get(`token:${token}`);
    if (userData) {
      const parsed = JSON.parse(userData) as AuthUser;
      if (parsed.expiresAt > Date.now()) {
        user = parsed;
      } else {
        tokenInvalid = true;
        // Clean up expired token
        await c.env.METRICS.delete(`token:${token}`);
      }
    } else {
      tokenInvalid = true;
    }
  }

  // Try session cookie (dashboard)
  if (!user && !tokenInvalid) {
    const cookieHeader = c.req.header("cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(
        /(?:^|;\s*)midnight_session=([^;]*)/
      );
      const sessionId = match ? match[1] : undefined;
      if (sessionId) {
        const sessionData = await c.env.METRICS.get(
          `session:${sessionId}`
        );
        if (sessionData) {
          const { accessToken } = JSON.parse(sessionData) as {
            accessToken: string;
          };
          const userData = await c.env.METRICS.get(
            `token:${accessToken}`
          );
          if (userData) {
            const parsed = JSON.parse(userData) as AuthUser;
            if (parsed.expiresAt > Date.now()) {
              user = parsed;
            }
          }
        }
      }
    }
  }

  c.set("authState", { user, tokenInvalid });
  await next();
};
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware/auth.ts
git commit -m "feat(api): add auth middleware for Bearer token and session cookie"
```

---

### Task 6: Rate limit middleware

**Files:**
- Create: `api/src/middleware/rate-limit.ts`

- [ ] **Step 1: Create the rate limit middleware**

```typescript
/**
 * Rate limiting middleware.
 * Selects rate limit tier based on auth state.
 * Anon: 10 req/60s keyed by IP. Auth: 60 req/60s keyed by user ID.
 */

import type { MiddlewareHandler } from "hono";
import type { Bindings, AuthState } from "../interfaces";

export const rateLimit: MiddlewareHandler<{ Bindings: Bindings }> = async (
  c,
  next
) => {
  const authState = c.get("authState") as AuthState;

  let limiter: RateLimit;
  let key: string;

  if (authState.user) {
    limiter = c.env.RATE_LIMIT_AUTH;
    key = `user:${authState.user.githubId}`;
  } else {
    limiter = c.env.RATE_LIMIT_ANON;
    key = `ip:${c.req.header("cf-connecting-ip") || "unknown"}`;
  }

  const { success } = await limiter.limit({ key });
  if (!success) {
    return c.json({ error: "Rate limited", retryAfter: 60 }, 429);
  }

  await next();
};
```

Note: The `RateLimit` type is provided by `@cloudflare/workers-types`. If not available, add a type declaration:

```typescript
interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}
```

- [ ] **Step 2: Create middleware barrel export**

Create `api/src/middleware/index.ts`:

```typescript
export { bodyLimit } from "./body-limit";
export { auth } from "./auth";
export { rateLimit } from "./rate-limit";
```

- [ ] **Step 3: Commit**

```bash
git add src/middleware/rate-limit.ts src/middleware/index.ts
git commit -m "feat(api): add rate limit middleware with tiered auth/anon limits"
```

---

## Chunk 4: Dashboard Auth, Embedding Cache, Search Dedup, Wiring

### Task 7: Dashboard auth rewrite

**Files:**
- Modify: `api/src/routes/dashboard.ts`

- [ ] **Step 1: Replace the dashboard route**

Replace the entire file content of `api/src/routes/dashboard.ts`:

```typescript
/**
 * Dashboard route.
 * Protected by GitHub OAuth — user must be a member of an allowed org.
 */

import { Hono } from "hono";
import type { Bindings, AuthUser, AuthState } from "../interfaces";
import { getMetrics, loadMetrics } from "../services";
import { generateDashboardHtml } from "../templates/dashboard";
import { generateToken } from "../services/oauth";

const dashboardRoute = new Hono<{ Bindings: Bindings }>();

// Dashboard auth middleware
dashboardRoute.use("*", async (c, next) => {
  const allowedOrgs = c.env.DASHBOARD_ALLOWED_ORGS;
  if (!allowedOrgs) {
    return c.text(
      "Dashboard access not configured. Set DASHBOARD_ALLOWED_ORGS environment variable.",
      403
    );
  }

  const authState = c.get("authState") as AuthState;

  if (!authState.user) {
    // Not authenticated — redirect to OAuth flow
    // Create a temporary client registration for the dashboard
    const baseUrl = new URL(c.req.url).origin;
    const redirectUri = `${baseUrl}/dashboard`;

    // Check if dashboard client already exists
    let clientId: string;
    const existingClient = await c.env.METRICS.get("client:dashboard-internal");
    if (existingClient) {
      clientId = "dashboard-internal";
    } else {
      clientId = "dashboard-internal";
      await c.env.METRICS.put(
        `client:${clientId}`,
        JSON.stringify({
          clientName: "Midnight Dashboard",
          redirectUris: [redirectUri],
        }),
        { expirationTtl: 365 * 24 * 60 * 60 } // 1 year
      );
    }

    const authorizeUrl = new URL(`${baseUrl}/oauth/authorize`);
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    return c.redirect(authorizeUrl.toString());
  }

  // Check org membership
  const allowedOrgList = allowedOrgs.split(",").map((o) => o.trim().toLowerCase());
  const userOrgs = authState.user.orgs.map((o) => o.toLowerCase());
  const hasAccess = allowedOrgList.some((org) => userOrgs.includes(org));

  if (!hasAccess) {
    return c.text(
      `Access denied. You must be a member of one of these organizations: ${allowedOrgs}`,
      403
    );
  }

  return next();
});

// Handle OAuth callback code exchange for dashboard.
// NOTE: Cannot use fetch() to call our own Worker (Cloudflare self-fetch limitation).
// Instead, exchange the authorization code directly via KV lookup.
dashboardRoute.get("/", async (c) => {
  const code = c.req.query("code");

  if (code) {
    const baseUrl = new URL(c.req.url).origin;

    // Look up the authorization code directly from KV (no self-fetch)
    const codeData = await c.env.METRICS.get(`code:${code}`);
    if (codeData) {
      await c.env.METRICS.delete(`code:${code}`);
      const { user } = JSON.parse(codeData) as { user: AuthUser };

      // Generate access token
      const accessToken = generateToken();
      await c.env.METRICS.put(
        `token:${accessToken}`,
        JSON.stringify(user),
        { expirationTtl: 24 * 60 * 60 }
      );

      // Create session and set cookie
      const sessionId = generateToken();
      await c.env.METRICS.put(
        `session:${sessionId}`,
        JSON.stringify({ accessToken }),
        { expirationTtl: 24 * 60 * 60 }
      );

      c.header(
        "Set-Cookie",
        `midnight_session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`
      );

      // Redirect to clean URL (strip code param)
      return c.redirect(`${baseUrl}/dashboard`);
    }
  }

  // Render dashboard
  await loadMetrics(c.env.METRICS);
  const metrics = getMetrics();
  const authState = c.get("authState") as AuthState;
  const html = generateDashboardHtml(metrics, authState.user?.username);
  return c.html(html);
});

export default dashboardRoute;
```

- [ ] **Step 2: Update `generateDashboardHtml` signature**

In `api/src/templates/dashboard.ts`, update the function signature to accept an optional username parameter. Find the `generateDashboardHtml` function and add `username?: string` as a second parameter. In the HTML output, add a logged-in indicator and logout link in the header area if username is provided. The exact HTML changes depend on the existing template structure — add something like:

```html
<div style="float: right; color: #aaa;">
  Logged in as @${escapeHtml(username)}
  | <a href="/oauth/logout" style="color: #6cf;">Logout</a>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/dashboard.ts src/templates/dashboard.ts
git commit -m "feat(api): replace dashboard password auth with GitHub OAuth + org check"
```

---

### Task 8: Embedding cache

**Files:**
- Modify: `api/src/services/embeddings.ts`

- [ ] **Step 1: Replace the embeddings service**

Replace the entire file content of `api/src/services/embeddings.ts`:

```typescript
/**
 * OpenAI embeddings service with KV caching.
 * Caches embedding vectors by normalized query hash to avoid redundant API calls.
 */

import type { EmbeddingResponse } from "../interfaces";

/**
 * Normalize a query for consistent cache keys.
 */
function normalizeQuery(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Hash a string using SHA-256, return hex string.
 */
async function hashQuery(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generate embedding using OpenAI API, with KV caching.
 * Cache hit: returns cached vector, skips OpenAI call.
 * Cache miss: calls OpenAI, stores in KV with 24h TTL, returns vector.
 */
export async function getEmbedding(
  text: string,
  apiKey: string,
  cache: KVNamespace
): Promise<number[]> {
  const normalized = normalizeQuery(text);
  const hash = await hashQuery(normalized);
  const cacheKey = `embedding:${hash}`;

  // Try cache first
  const cached = await cache.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as number[];
  }

  // Cache miss — call OpenAI
  const truncatedText = text.slice(0, 8000);

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: truncatedText,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = (await response.json()) as EmbeddingResponse;
  const embedding = data.data[0].embedding;

  // Store in cache with 24h TTL
  await cache.put(cacheKey, JSON.stringify(embedding), {
    expirationTtl: 24 * 60 * 60,
  });

  return embedding;
}
```

- [ ] **Step 2: Update the services barrel export**

The export in `api/src/services/index.ts` stays the same (`export { getEmbedding } from "./embeddings"`) — the function name is unchanged, only the signature changed.

- [ ] **Step 3: Commit**

```bash
git add src/services/embeddings.ts
git commit -m "feat(api): add KV-cached embedding generation"
```

---

### Task 9: Search route deduplication and auth warnings

**Files:**
- Modify: `api/src/routes/search.ts`

- [ ] **Step 1: Replace the search routes file**

Replace the entire file content of `api/src/routes/search.ts`:

```typescript
/**
 * Search API routes.
 * Deduplicated into a shared handler with per-endpoint filters.
 */

import { Hono, type Context } from "hono";
import type { Bindings, SearchRequestBody, AuthState } from "../interfaces";
import {
  getEmbedding,
  trackQuery,
  persistMetrics,
  loadMetrics,
} from "../services";
import {
  validateQuery,
  validateLimit,
  formatResults,
  applyKeywordBoost,
} from "../utils";

const searchRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * Shared search handler.
 * Encapsulates: metrics, validation, cached embedding, Vectorize query,
 * keyword boost, tracking, and response formatting.
 */
async function handleSearch(
  c: Context<{ Bindings: Bindings }>,
  filter: Record<string, string> | undefined,
  endpoint: string
): Promise<Response> {
  try {
    await loadMetrics(c.env.METRICS);

    const body = await c.req.json<SearchRequestBody>();

    const query = validateQuery(body.query);
    if (!query) {
      return c.json({ error: "query is required (1-1000 chars)" }, 400);
    }

    const limit = validateLimit(body.limit);
    const embedding = await getEmbedding(
      query,
      c.env.OPENAI_API_KEY,
      c.env.EMBEDDING_CACHE
    );

    const resolvedFilter =
      filter ??
      (body.filter?.language ? { language: body.filter.language } : undefined);

    const results = await c.env.VECTORIZE.query(embedding, {
      topK: limit,
      returnMetadata: "all",
      filter: resolvedFilter,
    });

    const boostedMatches = applyKeywordBoost(results.matches, query);
    trackQuery(query, endpoint, boostedMatches, filter?.language);
    await persistMetrics(c.env.METRICS);

    const response = formatResults(boostedMatches, query);

    // Add warning if token was invalid (downgraded to anon rate limit)
    const authState = c.get("authState") as AuthState;
    if (authState.tokenInvalid) {
      return c.json({
        ...response,
        warnings: [
          "Your access token is invalid or expired. You are being rate limited as an anonymous user (10 req/min). Re-authenticate via /mcp to restore your full rate limit.",
        ],
      });
    }

    return c.json(response);
  } catch (error) {
    console.error(`Search ${endpoint} error:`, error);
    return c.json({ error: "Search failed" }, 500);
  }
}

searchRoutes.post("/", (c) => handleSearch(c, undefined, "search"));
searchRoutes.post("/compact", (c) =>
  handleSearch(c, { language: "compact" }, "compact")
);
searchRoutes.post("/typescript", (c) =>
  handleSearch(c, { language: "typescript" }, "typescript")
);
searchRoutes.post("/docs", (c) =>
  handleSearch(c, { language: "markdown" }, "docs")
);

export default searchRoutes;
```

- [ ] **Step 2: Add `warnings` field to `SearchResponse` interface**

In `api/src/interfaces/index.ts`, update `SearchResponse`:

```typescript
export interface SearchResponse {
  results: SearchResult[];
  query: string;
  totalResults: number;
  warnings?: string[];
}
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/search.ts src/interfaces/index.ts
git commit -m "feat(api): deduplicate search routes and add auth warning on invalid token"
```

---

### Task 10: Wire everything together in index.ts

**Files:**
- Modify: `api/src/index.ts`

- [ ] **Step 1: Replace the main app file**

Replace the entire file content of `api/src/index.ts`:

```typescript
/**
 * Midnight MCP API
 *
 * A Cloudflare Worker API for semantic search across Midnight repositories.
 * Provides search endpoints with GitHub OAuth, tiered rate limiting, and embedding caching.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Bindings } from "./interfaces";
import {
  healthRoutes,
  searchRoutes,
  statsRoutes,
  dashboardRoute,
  trackRoutes,
  oauthRoutes,
} from "./routes";
import { bodyLimit, auth, rateLimit } from "./middleware";

const app = new Hono<{ Bindings: Bindings }>();

// CORS — allow all origins for public API, include Authorization header
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400, // 24 hours
  })
);

// Middleware chain (order matters):
// 1. Body limit — reject oversized payloads before any KV/auth work
// 2. Auth — extract user identity from Bearer token or session cookie
app.use("*", bodyLimit);
app.use("*", auth);

// Rate limiting — applied only to search and track routes
app.use("/v1/search/*", rateLimit);
app.use("/v1/track/*", rateLimit);

// Mount routes
app.route("/", healthRoutes);
app.route("/", oauthRoutes); // Mounts /.well-known/* and /oauth/*
app.route("/v1/search", searchRoutes);
app.route("/v1/stats", statsRoutes);
app.route("/v1/track", trackRoutes);
app.route("/dashboard", dashboardRoute);

export default app;
```

- [ ] **Step 2: Commit**

```bash
git add src/index.ts
git commit -m "feat(api): wire up OAuth routes, middleware chain, and rate limiting"
```

---

### Task 11: Final verification

- [ ] **Step 1: Type check**

```bash
cd /Users/aaronbassett/Projects/midnight/midnight-mcp/api
npx tsc --noEmit
```

Fix any type errors that arise. Common issues:
- `RateLimit` type may need a declaration if `@cloudflare/workers-types` doesn't export it
- Hono context typing for `c.get("authState")` may need the module augmentation from `auth.ts`
- `generateDashboardHtml` signature change needs to match the template file

- [ ] **Step 2: Test local dev**

```bash
cd /Users/aaronbassett/Projects/midnight/midnight-mcp/api
npx wrangler dev
```

Verify:
- `GET /health` returns 200
- `GET /.well-known/oauth-authorization-server` returns discovery JSON
- `POST /v1/search/compact` with a query body works (anon rate limit)
- `GET /dashboard` returns 403 (if `DASHBOARD_ALLOWED_ORGS` not set in dev)

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "fix(api): resolve type errors and verify integration"
```
