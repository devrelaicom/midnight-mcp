# Midnight MCP API — Backend Setup Guide

The hosted backend for midnight-mcp. Runs on Cloudflare Workers with Vectorize for semantic search, D1 for metrics and caching, and KV for session storage.

This guide walks through provisioning all infrastructure and deploying the API from scratch.

---

## Prerequisites

You will need:

1. **A Cloudflare account** — sign up at https://dash.cloudflare.com/sign-up (free tier is sufficient)
2. **Node.js 24.14.0+** — check with `node --version`
3. **An OpenAI API key** — get one at https://platform.openai.com/api-keys (for generating search embeddings)
4. **A GitHub personal access token** — create one at https://github.com/settings/tokens with `repo` scope (for indexing repositories)
5. **A GitHub OAuth App** — for dashboard authentication (see Step 5 below)

---

## Step 1: Install dependencies

```bash
cd api
npm install
```

This installs the Wrangler CLI (Cloudflare's deployment tool), Hono (HTTP framework), and the indexing scripts.

---

## Step 2: Authenticate with Cloudflare

```bash
npx wrangler login
```

This opens a browser window. Log in and authorize the Wrangler CLI. Once complete, Wrangler can manage your Cloudflare resources.

Verify it worked:

```bash
npx wrangler whoami
```

You should see your account name and account ID. Note your **Account ID** — you will need it later for indexing.

---

## Step 3: Create the Vectorize index

Vectorize is Cloudflare's vector database. This stores the embeddings used for semantic search.

```bash
npx wrangler vectorize create midnight-code --dimensions=1536 --metric=cosine
```

- `--dimensions=1536` matches the OpenAI `text-embedding-3-small` model output
- `--metric=cosine` is the similarity metric used for search

If you get an error that the index already exists, you can skip this step or delete and recreate:

```bash
npx wrangler vectorize delete midnight-code
npx wrangler vectorize create midnight-code --dimensions=1536 --metric=cosine
```

---

## Step 4: Create the D1 database

D1 is Cloudflare's SQL database. It stores metrics, query logs, tool call logs, and the embedding cache.

```bash
npx wrangler d1 create midnight-mcp
```

This outputs a database ID. Copy it, then update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "midnight-mcp"
database_id = "YOUR_DATABASE_ID_HERE"   # <-- paste the ID here
```

Now apply the schema migration:

```bash
npx wrangler d1 execute midnight-mcp --remote --file=./migrations/0001_create_tables.sql
```

This creates the following tables:

| Table             | Purpose                                  |
| ----------------- | ---------------------------------------- |
| `counters`        | Atomic counters for metrics              |
| `query_log`       | Recent search queries with scores        |
| `tool_call_log`   | Tool and playground call tracking        |
| `embedding_cache` | Cached embeddings to reduce OpenAI calls |

---

## Step 5: Create a GitHub OAuth App

The dashboard uses GitHub OAuth to restrict access to authorized organizations.

1. Go to https://github.com/settings/developers
2. Click **New OAuth App**
3. Fill in:
   - **Application name:** `Midnight MCP Dashboard` (or whatever you prefer)
   - **Homepage URL:** `https://midnight-mcp-api.<your-subdomain>.workers.dev`
   - **Authorization callback URL:** `https://midnight-mcp-api.<your-subdomain>.workers.dev/oauth/callback`
4. Click **Register application**
5. Copy the **Client ID**
6. Click **Generate a new client secret** and copy the **Client Secret**

> **Note:** Your workers.dev subdomain is visible at https://dash.cloudflare.com > Workers & Pages > Overview. It's in the format `<your-subdomain>.workers.dev`. If you plan to use a custom domain, use that instead.

---

## Step 6: Configure secrets

Secrets are sensitive values stored securely in Cloudflare and injected at runtime. Run each command and paste the value when prompted:

```bash
npx wrangler secret put OPENAI_API_KEY
# Paste your OpenAI API key

npx wrangler secret put GITHUB_CLIENT_ID
# Paste the GitHub OAuth App Client ID from Step 5

npx wrangler secret put GITHUB_CLIENT_SECRET
# Paste the GitHub OAuth App Client Secret from Step 5

npx wrangler secret put DASHBOARD_ALLOWED_ORGS
# Comma-separated list of GitHub orgs whose members can access the dashboard
# Example: midnightntwrk,devrelaicom
```

---

## Step 7: Deploy the Worker

```bash
npm run deploy
```

This runs a configuration check (verifying `wrangler.toml` has a valid D1 database ID) followed by `wrangler deploy`. Always use `npm run deploy` instead of calling `wrangler deploy` directly to ensure the pre-deploy validation runs.

Verify the deployment:

```bash
curl https://midnight-mcp-api.<your-subdomain>.workers.dev/ready
```

You should get a JSON response with `"status": "ready"` and all checks passing. A `503` with `"status": "degraded"` means one or more dependencies (D1, playground) are not responding.

---

## Step 8: Index repositories

The indexing script downloads Midnight repositories, chunks the code, generates embeddings via OpenAI, and inserts them into Vectorize.

Create a `.env` file in the **project root** (parent of `api/`):

```bash
# Required
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
OPENAI_API_KEY=your_openai_key

# Recommended (increases GitHub rate limit from 60 to 5000 req/hr)
GITHUB_TOKEN=your_github_pat
```

To get your Cloudflare API Token:

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click **Create Token**
3. Use the **Edit Cloudflare Workers** template
4. Under **Account Resources**, select your account
5. Click **Continue to summary** > **Create Token**
6. Copy the token

Now run the indexer:

```bash
npm run index
```

This takes several minutes on first run. It:

- Downloads each repository as a tarball (much faster than git clone)
- Chunks code files into ~1000-character segments with 200-character overlap
- Generates embeddings via OpenAI `text-embedding-3-small`
- Batch-inserts vectors into Cloudflare Vectorize
- Caches file SHAs so subsequent runs only reindex changed files

To force a full reindex (ignoring the cache):

```bash
FORCE_REINDEX=true npm run index
```

### Indexing configuration

| Setting       | Value      | Description                        |
| ------------- | ---------- | ---------------------------------- |
| Chunk size    | 1000 chars | Smaller chunks for precise results |
| Chunk overlap | 200 chars  | Context continuity between chunks  |
| Keyword boost | Up to 20%  | Boosts exact keyword matches       |

### Private repositories

To index private repositories from the `midnightntwrk` organization, add to your `.env`:

```bash
MIDNIGHT_GITHUB_TOKEN=your_org_pat_with_repo_scope
```

This token needs `repo` scope and access to the `midnightntwrk` org.

---

## Endpoints

| Endpoint                       | Method | Auth     | Description                      |
| ------------------------------ | ------ | -------- | -------------------------------- |
| `/health`                      | GET    | None     | Health check                     |
| `/ready`                       | GET    | None     | Readiness check (D1 + playground)|
| `/v1/search/compact`           | POST   | Optional | Search Compact code              |
| `/v1/search/typescript`        | POST   | Optional | Search TypeScript SDK code       |
| `/v1/search/docs`              | POST   | Optional | Search documentation             |
| `/v1/stats/*`                  | GET    | Optional | Usage statistics                 |
| `/v1/track/*`                  | POST   | Optional | Tool call tracking               |
| `/pg/compile`                  | POST   | Optional | Proxy to Compact compiler        |
| `/pg/format`                   | POST   | Optional | Proxy to Compact formatter       |
| `/pg/analyze`                  | POST   | Optional | Proxy to contract analyzer       |
| `/pg/diff`                     | POST   | Optional | Proxy to contract diff           |
| `/pg/visualize`                | POST   | Optional | Proxy to contract visualizer     |
| `/pg/prove`                    | POST   | Optional | Proxy to ZK proof analyzer       |
| `/pg/compile/archive`          | POST   | Optional | Proxy to multi-file compiler     |
| `/pg/simulate/deploy`          | POST   | Optional | Deploy simulation session        |
| `/pg/simulate/:id/call`        | POST   | Optional | Execute circuit in simulation    |
| `/pg/simulate/:id/state`       | GET    | Optional | Read simulation state            |
| `/pg/simulate/:id`             | DELETE | Optional | End simulation session           |
| `/pg/versions`                 | GET    | Optional | List compiler versions           |
| `/pg/libraries`                | GET    | Optional | List available OZ libraries      |
| `/pg/cached-response/:hash`    | GET    | Optional | Retrieve cached playground result|
| `/pg/health`                   | GET    | None     | Playground health check          |
| `/dashboard`                   | GET    | GitHub   | Analytics dashboard              |
| `/.well-known/oauth-*`         | GET    | None     | OAuth discovery                  |
| `/oauth/*`                     | GET    | None     | OAuth flows                      |

### Rate limits

| Tier          | Limit               |
| ------------- | ------------------- |
| Anonymous     | 10 requests / 60s   |
| Authenticated | 60 requests / 60s   |

Rate limiting applies to `/v1/search/*`, `/v1/track/*`, and `/pg/*` routes.

### Search request format

```bash
curl -X POST https://midnight-mcp-api.<your-subdomain>.workers.dev/v1/search/compact \
  -H "Content-Type: application/json" \
  -d '{"query": "token transfer", "limit": 5}'
```

Response:

```json
{
  "results": [
    {
      "content": "export circuit transfer(...) { ... }",
      "relevanceScore": 0.89,
      "source": {
        "repository": "midnightntwrk/compact",
        "filePath": "examples/token.compact",
        "lines": "10-50"
      },
      "codeType": "compact"
    }
  ],
  "query": "token transfer",
  "totalResults": 5
}
```

---

## Ongoing maintenance

### Re-indexing

Re-run the indexer when Midnight repositories are updated:

```bash
cd api
npm run index
```

The script uses incremental indexing by default — only changed files are reprocessed.

For automated re-indexing, set up a GitHub Actions workflow with a cron schedule:

```yaml
on:
  schedule:
    - cron: '0 6 * * *'  # Daily at 6am UTC
  workflow_dispatch:       # Manual trigger
```

### Monitoring

- **Cloudflare Dashboard:** https://dash.cloudflare.com > Workers & Pages > midnight-mcp-api
- **Live logs:** `npx wrangler tail` (streams real-time logs from the Worker)
- **Analytics dashboard:** `https://midnight-mcp-api.<your-subdomain>.workers.dev/dashboard` (requires GitHub OAuth)

### Updating the Compact Playground URL

The API proxies compilation, formatting, and analysis requests to the Compact Playground. The URL is configured in `wrangler.toml`:

```toml
[vars]
COMPACT_PLAYGROUND_URL = "https://compact-playground.fly.dev"
```

To change it, edit the value and redeploy:

```bash
npm run deploy
```

---

## Local development

```bash
npx wrangler dev
```

This starts the Worker locally at `http://localhost:8787` with access to your remote Cloudflare resources (Vectorize, D1, KV).

Test it:

```bash
curl -X POST http://localhost:8787/v1/search/compact \
  -H "Content-Type: application/json" \
  -d '{"query": "token transfer", "limit": 5}'
```

---

## Cost

| Resource          | Free Tier   | Cost After     |
| ----------------- | ----------- | -------------- |
| Workers requests  | 100k/day    | $0.50/M        |
| Vectorize queries | 5M/month    | $0.01/1k       |
| D1 reads          | 5M/day      | $0.001/M       |
| D1 writes         | 100k/day    | $1.00/M        |
| KV reads          | 100k/day    | $0.50/M        |
| OpenAI embeddings | -           | ~$0.0001/query |

For typical usage (<10k queries/month), hosting is essentially free.

---

## Architecture

```
                   MCP Clients (Claude, Cursor, VS Code, etc.)
                                    |
                                    v
                          midnight-mcp (npm)
                                    |
                                    v
            ┌───────────── Cloudflare Worker ──────────────┐
            │                                              │
            │  Hono HTTP framework                         │
            │  ├── /v1/search/*   → Vectorize + OpenAI     │
            │  ├── /v1/stats/*    → D1                     │
            │  ├── /v1/track/*    → D1                     │
            │  ├── /pg/*          → Compact Playground     │
            │  ├── /dashboard     → D1 + KV (OAuth)        │
            │  └── /oauth/*       → GitHub + KV            │
            │                                              │
            │  Bindings:                                   │
            │  ├── VECTORIZE  (vector search)              │
            │  ├── DB         (D1 — metrics, cache)        │
            │  ├── METRICS    (KV — sessions)              │
            │  ├── RATE_LIMIT_ANON / RATE_LIMIT_AUTH       │
            │  └── Secrets (OPENAI_API_KEY, OAuth creds)   │
            └──────────────────────────────────────────────┘
                       │                    │
                       v                    v
                  OpenAI API        Compact Playground
              (embeddings)          (compile/format/analyze)
```

### Project structure

```
api/
├── migrations/
│   └── 0001_create_tables.sql    # D1 schema
├── scripts/
│   ├── index-repos.ts            # Repository indexing script
│   ├── constants/index.ts        # Repository list, file extensions
│   ├── interfaces/index.ts       # Indexing types
│   ├── services/                 # GitHub, Vectorize, embedding clients
│   └── utils/                    # Chunking, language detection
├── src/
│   ├── index.ts                  # Hono app, route registration, middleware
│   ├── interfaces/index.ts       # API types (Bindings, Metrics, Search)
│   ├── middleware/
│   │   ├── auth.ts               # GitHub OAuth token + session auth
│   │   ├── body-limit.ts         # Request size limits
│   │   └── rate-limit.ts         # Tiered rate limiting
│   ├── routes/
│   │   ├── health.ts             # GET /health
│   │   ├── search.ts             # POST /v1/search/*
│   │   ├── stats.ts              # GET /v1/stats/*
│   │   ├── track.ts              # POST /v1/track/*
│   │   ├── pg.ts                 # /pg/* playground proxy
│   │   ├── oauth.ts              # OAuth 2.1 flows
│   │   └── dashboard.ts          # Analytics dashboard
│   ├── services/
│   │   ├── embeddings.ts         # OpenAI embedding generation
│   │   ├── vectorize.ts          # Cloudflare Vectorize client
│   │   └── oauth.ts              # GitHub OAuth helpers
│   ├── templates/
│   │   └── dashboard.ts          # Dashboard HTML template
│   └── utils/                    # Search utilities, validation
├── wrangler.toml                 # Cloudflare Worker config
├── tsconfig.json
└── package.json
```

---

## Quick reference

| Task                        | Command                                                       |
| --------------------------- | ------------------------------------------------------------- |
| Install dependencies        | `npm install`                                                 |
| Start local dev server      | `npx wrangler dev`                                            |
| Deploy to Cloudflare        | `npm run deploy`                                              |
| Create Vectorize index      | `npm run create-index`                                        |
| Delete Vectorize index      | `npm run delete-index`                                        |
| Run indexing                 | `npm run index`                                               |
| Force full reindex          | `FORCE_REINDEX=true npm run index`                            |
| Apply D1 migration          | `npx wrangler d1 execute midnight-mcp --remote --file=./migrations/0001_create_tables.sql` |
| Stream live logs            | `npx wrangler tail`                                           |
| Add a secret                | `npx wrangler secret put SECRET_NAME`                         |
