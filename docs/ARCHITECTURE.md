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
│  │ 29 Tools   │  │ 9 Resources │  │ 5 Prompts  │                │
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

### Indexed for Semantic Search (24)

All public Midnight repositories are indexed (~26,000 documents):

| Category            | Repositories                                                                        |
| ------------------- | ----------------------------------------------------------------------------------- |
| Core Language & SDK | compact, midnight-js, midnight-wallet, midnight-dapp-connector-api                  |
| Infrastructure      | midnight-node, midnight-indexer, midnight-ledger, midnight-zk                       |
| Documentation       | midnight-docs (incl. blog, /compact, API ref), midnight-improvement-proposals       |
| Examples            | example-counter, example-bboard, example-dex, midnight-awesome-dapps, create-mn-app |
| ZK & Cryptography   | halo2, midnight-trusted-setup                                                       |
| Developer Tools     | compact-tree-sitter, compact-zed, setup-compact-action, midnight-node-docker        |
| Community           | contributor-hub, night-token-distribution                                           |
| Third-Party         | OpenZeppelin/compact-contracts                                                      |

### Available via GitHub Tools (16)

Additional repositories accessible via `midnight-get-file` and other GitHub tools:

| Repository                    | Contents              |
| ----------------------------- | --------------------- |
| `example-dex`                 | DEX example           |
| `create-mn-app`               | CLI scaffolding       |
| `midnight-wallet`             | Wallet implementation |
| `midnight-indexer`            | Blockchain indexer    |
| `midnight-node-docker`        | Node Docker configs   |
| `midnight-dapp-connector-api` | DApp connector API    |
| `compact-tree-sitter`         | Tree-sitter grammar   |
| `midnight-awesome-dapps`      | Community DApp list   |
| `contributor-hub`             | Contributor resources |

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
├── index.ts           # Entry point
├── server.ts          # MCP server, request handlers
├── tools/
│   ├── search.ts      # Search tools (3)
│   ├── analyze.ts     # Analysis tools (2)
│   └── repository.ts  # GitHub tools (11)
├── resources/
│   ├── docs.ts        # Documentation URIs
│   ├── code.ts        # Code examples URIs
│   └── schemas.ts     # Schema URIs
├── prompts/
│   └── templates.ts   # Prompt definitions
├── pipeline/
│   ├── github.ts      # GitHub API client
│   ├── parser.ts      # Compact/TS parsing
│   └── indexer.ts     # Indexing orchestration
├── db/
│   └── vectorStore.ts # ChromaDB client
└── utils/
    ├── config.ts      # Configuration
    ├── cache.ts       # TTL cache with lazy pruning
    ├── errors.ts      # MCPError, createErrorResponse()
    ├── hosted-api.ts  # Hosted API client
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

| Variable         | Required | Default                 | Description         |
| ---------------- | -------- | ----------------------- | ------------------- |
| `GITHUB_TOKEN`   | No       | -                       | GitHub PAT          |
| `OPENAI_API_KEY` | No       | -                       | For local mode      |
| `CHROMA_URL`     | No       | `http://localhost:8000` | ChromaDB endpoint   |
| `MIDNIGHT_LOCAL` | No       | `false`                 | Enable local mode   |
| `HOSTED_API_URL` | No       | (production URL)        | Override hosted API |
| `LOG_LEVEL`      | No       | `info`                  | Logging verbosity   |

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
  "bin": { "midnight-mcp": "./dist/index.js" },
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
