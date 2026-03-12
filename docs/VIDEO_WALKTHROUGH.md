# Midnight MCP Video Walkthrough Script

> **Note:** This script was written for an earlier version of midnight-mcp that included AI generation tools, prompts, and more embedded resources. The current version focuses on compile, analyze (AST), format, diff, search, and health tools. This script is kept for reference but is not current.

**Duration:** ~20-25 minutes
**Target Audience:** Developers interested in Midnight blockchain, MCP ecosystem, AI-assisted development

---

## Pre-Recording Checklist

- [ ] Claude Desktop open with fresh chat
- [ ] VS Code open with midnight-mcp repo
- [ ] Terminal ready
- [ ] Browser tab with https://docs.midnight.network
- [ ] Browser tab with https://npmjs.com/package/midnight-mcp
- [ ] Clear npx cache: `rm -rf ~/.npm/_npx`

---

## INTRO (1-2 min)

### Hook (30 sec)

> "What if your AI assistant could write smart contracts that actually compile - not just code that looks right, but code verified by the real compiler before you even see it?"

> "I built Midnight MCP - an open-source tool that gives Claude, Copilot, and other AI assistants deep knowledge of the Midnight blockchain. Today I'll show you exactly how it works."

### Quick Context (30 sec)

> "Midnight is a privacy-focused blockchain with its own smart contract language called Compact. The problem? AI assistants don't know Compact syntax. They hallucinate APIs, use wrong patterns, and generate code that fails at compile time."

> "Midnight MCP solves this by giving AI assistants access to indexed documentation, code examples, and now - a real compiler."

---

## SECTION 1: Why This MCP is Different (2-3 min)

### The MCP Landscape

> "There are hundreds of MCP servers out there. Most do one thing - wrap an API. Call OpenAI, query a database, fetch from an endpoint. That's useful, but limited."

### What Makes Midnight MCP Different

**1. Domain Expertise, Not Just API Wrapping**

> "This isn't a thin wrapper around a REST API. It's a complete knowledge base for a programming language that Claude doesn't know."

**2. Real Compiler Integration**

> "Most code-generation MCPs just pattern match and hope. We actually compile the code before showing it to you. If it fails, the AI fixes it automatically."

**3. 102 Repositories Indexed**

> "We've semantically indexed every non-archived repo in the Midnight ecosystem. Documentation, examples, SDKs, tools - all searchable by meaning, not just keywords."

**4. Graceful Degradation**

> "If our hosted services are down, it falls back to static analysis. If GitHub rate limits hit, it uses cached data. The tool never just breaks."

**5. Token Efficiency**

> "Compound tools combine multiple operations. One call to `upgrade-check` does what would take 3-4 separate calls. We output YAML by default because it's 20-30% more token-efficient than JSON."

**6. Full MCP Spec Implementation**

> "Tools, Resources, Prompts, Sampling, Progress notifications, Completions - we implement the full MCP specification, not just the basics."

---

## SECTION 2: Installation & Setup (2 min)

### Show npm page

```
https://npmjs.com/package/midnight-mcp
```

> "One command, no API keys required."

### Open Claude Desktop config

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

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

> "Add these 6 lines, restart Claude, and you're connected."

### Show it's connected

- Open Claude Desktop
- Show the 🔧 tools icon
- Click to reveal "midnight-search-compact", "midnight-compile-contract", etc.

> "29 tools, 9 resources, 5 prompts - all available to Claude now."

---

## SECTION 3: The Problem Demo (2-3 min)

### Demo WITHOUT Midnight MCP (show failure)

Open a fresh Claude chat WITHOUT the MCP enabled:

> Prompt: "Write a Compact smart contract for a simple counter"

**Expected bad output:**

- Uses `ledger { }` block syntax (deprecated)
- Uses `Void` return type (doesn't exist)
- Missing pragma
- Wrong function syntax

> "Claude's training data is from 2024. Compact has evolved. This code won't compile."

### Show the actual error

Copy the generated code, try to explain why it fails:

> "The `ledger { }` block syntax was removed. `Void` should be `[]`. The pragma format is wrong. An actual developer would spend 30 minutes debugging this."

---

## SECTION 4: The Solution - Live Demo (5-6 min)

### Enable MCP and restart Claude

> "Now let's see the difference with Midnight MCP connected."

### Demo 1: Search Capability

> Prompt: "Search the Compact codebase for Counter examples"

**Tool called:** `midnight-search-compact`

> "It's searching 102 indexed Midnight repositories and returning actual code from the official examples."

### Demo 2: Generate a Contract

> Prompt: "Write me a token transfer contract in Compact"

**Watch the tools being called:**

1. `midnight-get-repo-context` - Gets syntax reference
2. `midnight-get-latest-syntax` - Gets current patterns
3. `midnight-search-compact` - Finds examples
4. **`midnight-compile-contract`** - Validates with real compiler

> "See that? It called the real Compact compiler. The code it's about to show me has been verified to compile."

**Show the response:**

```
success: true
message: ✅ Compilation successful (Compiler vX.X.X) in 7221ms
validationType: compiler
```

> "This is the game-changer. Before today, AI could only guess. Now it knows."

### Demo 3: Intentional Error

> Prompt: "Write a contract that uses `Void` as a return type"

**Watch the compiler catch it:**

```
success: false
message: Line 3:26 - unbound identifier Void
location: { line: 3, column: 26 }
```

> "The AI sees this error, fixes it automatically, and tries again. The user never sees broken code."

### Architecture Diagram (draw on screen or use slides)

```
┌──────────┐     ┌─────────────────┐     ┌──────────────────────┐
│  User    │◀───▶│  Claude/Copilot │◀───▶│  Midnight MCP Server │
└──────────┘     └─────────────────┘     └──────────┬───────────┘
                                                    │
                         ┌──────────────────────────┼──────────────────────────┐
                         │                          │                          │
                         ▼                          ▼                          ▼
              ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
              │  Cloudflare API  │    │  GitHub Repos    │    │  Compact         │
              │  (Vectorize)     │    │  (102 indexed)   │    │  Compiler        │
              └──────────────────┘    └──────────────────┘    └──────────────────┘
```

> "The MCP server runs locally via npx. It connects to three backends:"

1. **Cloudflare Vectorize** - Semantic search over indexed code
2. **GitHub** - Direct file access to 102 Midnight repos
3. **Hosted Compiler** - Real Compact compilation (new in v0.2.14)

### Show the code structure

```
src/
├── services/
│   ├── compiler.ts      ← NEW: Hosted compiler integration
│   └── sampling.ts      ← AI generation via MCP sampling
├── tools/
│   ├── search/          ← 4 search tools
│   ├── analyze/         ← 4 analysis tools (including compile)
│   ├── repository/      ← File access tools
│   └── meta/            ← Discovery tools
└── resources/           ← 9 embedded references
```

---

## SECTION 5: Complete Feature Walkthrough (6-8 min)

### Tool Categories (29 Tools Total)

> "Let me walk you through everything this MCP can do."

**🔍 Search Tools (4 tools)**

```
midnight-search-compact   - Search Compact language code
midnight-search-docs      - Search official documentation
midnight-search-typescript - Search TypeScript SDK code
midnight-fetch-docs       - Fetch live docs from docs.midnight.network
```

> Prompt: "Find code that handles shielded transactions"

> "It's not keyword matching - it understands semantic meaning and finds relevant code across all 102 repos."

**🔬 Analysis Tools (4 tools)**

```
midnight-analyze-contract  - 15 static security checks
midnight-review-contract   - AI-powered security review (uses sampling)
midnight-compile-contract  - Real compiler validation ← NEW
midnight-extract-contract-structure - Parse contract structure
```

> Prompt: "Analyze this contract for security issues"

> "15 static checks run instantly - catches deprecated patterns, missing assertions, unused witnesses, direct comparisons."

**📝 Generation Tools (2 tools)**

```
midnight-generate-contract - AI contract generation (uses sampling)
midnight-document-contract - Generate docs in Markdown/JSDoc
```

> "These use MCP sampling - the AI generates content, then validates it with the compiler automatically."

**📁 Repository Tools (8 tools)**

```
midnight-get-file          - Get file from any Midnight repo
midnight-get-file-at-version - Get file at specific version
midnight-compare-syntax    - Compare versions side-by-side
midnight-get-latest-syntax - Current Compact syntax reference
midnight-get-latest-updates - Recent changes across repos
midnight-get-repo-context  - COMPOUND: Everything to start coding
midnight-list-examples     - List example contracts
midnight-explain-circuit   - Explain circuit purpose
```

> Prompt: "What changed between Compact 0.16 and 0.18?"

> "It knows the version history and can guide migrations."

**🔄 Version Management (4 tools)**

```
midnight-check-version       - Check MCP version
midnight-upgrade-check       - COMPOUND: Full upgrade analysis
midnight-check-breaking-changes - Find breaking changes
midnight-get-migration-guide - Get migration instructions
```

> "Compound tools combine multiple operations. One call to `upgrade-check` does what would take 3-4 separate calls."

**🏥 Health & Meta Tools (4 tools)**

```
midnight-health-check       - Check all services
midnight-get-status         - Quick status (no API calls)
midnight-list-tool-categories - Discover tool categories
midnight-list-category-tools  - Drill into a category
```

**⬆️ Update Tools (3 tools)**

```
midnight-get-update-instructions - Platform-specific update guide
midnight-auto-update-config      - Update config file
midnight-get-version-info        - Detailed version info
```

### Resources (9 Built-in References)

> "Resources are always available - no tool call needed."

```
midnight://syntax/latest     - Current Compact syntax
midnight://examples/counter  - Counter contract example
midnight://examples/token    - Token contract example
midnight://docs/compact      - Compact language reference
midnight://docs/typescript   - TypeScript SDK docs
midnight://changelog/compact - Compact changelog
midnight://changelog/sdk     - SDK changelog
midnight://releases/compact  - Release history
midnight://schemas/contract  - Contract JSON schema
```

> "Ask Claude 'what resources do you have for Midnight?' and it can read these directly."

### Prompts (5 Interactive Prompts)

> "Prompts are templates for common tasks."

```
create-compact-contract   - Start a new contract
explain-compact-code      - Understand existing code
debug-compact-error       - Fix compilation errors
compare-compact-versions  - Migration assistance
security-review           - Full security audit
```

### Progress Notifications

> "When operations take time, you see real-time progress."

**SHOW:** Tool running with progress updates appearing

> "The MCP sends progress notifications so you're not staring at a blank screen wondering if it's working."

---

## SECTION 6: Fallback & Reliability (1-2 min)

### Graceful Degradation

> "What happens when things go wrong? The tool doesn't just break."

**Scenario 1: Compiler Service Down**

```yaml
validationType: "static-analysis-fallback"
message: "Static analysis completed (compiler service unavailable)"
```

> "Falls back to static analysis. You still get validation, just without the real compiler."

**Scenario 2: GitHub Rate Limited**

> "Uses cached syntax references and local data. Never leaves you stranded."

**Scenario 3: Network Issues**

> "Local resources and prompts still work. Offline-capable with --local mode."

---

## SECTION 7: For Contributors (2 min)

### Clone and run locally

```bash
git clone https://github.com/Olanetsoft/midnight-mcp.git
cd midnight-mcp
npm install
npm run build
npm test  # 206 tests across 10 files
```

### Run in dev mode

```bash
npm run dev
```

### Point Claude to local version

```json
{
  "mcpServers": {
    "midnight": {
      "command": "node",
      "args": ["/path/to/midnight-mcp/dist/bin.js"]
    }
  }
}
```

### Project Structure

```
src/
├── tools/         # 29 tool implementations
├── resources/     # 9 embedded resources
├── prompts/       # 5 interactive prompts
├── services/      # Compiler, sampling, syntax validation
├── pipeline/      # GitHub indexing, embeddings
└── utils/         # Caching, rate limiting, validation
```

### Test Coverage

```bash
npm test
# 206 tests, 10 test files
# - analyze.test.ts (compiler integration)
# - search.test.ts
# - generation.test.ts
# - meta.test.ts
# - validation.test.ts
# - syntax-validator.test.ts
# - syntax-drift.test.ts
# - and more...
```

---

## SECTION 8: What's Next (1-2 min)

> "This is open source and actively developed. Here's what's on the roadmap:"

1. **More compiler features** - Full ZK circuit output parsing
2. **Contract deployment** - Deploy directly from AI chat
3. **TypeScript SDK integration** - Generate prover code automatically
4. **Testnet interaction** - Query balances, submit transactions
5. **Caching improvements** - Faster repeated queries
6. **More examples** - Auction, escrow, multi-party contracts

> "If you're building on Midnight, this tool will save you hours. If you want to contribute, PRs are welcome."

### Community

- **GitHub Issues** - Bug reports, feature requests
- **Discussions** - Questions, ideas
- **Twitter** - Updates and announcements

---

## OUTRO (30 sec)

### Call to Action

> "Try it yourself - takes 60 seconds:"

```bash
npx midnight-mcp@latest
```

> "Star the repo if it's useful:"

```
github.com/Olanetsoft/midnight-mcp
```

> "Questions? Open an issue or find me on Twitter."

---

## B-Roll Suggestions

- Terminal showing `npx midnight-mcp@latest` starting up
- Claude Desktop tools panel with all 29 tools visible
- Split screen: Claude generating code + compiler output
- VS Code with the codebase open
- GitHub repo stars/activity
- npm download stats
- Diagram animations of architecture
- Code scrolling through tool implementations

---

## Key Talking Points to Hit

1. **No API keys** - Works out of the box
2. **Real compiler** - Not just pattern matching
3. **102 repos indexed** - Comprehensive Midnight coverage
4. **29 tools** - Every developer need covered
5. **9 resources** - Always-available references
6. **5 prompts** - Interactive templates
7. **Fallback behavior** - Never breaks, always gives something
8. **Open source** - MIT licensed, contributions welcome
9. **Token efficient** - YAML output, compound tools
10. **Full MCP spec** - Tools, Resources, Prompts, Sampling, Progress

---

## Timestamps Template (for YouTube)

```
0:00 - Intro & Hook
0:30 - What is Midnight MCP?
1:00 - Why This MCP is Different
3:00 - Installation (60 seconds)
4:00 - The Problem: AI Without Context
6:00 - The Solution: Live Demo
8:00 - Real Compiler Integration
10:00 - Architecture Overview
12:00 - Complete Feature Walkthrough (29 tools)
17:00 - Fallback & Reliability
18:00 - Contributing Guide
20:00 - What's Next
21:00 - Outro & Call to Action
```

---

## Quick Reference Card

| Category         | Count                                  | Examples                                                               |
| ---------------- | -------------------------------------- | ---------------------------------------------------------------------- |
| Search Tools     | 4                                      | search-compact, search-docs, search-typescript, fetch-docs             |
| Analysis Tools   | 4                                      | analyze-contract, review-contract, compile-contract, extract-structure |
| Generation Tools | 2                                      | generate-contract, document-contract                                   |
| Repository Tools | 8                                      | get-file, compare-syntax, get-repo-context, list-examples              |
| Version Tools    | 4                                      | check-version, upgrade-check, migration-guide                          |
| Health/Meta      | 4                                      | health-check, get-status, list-categories                              |
| Update Tools     | 3                                      | get-update-instructions, auto-update-config                            |
| **Resources**    | 9                                      | syntax/latest, examples/counter, docs/compact                          |
| **Prompts**      | 5                                      | create-contract, debug-error, security-review                          |
| **TOTAL**        | **29 tools + 9 resources + 5 prompts** |
