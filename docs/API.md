# API Reference

## Tools

### Search Tools

#### midnight-search-compact

Search Compact smart contract code.

```typescript
// Input
{
  query: string;      // Search query
  limit?: number;     // Max results (default: 10)
}

// Output
{
  results: Array<{
    content: string;
    score: number;
    metadata: {
      repository: string;
      filePath: string;
      language: string;
      startLine: number;
      endLine: number;
    };
  }>;
}
```

#### midnight-search-typescript

Search TypeScript SDK code.

```typescript
// Input
{
  query: string;
  limit?: number;
}
// Output: same as search-compact
```

#### midnight-search-docs

Search documentation.

```typescript
// Input
{
  query: string;
  category?: "guides" | "api" | "concepts" | "all";
  limit?: number;
}
// Output: same as search-compact
```

#### midnight-fetch-docs

Live fetch from docs.midnight.network (SSG pages).

```typescript
// Input
{
  url: string;        // URL or path on docs.midnight.network
}

// Output
{
  content: string;
  url: string;
  title: string;
}
```

---

### Analysis Tools

#### midnight-analyze-contract

Static analysis of Compact contracts.

```typescript
// Input
{
  code: string;           // Contract source
  checkSecurity?: boolean; // Run security checks (default: true)
}

// Output
{
  structure: {
    hasLedger: boolean;
    hasCircuits: boolean;
    hasWitnesses: boolean;
    ledgerFields: Array<{ name: string; type: string; isShielded: boolean }>;
    circuits: Array<{ name: string; parameters: Array<{name: string; type: string}>; returnType: string; isExported: boolean }>;
    witnesses: Array<{ name: string; parameters: Array<{name: string; type: string}>; returnType: string }>;
  };
  patterns: {
    detected: string[];
    suggestions: string[];
  };
  security: {
    issues: Array<{ severity: "high" | "medium" | "low"; message: string; line?: number }>;
    score: number;
  };
  metrics: {
    lineCount: number;
    circuitCount: number;
    witnessCount: number;
    complexity: "low" | "medium" | "high";
  };
}
```

#### midnight-compile-contract

Compile Compact code using the hosted compiler service. Returns real compiler errors with line/column locations.

```typescript
// Input
{
  code: string;              // Compact source code
  skipZk?: boolean;          // Skip ZK generation for faster validation (default: true)
  fullCompile?: boolean;     // Full compilation with ZK circuits (default: false)
}

// Output (success)
{
  success: true;
  message: string;           // "✅ Compilation successful (Compiler v0.18.0) in 2841ms"
  validationType: "compiler";
  compilerVersion: string;
  compilationMode: "syntax-only" | "full";
  output: {
    circuits: string[];
    ledgerFields: string[];
    exports: string[];
  };
  warnings: string[];
  serviceUrl: string;
}

// Output (error)
{
  success: false;
  message: string;           // "Line 3:26 - unbound identifier Void"
  validationType: "compiler";
  error: string;             // "COMPILE_ERROR"
  location: {
    line: number;
    column: number;
    errorType: string;
  };
  hint: string;
  serviceUrl: string;
}

// Output (fallback — when compiler unavailable)
{
  success: true;
  message: "Static analysis completed (compiler service unavailable)";
  validationType: "static-analysis-fallback";
  serviceAvailable: false;
  staticAnalysis: {
    summary: object;
    structure: object;
    securityFindings: array;
    recommendations: array;
  };
}
```

---

### Code Tools

#### midnight-format-contract

Format Compact contract code using the official formatter.

```typescript
// Input
{
  code: string;      // Contract source to format
  version?: string;  // Compiler version (default: latest)
}

// Output
{
  success: boolean;
  formatted: string;  // Formatted contract source code
  changed: boolean;   // Whether the code was changed
  diff?: string;      // Diff showing formatting changes
}
```

#### midnight-diff-contracts

Compare two versions of a Compact contract and show semantic differences.

```typescript
// Input
{
  original: string;  // Original contract source
  modified: string;  // Modified contract source
}

// Output
{
  hasChanges: boolean;
  circuits: {
    added: string[];
    removed: string[];
    modified: Array<{ name: string; changes: string[] }>;
  };
  ledger: {
    added: string[];
    removed: string[];
    modified: Array<{ name: string; changes: string[] }>;
  };
  pragma: {
    before: string;
    after: string;
    changed: boolean;
  };
  imports: {
    added: string[];
    removed: string[];
  };
}
```

---

### Repository Tools

#### midnight-get-file

Fetch file from GitHub.

```typescript
// Input
{
  repository: string;  // e.g., "compact"
  path: string;
  ref?: string;        // Branch/tag (default: "main")
}

// Output
{
  content: string;
  path: string;
  repository: string;
  ref: string;
  size: number;
}
```

#### midnight-list-examples

List example contracts.

```typescript
// Input
{
  category?: "contracts" | "dapps" | "patterns" | "all";
  language?: "compact" | "typescript" | "all";
}

// Output
{
  examples: Array<{
    name: string;
    description: string;
    path: string;
    repository: string;
    complexity: "beginner" | "intermediate" | "advanced";
  }>;
}
```

#### midnight-get-latest-updates

Recent commits across repos.

```typescript
// Input
{
  repository?: string;
  limit?: number;       // Default: 20
  since?: string;       // ISO date
}

// Output
{
  updates: Array<{
    repository: string;
    sha: string;
    message: string;
    author: string;
    date: string;
    filesChanged: string[];
  }>;
}
```

#### midnight-check-breaking-changes

Check for breaking changes.

```typescript
// Input
{
  repo: string;
  currentVersion: string;
}

// Output
{
  currentVersion: string;
  latestVersion: string;
  isOutdated: boolean;
  versionsBehind: number;
  hasBreakingChanges: boolean;
  breakingChanges: string[];
  recommendation: string;
}
```

#### midnight-get-file-at-version

File at specific version.

```typescript
// Input
{
  repo: string;
  path: string;
  version: string;
}

// Output
{
  content: string;
  version: string;
}
```

#### midnight-compare-syntax

Diff file between versions.

```typescript
// Input
{
  repo: string;
  path: string;
  oldVersion: string;
  newVersion?: string;   // Default: latest
}

// Output
{
  hasDifferences: boolean;
  oldContent: string | null;
  newContent: string | null;
}
```

---

### Compound Tools

> Compound tools combine multiple operations into a single call, reducing token usage by 50-70%.

#### midnight-upgrade-check

Complete upgrade analysis in one call (combines version-info + breaking-changes + migration-guide).

```typescript
// Input
{
  repo?: string;           // Default: "compact"
  currentVersion: string;  // e.g., "v0.14.0"
}

// Output
{
  repository: string;
  currentVersion: string;
  version: {
    latest: string;
    latestStable: string;
    isOutdated: boolean;
    versionsBehind: number;
  };
  breakingChanges: {
    count: number;
    hasBreakingChanges: boolean;
    items: Array<{ description: string; version: string }>;
  };
  migration: {
    steps: string[];
    deprecations: string[];
    newFeatures: string[];
  } | null;
  urgency: "none" | "low" | "medium" | "high" | "critical";
  recommendation: string;
}
```

#### midnight-get-repo-context

Everything needed to start working with a repository (combines version-info + syntax + examples).

```typescript
// Input
{
  repo: string;
  includeExamples?: boolean;  // Default: true
  includeSyntax?: boolean;    // Default: true
}

// Output
{
  repository: string;
  quickStart: {
    version: string;
    installCommand: string;
    docsUrl: string;
  };
  version: { ... };
  syntax: { version: string; files: string[]; primaryReference: string | null };
  examples: Array<{ name: string; description: string; complexity: string }>;
}
```

---

### Health Tools

#### midnight-health-check

Server health status with optional detailed checks.

```typescript
// Input
{
  detailed?: boolean;    // Run external service checks (default: false)
}

// Output
{
  status: "healthy" | "degraded" | "unhealthy";
  mode: "hosted" | "local";
  services: {
    github: boolean;
    vectorStore: boolean;
    hostedApi: boolean;
  }
}
```

#### midnight-get-status

Rate limits and stats (no external calls).

```typescript
// Input: none

// Output
{
  githubRateLimit: {
    remaining: number;
    limit: number;
    reset: string;
  }
  cacheStats: {
    hits: number;
    misses: number;
  }
  mode: "hosted" | "local";
}
```

#### midnight-check-version

Check if running the latest version.

```typescript
// Input: none

// Output
{
  currentVersion: string;
  latestVersion: string;
  isLatest: boolean;
  updateAvailable: boolean;
}
```

#### midnight-get-update-instructions

Platform-specific update instructions.

```typescript
// Input
{
  platform?: "mac" | "windows" | "linux";
  editor?: "claude-desktop" | "cursor" | "vscode" | "windsurf";
}

// Output
{
  instructions: string;
  platform: string;
  editor: string;
}
```

---

### Discovery Tools

> Discovery tools help AI agents explore available capabilities progressively.

#### midnight-list-tool-categories

List tool categories for progressive exploration.

```typescript
// Input
{
  includeToolCounts?: boolean;  // Default: true
}

// Output
{
  categories: Array<{
    name: string;
    description: string;
    toolCount: number;
    useCases: string[];
  }>;
  totalTools: number;
  recommendation: string;
}
```

#### midnight-list-category-tools

List tools within a specific category.

```typescript
// Input
{
  category: "search" | "analyze" | "code" | "repository" | "health" | "compound";
  includeSchemas?: boolean;  // Default: false
}

// Output
{
  category: string;
  description: string;
  tools: Array<{
    name: string;
    description: string;
    title: string;
    isCompound: boolean;
  }>;
  suggestion: string;
}
```

#### midnight-suggest-tool

Smart tool discovery via natural language.

```typescript
// Input
{
  intent: string;       // What the user wants to do
}

// Output
{
  suggested: Array<{
    name: string;
    description: string;
    relevance: string;
  }>;
}
```

---

## Resources

Access via `resources/read` with URI.

### Documentation (2)

| URI                                 | Content                  |
| ----------------------------------- | ------------------------ |
| `midnight://docs/compact-reference` | Compact language reference |
| `midnight://docs/tokenomics`        | Tokenomics (NIGHT, DUST, rewards) |

### Schemas (3)

| URI                              | Content             |
| -------------------------------- | ------------------- |
| `midnight://schema/compact-ast`  | Compact AST schema  |
| `midnight://schema/transaction`  | Transaction schema  |
| `midnight://schema/proof`        | Proof schema        |

---

## Errors

```typescript
{
  content: [{ type: "text", text: "Error: <message>" }],
  isError: true
}
```

| Error                          | Cause                |
| ------------------------------ | -------------------- |
| `Unknown tool: <name>`         | Invalid tool name    |
| `Invalid input: <details>`     | Validation failed    |
| `Vector store not initialized` | ChromaDB unavailable |
| `GitHub API error`             | Rate limit or auth   |
