# Midnight MCP Server

[![npm version](https://badge.fury.io/js/midnight-mcp.svg)](https://www.npmjs.com/package/midnight-mcp)
[![npm downloads](https://img.shields.io/npm/dm/midnight-mcp)](https://www.npmjs.com/package/midnight-mcp)
[![License](https://img.shields.io/npm/l/midnight-mcp)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)](https://www.typescriptlang.org/)
[![CI](https://github.com/Olanetsoft/midnight-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Olanetsoft/midnight-mcp/actions/workflows/ci.yml)

MCP server that gives AI assistants access to Midnight blockchain—search contracts, analyze code, and explore documentation.

## Requirements

- **Node.js 20+** (LTS recommended)

Check your version: `node --version`

<details>
<summary><strong>Using nvm?</strong> Click for Claude Desktop setup</summary>

If you use nvm, Claude Desktop may not see your nvm-managed Node. Use this config instead:

```json
{
  "mcpServers": {
    "midnight": {
      "command": "/bin/sh",
      "args": [
        "-c",
        "source ~/.nvm/nvm.sh && nvm use 20 >/dev/null 2>&1 && npx -y midnight-mcp@latest"
      ]
    }
  }
}
```

</details>

## Quick Start

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "midnight": {
      "command": "npx",
      "args": ["-y", "midnight-mcp@latest"]
    }
  }
}
```

**Config file locations:**

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

### Cursor

One-click install:

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en-US/install-mcp?name=midnight&config=eyJjb21tYW5kIjoibnB4IC15IG1pZG5pZ2h0LW1jcEBsYXRlc3QifQ==)

Or manually add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "midnight": {
      "command": "npx",
      "args": ["-y", "midnight-mcp@latest"]
    }
  }
}
```

### VS Code Copilot

Add to `.vscode/mcp.json` or use Command Palette: `MCP: Add Server` → "command (stdio)" → `npx -y midnight-mcp@latest`

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "midnight": {
      "command": "npx",
      "args": ["-y", "midnight-mcp@latest"]
    }
  }
}
```

**No API keys required.** Restart your editor after adding the config.

> **Why `@latest`?** Unlike cached npx packages that never auto-update, `@latest` ensures you get new features and fixes on each restart. If upgrading from an older config without `@latest`, also clear your npx cache: `rm -rf ~/.npm/_npx`

---

## What's Included

### 28 Tools

| Category          | Tools                                                                                                                             | Description                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **Search**        | `search-compact`, `search-typescript`, `search-docs`, `fetch-docs`                                                                | Semantic search + live docs fetching             |
| **Analysis**      | `analyze-contract`, `explain-circuit`, `extract-contract-structure`                                                               | Static analysis with 15+ checks (P0-P2 severity) |
| **Repository**    | `get-file`, `list-examples`, `get-latest-updates`                                                                                 | Access files and examples                        |
| **Versioning**    | `get-version-info`, `check-breaking-changes`, `get-migration-guide`, `get-file-at-version`, `compare-syntax`, `get-latest-syntax` | Version tracking and migration                   |
| **AI Generation** | `generate-contract`, `review-contract`, `document-contract`                                                                       | AI-powered code generation _(requires sampling)_ |
| **Compound**      | `upgrade-check`, `get-repo-context`                                                                                               | Multi-step operations _(saves 50-70% tokens)_    |
| **Health**        | `health-check`, `get-status`, `check-version`                                                                                     | Server status and version checking               |
| **Discovery**     | `list-tool-categories`, `list-category-tools`, `suggest-tool`                                                                     | Explore available tools and get recommendations  |

All tools are prefixed with `midnight-` (e.g., `midnight-search-compact`).

### MCP Capabilities

| Capability      | Feature                                         |
| --------------- | ----------------------------------------------- |
| **Tools**       | 28 tools with `listChanged` notifications       |
| **Resources**   | 9 embedded resources with subscription support  |
| **Prompts**     | 5 workflow prompts                              |
| **Logging**     | Client-controllable log level                   |
| **Completions** | Autocomplete for prompt arguments               |
| **Progress**    | Real-time progress for compound tools           |
| **Sampling**    | AI-powered generation (when client supports it) |

### 9 Embedded Resources

Quick references available offline:

- Compact syntax guide (v0.16-0.18)
- SDK API reference
- OpenZeppelin contracts
- Tokenomics overview
- Wallet integration
- Common errors & solutions

### Static Analysis

`extract-contract-structure` catches common mistakes before compilation:

| Check                     | Severity | Description                                             |
| ------------------------- | -------- | ------------------------------------------------------- |
| `deprecated_ledger_block` | P0       | Catches `ledger { }` → use `export ledger field: Type;` |
| `invalid_void_type`       | P0       | Catches `Void` → use `[]` (empty tuple)                 |
| `invalid_pragma_format`   | P0       | Catches old pragma → use `>= 0.16 && <= 0.18`           |
| `unexported_enum`         | P1       | Enums need `export` for TypeScript access               |
| `module_level_const`      | P0       | Use `pure circuit` instead                              |
| + 10 more checks          | P1-P2    | Overflow, division, assertions, etc.                    |

### 5 Prompts

- `create-contract` — Generate new contracts
- `review-contract` — Security and code review
- `explain-concept` — Learn Midnight concepts
- `compare-approaches` — Compare implementation patterns
- `debug-contract` — Troubleshoot issues

---

## Indexed Repositories

The API indexes **39 Midnight repositories**:

| Category              | Repositories                                                                                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Core**              | `compact`, `midnight-js`, `midnight-wallet`, `midnight-docs`, `midnight-node`, `midnight-indexer`, `midnight-ledger`, `midnight-zk`                                    |
| **Examples**          | `example-counter`, `example-bboard`, `example-dex`, `create-mn-app`                                                                                                    |
| **Infrastructure**    | `midnight-node-docker`, `midnight-dapp-connector-api`, `compact-tree-sitter`, `setup-compact-action`                                                                   |
| **Partner Libraries** | `OpenZeppelin/compact-contracts`, `OpenZeppelin/midnight-apps` (LunarSwap)                                                                                             |
| **Official Partners** | `bricktowers/midnight-seabattle`, `bricktowers/midnight-identity`, `bricktowers/midnight-rwa`, `MeshJS/midnight-starter-template`, `midnames/core`                     |
| **Core Partner**      | `PaimaStudios/midnight-game-2`, `PaimaStudios/midnight-wasm-prover`, `PaimaStudios/midnight-batcher`, `PaimaStudios/midnight-impact-rps-example`                       |
| **Hackathon Winners** | Sea Battle: `ErickRomeroDev/naval-battle-game_v2`, `eddex/midnight-sea-battle-hackathon` • Mini DApp: `statera-protocol`, `nel349/midnight-bank`, `Imdavyking/zkbadge` |

---

## Advanced Configuration

### HTTP Mode

Run as an HTTP server for web integrations or remote deployment:

```bash
# Start HTTP server on port 3000
npx midnight-mcp --http --port 3000
```

Endpoints:

- `/health` - Health check
- `/mcp` - Streamable HTTP (MCP protocol)
- `/sse` - Server-Sent Events

### CLI Options

```bash
npx midnight-mcp --help

Options:
  --stdio          Use stdio transport (default, for Claude Desktop)
  --http           Use HTTP transport with SSE support
  --port <number>  HTTP port (default: 3000)
  --json           Output in JSON (default: YAML for better LLM efficiency)
  --github-token   GitHub token (overrides GITHUB_TOKEN env var)
  -h, --help       Show help
  -v, --version    Show version
```

> **Why YAML by default?** YAML is ~20-30% more token-efficient than JSON, which means AI assistants can process more context from tool responses.

### Local Mode

Run everything locally for privacy or offline use:

```json
{
  "mcpServers": {
    "midnight": {
      "command": "npx",
      "args": ["-y", "midnight-mcp@latest"],
      "env": {
        "MIDNIGHT_LOCAL": "true",
        "OPENAI_API_KEY": "sk-...",
        "CHROMA_URL": "http://localhost:8000"
      }
    }
  }
}
```

Requires ChromaDB (`docker run -d -p 8000:8000 chromadb/chroma`) and OpenAI API key.

### GitHub Token

Add `"GITHUB_TOKEN": "ghp_..."` for higher GitHub API rate limits (60 → 5000 requests/hour).

---

## Developer Setup

```bash
git clone https://github.com/Olanetsoft/midnight-mcp.git && cd midnight-mcp
npm install && npm run build && npm test
```

The hosted API runs on Cloudflare Workers + Vectorize. See [api/README.md](./api/README.md) for backend details.

---

## Links

- [Midnight Docs](https://docs.midnight.network)
- [MCP Spec](https://modelcontextprotocol.io)
- [Midnight GitHub](https://github.com/midnightntwrk)

## License

MIT

## Stargazers ⭐️

[![Star History Chart](https://api.star-history.com/svg?repos=Olanetsoft/midnight-mcp&type=Date)](https://star-history.com/#Olanetsoft/midnight-mcp&Date)
