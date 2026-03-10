# API Auth, Rate Limiting, and Caching Design

**Date:** 2026-03-10
**Status:** Approved
**Scope:** Cloudflare Workers API (`api/`)

## Problem

The Workers API has several critical security and performance issues:

1. Dashboard authentication uses a query parameter password (logged in access logs, browser history, CDN)
2. No rate limiting on search endpoints (anyone can burn OpenAI embedding credits)
3. No request size limits
4. Every search request calls OpenAI for embedding generation (expensive, slow)
5. Four near-identical search route handlers (maintenance burden)

## Design

### OAuth 2.1 with GitHub

Self-managed OAuth 2.1 implementation in the Worker, with GitHub as the sole identity provider.

#### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/.well-known/oauth-authorization-server` | GET | MCP client auto-discovery |
| `/oauth/authorize` | GET | Redirects browser to GitHub OAuth |
| `/oauth/callback` | GET | GitHub redirects back here with auth code |
| `/oauth/token` | POST | Exchange authorization code for access token |
| `/oauth/register` | POST | Dynamic client registration (MCP spec requirement) |
| `/oauth/logout` | GET | Clears session cookie, deletes KV token |

#### Auth flow (with PKCE)

1. Client requests `/.well-known/oauth-authorization-server` to discover endpoints
2. Client generates PKCE `code_verifier` and `code_challenge` (S256 method)
3. Client redirects user to `/oauth/authorize?client_id=...&redirect_uri=...&state=...&code_challenge=...&code_challenge_method=S256`
4. Worker generates a random `state` value, stores it in KV (`state:{state}` with 300s TTL) alongside the `code_challenge` and `redirect_uri`
5. Worker redirects to GitHub OAuth with scopes `read:org` and `user:email`, passing through the `state`
6. GitHub redirects to `/oauth/callback?code=...&state=...`
7. Worker verifies `state` against KV (lookup + delete to prevent reuse) — rejects if missing/mismatched (CSRF protection)
8. Worker exchanges code with GitHub for a GitHub access token
9. Worker fetches user profile and org memberships from GitHub API
10. Worker generates a short-lived authorization code, stores in KV with the user data and `code_challenge`
11. Worker redirects to the original client `redirect_uri` (from the stored state) with the authorization code
12. Client exchanges authorization code for access token via `POST /oauth/token`, presenting `code_verifier`
13. Worker verifies `code_verifier` against stored `code_challenge` (PKCE validation)
14. Worker generates an opaque access token, stores session in KV, returns token

#### Token exchange (`POST /oauth/token`)

Request format: `application/x-www-form-urlencoded` (per OAuth spec)

Required parameters:
- `grant_type=authorization_code`
- `code` — the authorization code
- `client_id` — the registered client ID
- `redirect_uri` — must match the original request
- `code_verifier` — PKCE proof

Response: `{ "access_token": "...", "token_type": "Bearer", "expires_in": 86400 }`

No refresh tokens. When the access token expires (24h), the client must re-authenticate.

#### Dynamic client registration (`POST /oauth/register`)

Open registration (required by MCP spec for dynamic client discovery). Any client can register.

Required fields: `redirect_uris` (array of URIs), `client_name` (string).
Generated: `client_id` (random UUID), `client_secret` (random, if confidential client).
Validation: `redirect_uris` must use `http://localhost:*` or `https://` schemes only.
Storage: KV with 30d TTL. Registrations are cheap and self-pruning.

#### KV storage

| Key pattern | Value | TTL |
|-------------|-------|-----|
| `token:{access_token}` | `{ githubId, username, email, orgs, expiresAt }` | 24h |
| `session:{session_id}` | `{ accessToken }` | 24h |
| `client:{client_id}` | `{ clientName, redirectUris, clientSecret? }` | 30d |
| `code:{auth_code}` | `{ userId, codeChallenge, redirectUri }` | 60s |
| `state:{state}` | `{ codeChallenge, redirectUri, clientId }` | 300s |

#### GitHub OAuth scopes

`read:org` and `user:email`. No repo access needed.

#### Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `GITHUB_CLIENT_ID` | Yes | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | Yes | GitHub OAuth App client secret |
| `DASHBOARD_ALLOWED_ORGS` | Yes | Comma-separated list of GitHub orgs allowed to access dashboard |

### Dashboard Auth

Replace query parameter password with session-based auth via GitHub OAuth.

- Dashboard routes check for a session cookie (`midnight_session`)
- No cookie or invalid/expired token: redirect to `/oauth/authorize` with `redirect_uri=/dashboard`
- After OAuth completes: set HTTP-only secure cookie with a separate session ID (not the access token — the cookie value is never directly usable as a Bearer token)
- Session ID maps to access token in KV (`session:{session_id}` → `{ accessToken }`)
- Middleware resolves session → access token → user data from KV, checks `orgs` array against `DASHBOARD_ALLOWED_ORGS`
- User authenticated but not in an allowed org: 403 with message "You must be a member of [allowed orgs]"
- `DASHBOARD_ALLOWED_ORGS` not set: 403 for everyone with message "Dashboard access not configured. Set DASHBOARD_ALLOWED_ORGS environment variable."
- Dashboard template shows "Logged in as @username" and a logout link

Deleted: `DASHBOARD_PASSWORD` env var and `?p=` query parameter auth.

### Rate Limiting

Two Cloudflare Workers rate limit bindings:

| Binding | Limit | Period | Key |
|---------|-------|--------|-----|
| `RATE_LIMIT_ANON` | 10 requests | 60s | `ip:{cf-connecting-ip}` |
| `RATE_LIMIT_AUTH` | 60 requests | 60s | `user:{githubId}` |

#### Middleware logic

1. Check `Authorization: Bearer <token>` header
2. Token present and valid in KV: use `RATE_LIMIT_AUTH`, key by GitHub user ID
3. Token present but invalid/expired: downgrade to `RATE_LIMIT_ANON`, key by IP, add warning to response `warnings` array: "Your access token is invalid or expired. You are being rate limited as an anonymous user (10 req/min). Re-authenticate via /mcp to restore your full rate limit."
4. No Authorization header: use `RATE_LIMIT_ANON`, key by IP
5. Rate limit exceeded: 429 with `{ error: "Rate limited", retryAfter: 60 }`

#### Rate limited routes

- `/v1/search/*`
- `/v1/track/*`

#### Not rate limited

- `/.well-known/oauth-authorization-server`
- `/oauth/*`
- `/health`
- `/dashboard` (gated by org membership)

#### No rate limit headers

Rate limits and how to increase them are documented in README/API docs. No `X-RateLimit-*` headers.

### Request Size Limit

Hono middleware applied early in the chain, before route handlers:

- Check `Content-Length` header against 1MB (1,048,576 bytes)
- Exceeds limit: 413 with `{ error: "Request body too large. Maximum size is 1MB." }`
- Additional defense in depth: `validateQuery` truncates to 1000 chars, `getEmbedding` truncates to 8000 chars

### Embedding Cache

Cache OpenAI embedding vectors in KV to avoid redundant API calls.

#### New KV namespace

```toml
[[kv_namespaces]]
binding = "EMBEDDING_CACHE"
id = "..."
```

#### Cache logic

1. Normalize query: lowercase, trim, collapse whitespace
2. Hash normalized query: SHA-256, hex string
3. KV lookup: `embedding:{hash}`
4. Hit: return cached 1536-dimensional vector, skip OpenAI call
5. Miss: call OpenAI `text-embedding-3-small`, store result in KV with 24h TTL, return vector

#### TTL rationale

24 hours. Embeddings for the same query text are deterministic (same model + input = same vector), so they don't go stale when the Vectorize index changes. The TTL guards against OpenAI model updates.

#### Size

Each cached embedding is ~12KB (1536 floats as JSON). Well within KV free tier limits for expected traffic.

### Search Route Deduplication

Extract shared handler from the four near-identical search endpoints:

```
POST /v1/search        → handleSearch(c, undefined, "search")
POST /v1/search/compact    → handleSearch(c, { language: "compact" }, "compact")
POST /v1/search/typescript → handleSearch(c, { language: "typescript" }, "typescript")
POST /v1/search/docs       → handleSearch(c, { language: "markdown" }, "docs")
```

Shared handler encapsulates: metrics loading, body parsing, query validation, cached embedding generation, Vectorize query, keyword boost, tracking, metrics persistence, and response formatting. Error handling wraps the shared function once.

### CORS

Stays `origin: "*"`. The API is called by MCP clients from various origins. Rate limiting protects against abuse, not CORS.

Add `Authorization` to `allowHeaders` so browsers permit Bearer token headers on cross-origin requests.

### Middleware Ordering

Applied in this order (order matters):

1. **Body limit** — reject oversized payloads before any KV/auth work
2. **Auth** — extract user identity from Bearer token or session cookie
3. **Rate limit** — select tier based on auth state (needs auth to run first)

### `/v1/stats` Routes

Left as-is (unauthenticated, not rate limited). Stats only expose aggregate counts, not sensitive data. If stats scope expands in future, reconsider.

## File Changes

### New files

| File | Purpose |
|------|---------|
| `api/src/routes/oauth.ts` | OAuth 2.1 endpoints |
| `api/src/middleware/auth.ts` | Auth middleware: extract user from Bearer token, set context |
| `api/src/middleware/rate-limit.ts` | Rate limit middleware: select tier based on auth state |
| `api/src/middleware/body-limit.ts` | Request size limit (1MB) |

### Modified files

| File | Change |
|------|--------|
| `api/wrangler.toml` | Add rate limit bindings, embedding cache KV namespace |
| `api/src/index.ts` | Mount OAuth routes, add middleware chain (body limit, auth, rate limit) |
| `api/src/interfaces/index.ts` | Add to `Bindings`: `GITHUB_CLIENT_ID: string`, `GITHUB_CLIENT_SECRET: string`, `DASHBOARD_ALLOWED_ORGS: string`, `EMBEDDING_CACHE: KVNamespace`, `RATE_LIMIT_ANON: RateLimit`, `RATE_LIMIT_AUTH: RateLimit` |
| `api/src/routes/dashboard.ts` | Replace query param auth with session cookie + org membership check |
| `api/src/routes/search.ts` | Deduplicate into shared handler, add warnings for invalid tokens |
| `api/src/services/embeddings.ts` | Add KV cache layer. Signature changes from `getEmbedding(text, apiKey)` to `getEmbedding(text, apiKey, cache: KVNamespace)` to accept the `EMBEDDING_CACHE` binding |

### Deleted

| Item | Reason |
|------|--------|
| `DASHBOARD_PASSWORD` env var | Replaced by GitHub OAuth + org check |
| Query param `?p=` auth logic | Security issue: password in URL |

## Error Response Format

All error responses use a consistent shape:

```json
{ "error": "Human-readable message", "retryAfter": 60 }
```

`retryAfter` is only present on 429 responses. All errors return appropriate HTTP status codes (400, 401, 403, 413, 429, 500).

## Not Changing

- CORS stays `origin: "*"`
- `/health` stays unauthenticated
- Telemetry (`/v1/track/tool`) stays as-is
- MCP server code (`src/`) untouched: all changes are in the Workers API (`api/`)
