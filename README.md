# Midnight MCP Server

[![npm version](https://badge.fury.io/js/midnight-mcp.svg)](https://www.npmjs.com/package/midnight-mcp)
[![npm downloads](https://img.shields.io/npm/dm/midnight-mcp)](https://npm-stat.com/charts.html?package=midnight-mcp)
[![License](https://img.shields.io/npm/l/midnight-mcp)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)](https://www.typescriptlang.org/)
[![CI](https://github.com/Olanetsoft/midnight-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Olanetsoft/midnight-mcp/actions/workflows/ci.yml)

MCP server that gives AI assistants access to Midnight blockchain—search contracts, analyze code, and explore documentation.

## Requirements

- **Node.js 25.8.1** recommended, with compatibility tested on **24.14.0** and **25.8.1**

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

### 23 Tools

| Category       | Tools                                                                                                          | Description                                   |
| -------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Search**     | `search-compact`, `search-typescript`, `search-docs`, `fetch-docs`                                             | Semantic search + live docs fetching          |
| **Analysis**   | `analyze-contract`, `compile-contract`                                                                         | Static analysis + real compilation            |
| **Code Tools** | `format-contract`, `diff-contracts`                                                                            | Format code + semantic diffing                |
| **Repository** | `get-file`, `list-examples`, `get-latest-updates`, `check-breaking-changes`, `get-file-at-version`, `compare-syntax` | Access files and track version changes   |
| **Compound**   | `upgrade-check`, `get-repo-context`                                                                            | Multi-step operations _(saves 50-70% tokens)_ |
| **Health**     | `health-check`, `get-status`, `check-version`, `get-update-instructions`                                       | Server status and version checking            |
| **Discovery**  | `list-tool-categories`, `list-category-tools`, `suggest-tool`                                                  | Explore available tools and get recommendations |

All tools are prefixed with `midnight-` (e.g., `midnight-search-compact`).

### Real Contract Compilation

The `midnight-compile-contract` tool validates Compact code using a hosted compiler service:

```
✅ Compilation successful (Compiler v0.18.0) in 2841ms
```

- **Fast mode** (`skipZk=true`): Syntax validation in ~1-2 seconds
- **Full mode** (`fullCompile=true`): Complete ZK circuit generation in ~10-30 seconds
- **Automatic fallback**: Falls back to static analysis if the compiler service is unavailable

This catches semantic errors that static analysis misses (sealed fields, disclose rules, type mismatches).

### MCP Capabilities

| Capability    | Feature                                        |
| ------------- | ---------------------------------------------- |
| **Tools**     | 23 tools with `listChanged` notifications      |
| **Resources** | 5 embedded resources with subscription support |
| **Logging**   | Client-controllable log level                  |
| **Progress**  | Real-time progress for compound tools          |

### 5 Embedded Resources

Quick references available offline:

- Compact syntax guide
- Tokenomics overview
- Compact AST schema
- Transaction schema
- ZK proof schema

---

## Indexed Repositories

The API indexes **102+ Midnight repositories** from the entire Midnight ecosystem:

| Category                 | Count | Key Repositories                                                                 |
| ------------------------ | ----- | -------------------------------------------------------------------------------- |
| **Compact Language**     | 6     | `compact`, `compact-lsp`, `compact-tree-sitter`, `compact-zed`                   |
| **SDKs & APIs**          | 5     | `midnight-js`, `midnight-sdk`, `midnight-wallet`, `midnight-dapp-connector`      |
| **Core Infrastructure**  | 9     | `midnight-node`, `midnight-indexer`, `midnight-ledger`, `midnight-zk`            |
| **ZK & Cryptography**    | 6     | `midnight-trusted-setup`, `fri`, `galois_recursion`, `pluto_eris`                |
| **Documentation**        | 5     | `midnight-docs`, `midnight-improvement-proposals`, `midnight-architecture`       |
| **Examples & Templates** | 8     | `example-counter`, `example-bboard`, `example-dex`, `example-DAO`                |
| **Identity**             | 5     | `midnight-did`, `midnight-did-resolver`, `midnight-verifiable-credentials`       |
| **Developer Tools**      | 4     | `setup-compact-action`, `upload-sarif-github-action`, `midnight-dev-utils`       |
| **Solutions & Apps**     | 7     | `midnight-solutions`, `midnight-website-next`, `nightcap`, `ocp`                 |
| **Glacier Drop**         | 15    | `midnight-glacier-drop-tools`, `gd-claim-api`, `gd-claim-portal`                 |
| **Partners**             | 14    | OpenZeppelin, BrickTowers, MeshJS, PaimaStudios, hackathon winners               |
| **Other**                | 18+   | Contracts, bridges, token distribution, monitoring, QA tools, community projects |

All **non-archived** repositories from the `midnightntwrk` organization plus community partners. See [api/README.md](api/README.md#indexed-repositories-102) for the complete list.

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

### Environment Variables

| Variable             | Required | Default                 | Description                                          |
| -------------------- | -------- | ----------------------- | ---------------------------------------------------- |
| `GITHUB_TOKEN`       | No       | -                       | GitHub PAT for higher rate limits                    |
| `OPENAI_API_KEY`     | No       | -                       | Required for local mode                              |
| `CHROMA_URL`         | No       | `http://localhost:8000` | ChromaDB endpoint (local mode)                       |
| `MIDNIGHT_LOCAL`     | No       | `false`                 | Enable local mode                                    |
| `MIDNIGHT_API_URL`   | No       | _(production URL)_      | Override the hosted API endpoint                     |
| `LOG_LEVEL`          | No       | `info`                  | Logging verbosity (`debug`, `info`, `warn`, `error`) |
| `MIDNIGHT_TELEMETRY` | No       | _(enabled)_             | Set to `false` or `0` to disable telemetry           |
| `DO_NOT_TRACK`       | No       | -                       | Set to `1` to disable telemetry (standard)           |

---

## Troubleshooting

### Graceful Degradation

The server is designed to keep working when backend services are unavailable:

| Service unavailable | Behavior                                              |
| ------------------- | ----------------------------------------------------- |
| Hosted API down     | Falls back to local mode if configured                |
| Compiler service    | Falls back to static analysis                         |
| OpenAI API key      | Search tools disabled                                 |
| ChromaDB            | Search returns empty results                          |
| GitHub token        | Works with 60 req/hr anonymous limit (vs 5000 with token) |

### Stale npx Cache

If you're not seeing the latest version after upgrading:

```bash
rm -rf ~/.npm/_npx
```

Then restart your editor. Using `midnight-mcp@latest` in your config prevents this for future updates.

### Server Won't Start

- Check your Node.js version: `node --version` (requires 24.14.0+)
- If using nvm, see the [nvm setup](#requirements) in Requirements

### Search Returns Empty Results

- Run `midnight-health-check` to check service status
- If `hostedApi: false`: the hosted API may be temporarily unavailable, or a firewall/proxy is blocking outbound requests
- If using local mode: ensure ChromaDB is running and `OPENAI_API_KEY` is set

### Repository Tools Failing

- Usually caused by GitHub API rate limiting (60 requests/hour without a token)
- Add a `GITHUB_TOKEN` to your MCP config to increase to 5000 requests/hour

---

## Developer Setup

```bash
git clone https://github.com/Olanetsoft/midnight-mcp.git && cd midnight-mcp
npm install && npm run build && npm test

# Lint & format
npm run lint          # ESLint (typescript-eslint)
npm run lint:fix      # Auto-fix lint issues
npm run format        # Prettier
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
