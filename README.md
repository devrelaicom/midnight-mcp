# Midnight MCP Server

[![npm version](https://badge.fury.io/js/midnight-mcp.svg)](https://www.npmjs.com/package/midnight-mcp)
[![npm downloads](https://img.shields.io/npm/dm/midnight-mcp)](https://npm-stat.com/charts.html?package=midnight-mcp)
[![License](https://img.shields.io/npm/l/midnight-mcp)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript)](https://www.typescriptlang.org/)
[![CI](https://github.com/Olanetsoft/midnight-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Olanetsoft/midnight-mcp/actions/workflows/ci.yml)

MCP server that gives AI assistants access to Midnight blockchain — search contracts, analyze code, compile Compact, simulate deployments, and explore documentation.

**No API keys required.** Install, restart your editor, and go.

## Setup

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

### Claude Code

```bash
claude mcp add midnight -- npx -y midnight-mcp@latest
```

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

Add to `.vscode/mcp.json` or use Command Palette: `MCP: Add Server` > "command (stdio)" > `npx -y midnight-mcp@latest`

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

Restart your editor after adding the config.

> **Why `@latest`?** Unlike cached npx packages that never auto-update, `@latest` ensures you get new features and fixes on each restart. If upgrading from an older config without `@latest`, also clear your npx cache: `rm -rf ~/.npm/_npx`

### Requirements

- **Node.js 24.14.0+** — check your version with `node --version`

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
        "source ~/.nvm/nvm.sh && nvm use 24 >/dev/null 2>&1 && npx -y midnight-mcp@latest"
      ]
    }
  }
}
```

</details>

---

## Tools

32 tools across 7 categories, all prefixed with `midnight-` (e.g., `midnight-search-compact`).

| Category       | Tools                                                                                                          | What they do                          |
| -------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Search**     | `search-compact`, `search-typescript`, `search-docs`, `fetch-docs`                                             | Semantic search + live docs fetching  |
| **Analysis**   | `analyze-contract`, `compile-contract`, `visualize-contract`, `prove-contract`, `compile-archive`              | Static analysis, real compilation, visualization |
| **Code**       | `format-contract`, `diff-contracts`                                                                            | Format code + semantic diffing        |
| **Simulation** | `simulate-deploy`, `simulate-call`, `simulate-state`, `simulate-delete`                                        | Interactive contract simulation       |
| **Repository** | `get-file`, `list-examples`, `get-latest-updates`, `check-breaking-changes`, `get-file-at-version`, `compare-syntax` | Browse files and track version changes |
| **Compound**   | `upgrade-check`, `get-repo-context`                                                                            | Multi-step operations _(saves 50-70% tokens)_ |
| **Health**     | `health-check`, `get-status`, `check-version`, `get-update-instructions`, `list-compiler-versions`, `list-libraries` | Server status and version info        |
| **Discovery**  | `list-tool-categories`, `list-category-tools`, `suggest-tool`                                                  | Explore available tools               |

### Real Contract Compilation

The `midnight-compile-contract` tool validates Compact code using a hosted compiler service:

```
Compilation successful (Compiler v0.18.0) in 2841ms
```

- **Fast mode** (`skipZk=true`): Syntax validation in ~1-2 seconds
- **Full mode** (`fullCompile=true`): Complete ZK circuit generation in ~10-30 seconds
- **Automatic fallback**: Falls back to static analysis if the compiler service is unavailable

---

## Configuration

### GitHub Token (optional)

Add a `GITHUB_TOKEN` for higher GitHub API rate limits (60 > 5,000 requests/hour):

```json
{
  "mcpServers": {
    "midnight": {
      "command": "npx",
      "args": ["-y", "midnight-mcp@latest"],
      "env": {
        "GITHUB_TOKEN": "ghp_..."
      }
    }
  }
}
```

### HTTP Mode

Run as a local HTTP server for tool integrations on your development machine:

```bash
npx midnight-mcp --http --port 3000
```

The server binds to `127.0.0.1` (localhost only). Endpoints: `/health`, `/mcp` (Streamable HTTP), `/sse` (Server-Sent Events)

### Operating Modes

By default, the MCP server runs in **hosted mode** — all search, analysis, and compilation requests are sent to the production Cloudflare Workers API (`midnight-mcp-api.midnightmcp.workers.dev`). No local infrastructure is needed.

To point at a different API endpoint (e.g., staging), set `MIDNIGHT_API_URL`:

```json
"env": { "MIDNIGHT_API_URL": "https://your-staging-api.workers.dev" }
```

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

Requires ChromaDB (`docker run -d -p 8000:8000 chromadb/chroma`) and an OpenAI API key.

### All Environment Variables

| Variable             | Default                 | Description                                          |
| -------------------- | ----------------------- | ---------------------------------------------------- |
| `GITHUB_TOKEN`       | -                       | GitHub PAT for higher rate limits                    |
| `OPENAI_API_KEY`     | -                       | Required for local mode                              |
| `CHROMA_URL`         | `http://localhost:8000` | ChromaDB endpoint (local mode)                       |
| `MIDNIGHT_LOCAL`     | `false`                 | Enable local mode                                    |
| `MIDNIGHT_API_URL`   | _(production URL)_      | Override the hosted API endpoint                     |
| `LOG_LEVEL`          | `info`                  | Logging verbosity (`debug`, `info`, `warn`, `error`) |
| `MIDNIGHT_TELEMETRY` | _(enabled)_             | Set to `false` or `0` to disable telemetry           |
| `DO_NOT_TRACK`       | -                       | Set to `1` to disable telemetry (standard)           |

### CLI Options

```bash
npx midnight-mcp --help

Options:
  --http           Use HTTP transport with SSE support
  --port <number>  HTTP port (default: 3000)
  --json           Output in JSON (default: YAML for better LLM efficiency)
  --github-token   GitHub token (overrides GITHUB_TOKEN env var)
  -h, --help       Show help
  -v, --version    Show version
```

Stdio is the default transport when no flags are provided.

---

## Troubleshooting

### Stale npx Cache

If you're not seeing the latest version:

```bash
rm -rf ~/.npm/_npx
```

Then restart your editor.

### Server Won't Start

- Check your Node.js version: `node --version` (requires 24.14.0+)
- If using nvm, see the [nvm setup](#requirements) in Requirements

### Search Returns Empty Results

- Run `midnight-health-check` to check service status
- If `hostedApi: false`: the hosted API may be temporarily unavailable
- If using local mode: ensure ChromaDB is running and `OPENAI_API_KEY` is set

### Repository Tools Failing

- Usually caused by GitHub API rate limiting (60 requests/hour without a token)
- Add a `GITHUB_TOKEN` to increase to 5,000 requests/hour

### Graceful Degradation

The server keeps working when backend services are unavailable:

| Service unavailable | Behavior                                              |
| ------------------- | ----------------------------------------------------- |
| Hosted API down     | Falls back to local mode if configured                |
| Compiler service    | Falls back to static analysis                         |
| OpenAI API key      | Search tools disabled                                 |
| ChromaDB            | Search returns empty results                          |
| GitHub token        | Works with 60 req/hr anonymous limit                  |

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, project structure, and PR guidelines.

The hosted API backend runs on Cloudflare Workers + Vectorize. See [api/README.md](./api/README.md) for backend deployment.

## Links

- [Midnight Docs](https://docs.midnight.network)
- [MCP Spec](https://modelcontextprotocol.io)
- [Midnight GitHub](https://github.com/midnightntwrk)

## License

MIT

## Stargazers

[![Star History Chart](https://api.star-history.com/svg?repos=Olanetsoft/midnight-mcp&type=Date)](https://star-history.com/#Olanetsoft/midnight-mcp&Date)
