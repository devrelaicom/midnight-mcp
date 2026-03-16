# Architecture

## System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        MCP Client                                │
│                (Claude Desktop, Cursor, etc.)                    │
└──────────────────────────────────────────────────────────────────┘
                              │
                              │ JSON-RPC 2.0 / stdio or HTTP
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                      midnight-mcp                                │
│  ┌────────────┐  ┌──────────────┐                               │
│  │ 23 Tools   │  │ 5 Resources  │                               │
│  └────────────┘  └──────────────┘                               │
└──────────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
    │ Hosted API  │    │   GitHub    │    │  Compiler   │
    │  (default)  │    │  (Octokit)  │    │  (hosted)   │
    └─────────────┘    └─────────────┘    └─────────────┘
           │
           ▼ (local mode only)
    ┌─────────────┐    ┌─────────────┐
    │  ChromaDB   │◄───│   OpenAI    │
    └─────────────┘    └─────────────┘
```

## Modes

**Hosted mode** (default): Search requests go to a hosted API. Zero configuration.

**Local mode**: Set `MIDNIGHT_LOCAL=true`. Requires ChromaDB + OpenAI API key. Search runs locally with your own embeddings.

## Components

### Tools (`src/tools/`)

**Meta Tools (3)**

| Tool                              | Purpose                               |
| --------------------------------- | ------------------------------------- |
| `midnight-list-tool-categories`   | List available tool categories        |
| `midnight-list-category-tools`    | List tools within a category          |
| `midnight-suggest-tool`           | Smart discovery via natural language   |

**Search Tools (4)**

| Tool                              | Purpose                                    |
| --------------------------------- | ------------------------------------------ |
| `midnight-search-compact`         | Semantic search over Compact code          |
| `midnight-search-typescript`      | Semantic search over TypeScript SDK        |
| `midnight-search-docs`            | Full-text search of documentation          |
| `midnight-fetch-docs`             | Live fetch from docs.midnight.network      |

**Analysis Tools (2)**

| Tool                              | Purpose                                    |
| --------------------------------- | ------------------------------------------ |
| `midnight-analyze-contract`       | Static analysis: structure, patterns, security |
| `midnight-compile-contract`       | Real compilation via hosted compiler service |

**Code Tools (2)**

| Tool                              | Purpose                                    |
| --------------------------------- | ------------------------------------------ |
| `midnight-format-contract`        | Format Compact code via hosted formatter   |
| `midnight-diff-contracts`         | Semantic diff of two Compact contracts     |

**Repository Tools (8)**

| Tool                                  | Purpose                                    |
| ------------------------------------- | ------------------------------------------ |
| `midnight-get-file`                   | Fetch file from GitHub                     |
| `midnight-list-examples`              | List example contracts                     |
| `midnight-get-latest-updates`         | Recent commits across repos                |
| `midnight-check-breaking-changes`     | Breaking changes since version X           |
| `midnight-get-file-at-version`        | File content at specific tag               |
| `midnight-compare-syntax`             | Diff file between versions                 |
| `midnight-upgrade-check`              | _Compound:_ breaking changes check         |
| `midnight-get-repo-context`           | _Compound:_ repo context for AI assistants |

**Health Tools (4)**

| Tool                                  | Purpose                                    |
| ------------------------------------- | ------------------------------------------ |
| `midnight-health-check`               | Server health with optional detailed checks |
| `midnight-get-status`                 | Quick status (rate limits, cache stats)    |
| `midnight-check-version`              | Check for server updates                   |
| `midnight-get-update-instructions`    | Platform-specific update guidance          |

### Advanced MCP Features

**Tool Annotations**: All tools include behavioral hints:

- `readOnlyHint` — Tool doesn't modify state
- `idempotentHint` — Safe to retry
- `openWorldHint` — May return external data
- `longRunningHint` — May take time

**Output Schemas**: JSON schemas for structured tool outputs.

**Resource Templates** (RFC 6570):

- `midnight://code/{owner}/{repo}/{path}` — Any code file
- `midnight://docs/{section}/{topic}` — Documentation
- `midnight://examples/{category}/{name}` — Example contracts
- `midnight://schema/{type}` — JSON schemas

**Subscriptions**: Subscribe to resource change notifications.

### Resources (`src/resources/`)

Accessible via `midnight://` URIs.

**Documentation (2)**

- `midnight://docs/compact-reference`
- `midnight://docs/tokenomics`

**Schemas (3)**

- `midnight://schema/compact-ast`
- `midnight://schema/transaction`
- `midnight://schema/proof`

### Services (`src/services/`)

| Service          | File                  | Purpose                                                        |
| ---------------- | --------------------- | -------------------------------------------------------------- |
| Compiler         | `compiler.ts`         | Hosted Compact compiler; falls back to static analysis         |
| Syntax Validator | `syntax-validator.ts` | Static analysis of deprecated patterns and common errors       |

## Data Flow

### Search (hosted mode)

```
Query → Hosted API → OpenAI embedding → Vectorize → Results
```

### Search (local mode)

```
Query → OpenAI embedding → ChromaDB query → Results
```

### Contract Compilation

```
Code → Hosted compiler service → Compiler output (or fallback to static analysis)
```

### Contract Analysis

```
Code → Parser → Structure extraction → Pattern detection → Security checks → Report
```

### Resource Read

```
URI → Map to provider → Fetch from GitHub (cached) → Content
```

## File Structure

```
src/
├── bin.ts             # CLI entry point (→ ./dist/bin.js)
├── index.ts           # Library entry point
├── server.ts          # MCP server, request handlers
├── tools/
│   ├── index.ts       # Barrel export of allTools
│   ├── validation.ts  # Tool validation utilities
│   ├── repository.ts  # Repository aliases (shared)
│   ├── search/        # Search tools (4)
│   ├── analyze/       # Analysis tools (2)
│   ├── diff/          # Diff tool (1)
│   ├── format/        # Format tool (1)
│   ├── repository/    # Repository tools (8, including compound)
│   ├── health/        # Health tools (4)
│   └── meta/          # Discovery tools (3)
├── resources/
│   ├── index.ts       # Barrel export
│   ├── docs.ts        # Documentation URIs (2)
│   ├── schemas.ts     # Schema URIs (3)
│   └── content/       # Embedded content files
├── services/
│   ├── compiler.ts    # Hosted compiler integration
│   └── syntax-validator.ts # Compact syntax validation
├── pipeline/
│   ├── github.ts      # GitHub API client
│   ├── parser.ts      # Compact/TS parsing
│   └── indexer.ts     # Indexing orchestration
├── db/
│   └── vectorStore.ts # ChromaDB client
├── types/
│   └── mcp.ts         # Extended MCP types
└── utils/
    ├── config.ts      # Configuration (Zod schema)
    ├── cache.ts       # TTL cache with lazy pruning
    ├── errors.ts      # MCPError, createErrorResponse()
    ├── hosted-api.ts  # Hosted API client + telemetry
    ├── health.ts      # Health check utilities
    ├── version.ts     # Shared CURRENT_VERSION constant
    ├── logger.ts      # Structured JSON logging to stderr
    ├── rate-limit.ts  # Rate limiting
    ├── serializer.ts  # YAML/JSON serialization
    ├── validation.ts  # Input validation
    └── index.ts       # Barrel exports
```

## Graceful Degradation

| Service unavailable | Behavior                                              |
| ------------------- | ----------------------------------------------------- |
| Hosted API down     | Falls back to local mode if configured                |
| Compiler service    | Falls back to static analysis                         |
| OpenAI API key      | Search disabled                                       |
| ChromaDB            | Search returns empty                                  |
| GitHub token        | 60 req/hr limit (vs 5000 with token)                  |

## Security

- Read-only: no write operations
- Secrets in env vars, never logged
- Input validation via Zod
- Rate limiting respected
- Local mode: data stays on your machine

---

## Technical Details

### Transport

stdio transport (default) or HTTP with SSE, JSON-RPC 2.0:

```typescript
// stdio (default, for Claude Desktop)
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
const transport = new StdioServerTransport();
await server.connect(transport);
```

### Compact Parser

Regex-based extraction from `src/pipeline/parser.ts`:

```typescript
const ledgerRegex = /ledger\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/gs;
const circuitRegex =
  /(?:export\s+)?(circuit)\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*(\w+))?\s*\{/g;
const witnessRegex =
  /(?:export\s+)?(witness)\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*(\w+))?\s*\{/g;
```

Extracts:

- `ledger { }` blocks with fields
- `circuit` and `witness` functions with params/return types
- `export` declarations
- `include` statements

### Embeddings (Local Mode)

Model: `text-embedding-3-small` (1536 dimensions)

Chunking strategy:

1. **Code units** (preferred): each function/circuit/witness = one chunk
2. **File chunks** (fallback): 2000 chars, 5-line overlap

### GitHub Integration

Rate limits:

- With token: 5000 req/hr
- Without token: 60 req/hr

### Logging

Structured JSON logs to stderr (avoids stdio interference):

```typescript
console.error(
  JSON.stringify({
    level,
    message,
    ...meta,
    timestamp: new Date().toISOString(),
  })
);
```

Levels: `debug`, `info`, `warn`, `error`. Set via `LOG_LEVEL` env var.

### Environment Variables

| Variable             | Required | Default                 | Description                                          |
| -------------------- | -------- | ----------------------- | ---------------------------------------------------- |
| `GITHUB_TOKEN`       | No       | -                       | GitHub PAT                                           |
| `OPENAI_API_KEY`     | No       | -                       | For local mode embeddings                            |
| `CHROMA_URL`         | No       | `http://localhost:8000` | ChromaDB endpoint                                    |
| `MIDNIGHT_LOCAL`     | No       | `false`                 | Enable local mode                                    |
| `MIDNIGHT_API_URL`   | No       | _(production URL)_      | Override hosted API                                  |
| `LOG_LEVEL`          | No       | `info`                  | Logging verbosity                                    |
| `MIDNIGHT_TELEMETRY` | No       | _(enabled)_             | Set to `false` or `0` to disable telemetry           |
| `DO_NOT_TRACK`       | No       | -                       | Set to `1` to disable telemetry (standard)           |
| `EMBEDDING_MODEL`    | No       | `text-embedding-3-small`| OpenAI embedding model (local mode)                  |
| `SYNC_INTERVAL`      | No       | `900000`                | Indexing sync interval in ms (15 min)                |
| `PORT`               | No       | `3000`                  | HTTP server port                                     |
| `DATA_DIR`           | No       | `./data`                | Data directory                                       |
| `CACHE_DIR`          | No       | `./cache`               | Cache directory                                      |

### Build

TypeScript config:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "strict": true,
    "noUncheckedIndexedAccess": true
  }
}
```

NPM package:

```json
{
  "name": "midnight-mcp",
  "version": "0.2.17",
  "bin": { "midnight-mcp": "./dist/bin.js" },
  "type": "module"
}
```

### Testing & Quality

Vitest with coverage thresholds (70% statements/functions/lines, 65% branches):

```bash
npm test              # Run tests
npm run test:coverage # With coverage report
npm run lint          # ESLint (typescript-eslint, no-explicit-any = error)
npm run typecheck     # TypeScript strict mode
```
