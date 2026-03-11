# Architecture

## System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        MCP Client                                │
│                (Claude Desktop, Cursor, etc.)                    │
└──────────────────────────────────────────────────────────────────┘
                              │
                              │ JSON-RPC 2.0 / stdio
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                      midnight-mcp                                │
│  ┌────────────┐  ┌─────────────┐  ┌────────────┐                │
│  │ 30 Tools   │  │ 9 Resources │  │ 5 Prompts  │                │
│  └────────────┘  └─────────────┘  └────────────┘                │
└──────────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
    │ Hosted API  │    │   GitHub    │    │   Parser    │
    │  (default)  │    │  (Octokit)  │    │  (Compact)  │
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

## Repositories

### Indexed for Semantic Search (102)

All non-archived Midnight repositories are indexed (~26,000 documents) via the hosted API. See `api/README.md` for the full list.

| Category             | Count | Key Repositories                                                            |
| -------------------- | ----- | --------------------------------------------------------------------------- |
| Compact Language     | 6     | `compact`, `compact-lsp`, `compact-tree-sitter`, `compact-zed`              |
| SDKs & APIs          | 5     | `midnight-js`, `midnight-sdk`, `midnight-wallet`, `midnight-dapp-connector` |
| Core Infrastructure  | 9     | `midnight-node`, `midnight-indexer`, `midnight-ledger`, `midnight-zk`       |
| ZK & Cryptography    | 6     | `midnight-trusted-setup`, `fri`, `galois_recursion`, `pluto_eris`           |
| Documentation        | 5     | `midnight-docs`, `midnight-improvement-proposals`, `midnight-architecture`  |
| Examples & Templates | 8     | `example-counter`, `example-bboard`, `example-dex`, `example-DAO`           |
| Identity             | 5     | `midnight-did`, `midnight-did-resolver`, `midnight-verifiable-credentials`  |
| Contracts & Bridges  | 3     | `midnight-contracts`, `midnight-committee-bridge-contracts`                 |
| Developer Tools      | 4     | `setup-compact-action`, `upload-sarif-github-action`, `midnight-dev-utils`  |
| Infrastructure       | 6     | `midnight-monitoring`, `midnight-tracing`, `midnight-operations`            |
| Solutions & Apps     | 7     | `midnight-solutions`, `midnight-website-next`, `nightcap`, `ocp`            |
| Community            | 3     | `contributor-hub`, `lfdt-project-proposals`                                 |
| Glacier Drop         | 15    | `midnight-glacier-drop-tools`, `gd-claim-api`, `gd-claim-portal`            |
| Partners             | 14    | OpenZeppelin, BrickTowers, MeshJS, PaimaStudios, hackathon winners          |

### Available via GitHub Tools

All indexed repositories plus any public GitHub repository accessible via `midnight-get-file` and other GitHub tools.

## Components

### Tools (`src/tools/`)

| Tool                                  | Purpose                                        |
| ------------------------------------- | ---------------------------------------------- |
| `midnight-search-compact`             | Semantic search over Compact code              |
| `midnight-search-typescript`          | Semantic search over TypeScript SDK            |
| `midnight-search-docs`                | Semantic search over documentation             |
| `midnight-fetch-docs`                 | Live fetch from docs.midnight.network (SSG)    |
| `midnight-analyze-contract`           | Static analysis: structure, patterns, security |
| `midnight-explain-circuit`            | Explain circuit logic and ZK implications      |
| `midnight-get-file`                   | Fetch file from GitHub                         |
| `midnight-list-examples`              | List example contracts                         |
| `midnight-get-latest-updates`         | Recent commits                                 |
| `midnight-get-version-info`           | Latest release info                            |
| `midnight-check-breaking-changes`     | Breaking changes since version X               |
| `midnight-get-migration-guide`        | Upgrade guide between versions                 |
| `midnight-get-file-at-version`        | File content at specific tag                   |
| `midnight-compare-syntax`             | Diff file between versions                     |
| `midnight-get-latest-syntax`          | Canonical syntax reference                     |
| `midnight-health-check`               | Server health                                  |
| `midnight-get-status`                 | Rate limits, cache stats                       |
| `midnight-check-version`              | Check for server updates                       |
| `midnight-auto-update-config`         | Auto-update MCP client config                  |
| `midnight-generate-contract`          | AI-generate contracts from natural language    |
| `midnight-review-contract`            | AI-powered security review                     |
| `midnight-document-contract`          | AI-generate documentation                      |
| `midnight-upgrade-check`              | Compound: breaking changes + migration guide   |
| `midnight-get-repo-context`           | Compound: repo context for AI assistants       |
| `midnight-extract-contract-structure` | Extract AST, functions, state from Compact     |
| `midnight-list-tool-categories`       | List available tool categories                 |
| `midnight-list-category-tools`        | List tools in a category                       |
| `midnight-suggest-tool`               | AI-suggest best tool for a task                |

### Advanced MCP Features (v0.1.0+)

**Tool Annotations**: All tools include behavioral hints:

- `readOnlyHint` - Tool doesn't modify state
- `idempotentHint` - Safe to retry
- `openWorldHint` - May return external data
- `longRunningHint` - May take time

**Output Schemas**: JSON schemas for structured tool outputs.

**Resource Templates** (RFC 6570):

- `midnight://code/{owner}/{repo}/{path}` - Any code file
- `midnight://docs/{section}/{topic}` - Documentation
- `midnight://examples/{category}/{name}` - Example contracts
- `midnight://schema/{type}` - JSON schemas

**Sampling**: Server can request LLM completions via client (for AI tools).

**Subscriptions**: Subscribe to resource change notifications.

### Resources (`src/resources/`)

Accessible via `midnight://` URIs:

**Documentation**

- `midnight://docs/compact-reference`
- `midnight://docs/sdk-api`
- `midnight://docs/concepts/zero-knowledge`
- `midnight://docs/concepts/shielded-state`
- `midnight://docs/concepts/witnesses`
- `midnight://docs/concepts/kachina`

**Code**

- `midnight://code/examples/counter`
- `midnight://code/examples/bboard`
- `midnight://code/patterns/state-management`
- `midnight://code/patterns/access-control`
- `midnight://code/patterns/privacy-preserving`
- `midnight://code/templates/token`
- `midnight://code/templates/voting`

**Schemas**

- `midnight://schema/compact-ast`
- `midnight://schema/transaction`
- `midnight://schema/proof`

### Prompts (`src/prompts/`)

| Prompt                        | Use case                 |
| ----------------------------- | ------------------------ |
| `midnight-create-contract`    | New contract scaffolding |
| `midnight-review-contract`    | Security review          |
| `midnight-explain-concept`    | Learn Midnight concepts  |
| `midnight-compare-approaches` | Compare implementations  |
| `midnight-debug-contract`     | Debug contract issues    |

## Data Flow

### Search (hosted mode)

```
Query → Hosted API → Vector search → Results
```

### Search (local mode)

```
Query → OpenAI embedding → ChromaDB query → Results
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
│   ├── search/        # Search tools (4): compact, typescript, docs, fetch-docs
│   ├── analyze/       # Analysis tools (3): analyze, explain-circuit, compile
│   ├── repository/    # GitHub tools (11): get-file, versions, migrations, etc.
│   ├── generation/    # AI generation tools (3): generate, review, document
│   ├── health/        # Health tools (5): health-check, status, version, update
│   └── meta/          # Discovery tools (3): list-categories, list-tools, suggest
├── resources/
│   ├── docs.ts        # Documentation URIs
│   ├── code.ts        # Code examples URIs
│   └── schemas.ts     # Schema URIs
├── prompts/
│   └── templates.ts   # Prompt definitions
├── services/
│   └── sampling.ts    # LLM sampling service
├── pipeline/
│   ├── github.ts      # GitHub API client
│   ├── parser.ts      # Compact/TS parsing
│   └── indexer.ts     # Indexing orchestration
├── db/
│   └── vectorStore.ts # ChromaDB client
├── types/
│   └── mcp.ts         # Extended MCP types
└── utils/
    ├── config.ts      # Configuration
    ├── cache.ts       # TTL cache with lazy pruning
    ├── errors.ts      # MCPError, createErrorResponse()
    ├── hosted-api.ts  # Hosted API client
    ├── health.ts      # Health check utilities
    ├── version.ts     # Shared version constant
    ├── logger.ts      # Logging
    └── index.ts       # Barrel exports
```

## Graceful Degradation

| Missing         | Behavior                               |
| --------------- | -------------------------------------- |
| Hosted API down | Falls back to local mode if configured |
| OpenAI API key  | Search disabled                        |
| ChromaDB        | Search returns empty                   |
| GitHub token    | 60 req/hr limit (vs 5000 with token)   |

## Security

- Read-only: no write operations
- Secrets in env vars, never logged
- Input validation via Zod
- Rate limiting respected
- Local mode: data stays on your machine

---

## Technical Details

### Transport

stdio transport, JSON-RPC 2.0:

```typescript
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
const transport = new StdioServerTransport();
await server.connect(transport);
```

Request format:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "midnight-analyze-contract",
    "arguments": { "code": "..." }
  }
}
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

Output structure:

```typescript
interface ParsedFile {
  path: string;
  language: "compact" | "typescript" | "markdown";
  content: string;
  codeUnits: CodeUnit[];
  imports: string[];
  exports: string[];
  metadata: {
    hasLedger: boolean;
    hasCircuits: boolean;
    hasWitnesses: boolean;
    lineCount: number;
  };
}
```

### Embeddings (Local Mode)

Model: `text-embedding-3-small` (1536 dimensions)

Chunking strategy:

1. **Code units** (preferred): each function/circuit/witness = one chunk
2. **File chunks** (fallback): 2000 chars, 5-line overlap

```typescript
const response = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: text,
});
```

### ChromaDB (Local Mode)

Collection: `midnight-code`

Document schema:

```typescript
{
  ids: string[];
  embeddings: number[][];
  metadatas: Array<{
    repository: string;
    filePath: string;
    language: string;
    startLine: number;
    endLine: number;
    codeType: string;
    codeName: string;
    isPublic: boolean;
  }>;
  documents: string[];
}
```

Query:

```typescript
const results = await collection.query({
  queryEmbeddings: [queryVector],
  nResults: 10,
  where: { language: "compact" },
  include: ["documents", "metadatas", "distances"],
});
```

### GitHub Integration

Rate limits:

- With token: 5000 req/hr
- Without token: 60 req/hr

```typescript
const octokit = new Octokit({ auth: config.githubToken });

const response = await octokit.repos.getContent({ owner, repo, path, ref });
const content = Buffer.from(response.data.content, "base64").toString("utf-8");
```

### Logging

Logs to stderr (avoids stdio interference):

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

Levels: `debug`, `info`, `warn`, `error`

Set via `LOG_LEVEL` env var.

### Environment Variables

| Variable              | Required | Default                 | Description                              |
| --------------------- | -------- | ----------------------- | ---------------------------------------- |
| `GITHUB_TOKEN`        | No       | -                       | GitHub PAT                               |
| `OPENAI_API_KEY`      | No       | -                       | For local mode                           |
| `CHROMA_URL`          | No       | `http://localhost:8000` | ChromaDB endpoint                        |
| `MIDNIGHT_LOCAL`      | No       | `false`                 | Enable local mode                        |
| `HOSTED_API_URL`      | No       | (production URL)        | Override hosted API                      |
| `LOG_LEVEL`           | No       | `info`                  | Logging verbosity                        |
| `MIDNIGHT_TELEMETRY`  | No       | (enabled)               | Set to `false` or `0` to disable telemetry |
| `DO_NOT_TRACK`        | No       | -                       | Set to `1` to disable telemetry (standard) |

### Build

TypeScript config:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "strict": true
  }
}
```

NPM package:

```json
{
  "name": "midnight-mcp",
  "bin": { "midnight-mcp": "./dist/bin.js" },
  "type": "module"
}
```

### Testing & Quality

Vitest with coverage thresholds (70% statements/functions/lines, 65% branches):

```bash
npm test              # Run tests
npm run test:coverage # With coverage report
npm run lint          # ESLint (typescript-eslint)
npm run typecheck     # TypeScript strict mode
```
