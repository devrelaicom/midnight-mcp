# Cloudflare Integration

The hosted API for midnight-mcp runs on Cloudflare Workers with Vectorize for vector search.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User's MCP Client                        │
│                (Claude Desktop, Cursor)                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   midnight-mcp (npm)                        │
│                                                             │
│  Default: calls hosted API                                  │
│  Local mode: uses ChromaDB + OpenAI directly                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Cloudflare Workers API                         │
│         midnight-mcp-api.midnightmcp.workers.dev           │
│                                                             │
│  Endpoints:                                                 │
│  - POST /v1/search/compact    (Compact code)               │
│  - POST /v1/search/typescript (TypeScript SDK)             │
│  - POST /v1/search/docs       (Documentation)              │
│  - POST /v1/search/           (General, with filter)       │
│  - GET  /                     (Health check)               │
│  - GET  /v1/stats/*           (Statistics)                 │
│  - GET  /dashboard/*          (Metrics dashboard)          │
└─────────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌──────────────────────┐    ┌──────────────────────┐
│   OpenAI API         │    │  Cloudflare Vectorize│
│                      │    │                      │
│  Generates 1536-dim  │    │  Vector database     │
│  embeddings for      │    │  storing indexed     │
│  search queries      │    │  Midnight code       │
└──────────────────────┘    └──────────────────────┘
```

## How Search Works

1. User asks Claude: "Find token transfer examples"
2. Claude calls `midnight-search-compact` tool
3. MCP sends query to Cloudflare Workers API
4. Worker generates embedding via OpenAI
5. Worker queries Vectorize for similar vectors
6. Returns top matching code snippets
7. Claude presents results to user

## Components

### Workers (`api/`)

Serverless API handling search requests:

- **Runtime**: Cloudflare Workers (V8 isolates)
- **Framework**: Hono
- **Cold start**: ~0ms (no cold starts)
- **Limits**: 100k requests/day (free tier)

### Vectorize

Native vector database on Cloudflare:

- **Index**: `midnight-code`
- **Dimensions**: 1536 (OpenAI text-embedding-3-small)
- **Metric**: Cosine similarity
- **Limits**: 5M queries/month (free tier)

### Indexed Content

102 repositories indexed (~26,000 documents). See `api/README.md` for the full breakdown by category.

### API Structure

```
api/src/
├── index.ts           # Hono app setup and route registration
├── routes/
│   ├── search.ts      # Search endpoints (/v1/search/*)
│   ├── stats.ts       # Statistics endpoints (/v1/stats/*)
│   ├── dashboard.ts   # Metrics dashboard (/dashboard/*)
│   └── oauth.ts       # OAuth flows (/.well-known/*, /oauth/*)
├── middleware/
│   ├── auth.ts        # Authentication middleware
│   └── rate-limit.ts  # Rate limiting
├── services/
│   ├── embeddings.ts  # OpenAI embedding generation
│   └── vectorize.ts   # Cloudflare Vectorize integration
├── utils/             # Search and validation utilities
└── templates/         # Dashboard HTML templates
```

## Deployment

### Prerequisites

- Cloudflare account
- Wrangler CLI (`npx wrangler login`)
- OpenAI API key

### Setup

```bash
cd api

# Install dependencies
npm install

# Create Vectorize index (one-time)
npx wrangler vectorize create midnight-code --dimensions=1536 --metric=cosine

# Add OpenAI API key as secret
npx wrangler secret put OPENAI_API_KEY

# Deploy
npx wrangler deploy
```

### Indexing

Index repositories into Vectorize:

```bash
# Set environment variables
export CLOUDFLARE_ACCOUNT_ID=your_account_id
export CLOUDFLARE_API_TOKEN=your_api_token
export OPENAI_API_KEY=your_openai_key
export GITHUB_TOKEN=your_github_token            # For public repos
export MIDNIGHT_GITHUB_TOKEN=your_org_pat        # For private midnightntwrk repos

# Run indexing
npm run index
```

### Local Development

```bash
npx wrangler dev
```

## API Reference

### POST /v1/search/compact

Search Compact smart contract code.

```bash
curl -X POST https://midnight-mcp-api.midnightmcp.workers.dev/v1/search/compact \
  -H "Content-Type: application/json" \
  -d '{"query": "token transfer", "limit": 5}'
```

Response:

```json
{
  "results": [
    {
      "content": "export circuit transfer(...) { ... }",
      "score": 0.89,
      "metadata": {
        "repository": "midnightntwrk/compact",
        "filePath": "examples/token.compact",
        "language": "compact"
      }
    }
  ],
  "totalResults": 5
}
```

### POST /v1/search/typescript

Search TypeScript SDK code.

### POST /v1/search/docs

Search documentation.

### POST /v1/search/

General search with optional language filter.

```bash
curl -X POST https://midnight-mcp-api.midnightmcp.workers.dev/v1/search/ \
  -H "Content-Type: application/json" \
  -d '{"query": "token transfer", "limit": 5, "filter": {"language": "compact"}}'
```

### GET /

Health check endpoint.

## Cost Estimates

| Resource          | Free Tier | Cost After     |
| ----------------- | --------- | -------------- |
| Workers requests  | 100k/day  | $0.50/M        |
| Vectorize queries | 5M/month  | $0.01/1k       |
| OpenAI embeddings | -         | ~$0.0001/query |

For typical usage (<10k queries/month), the hosting is essentially free.

## Monitoring

View logs and analytics:

- **Dashboard**: https://dash.cloudflare.com → Workers → midnight-mcp-api
- **Logs**: `npx wrangler tail` (live logs)

## Updating the Index

Re-run indexing when Midnight repos are updated:

```bash
cd api
npm run index
```

Consider setting up a scheduled job (Cloudflare Cron Triggers or GitHub Actions) for automatic re-indexing.
