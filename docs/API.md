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

Static analysis of Compact contracts with detailed structural and security analysis.

```typescript
// Input
{
  code: string;                    // Contract source
  checkSecurity?: boolean;         // Run security checks (default: true)
  include?: string[];              // Filter response sections: "diagnostics", "facts", "findings", "recommendations", "circuits"
  circuit?: string;                // Focus analysis on a single circuit by name
  version?: string;                // Specific compiler version
  versions?: string[];             // Multi-version analysis (deep mode only)
}

// Output
{
  summary: {
    hasLedger: boolean;
    hasCircuits: boolean;
    hasWitnesses: boolean;
    totalLines: number;
    publicCircuits: number;
    privateCircuits: number;
    publicState: number;
    privateState: number;
  };
  structure: {
    imports: string[];
    exports: string[];
    ledger: Array<{ name: string; type: string; isShielded: boolean }>;
    circuits: Array<{ name: string; parameters: Array<{name: string; type: string}>; returnType: string; isExported: boolean }>;
    witnesses: Array<{ name: string; parameters: Array<{name: string; type: string}>; returnType: string }>;
    types: Array<{ name: string; definition: string }>;
  };
  facts?: {
    hasStdLibImport: boolean;
    unusedWitnesses: string[];
  };
  findings?: Array<{
    code: string;
    severity: "high" | "medium" | "low";
    message: string;
    suggestion?: string;
  }>;
  recommendations?: Array<{
    message: string;
    priority: "high" | "medium" | "low";
    relatedFindings?: string[];
  }>;
  circuits?: Array<{
    name: string;
    structure: object;
    explanation?: {
      operations: string[];
      zkImplications: string[];
      privacyConsiderations: string[];
    };
    facts?: {
      readsPrivateState: boolean;
      revealsPrivateData: boolean;
      commitsData: boolean;
      hashesData: boolean;
      constrainsExecution: boolean;
      mutatesLedger: boolean;
      ledgerMutations?: string[];
    };
    findings?: Array<object>;
  }>;
  compilation?: {
    success: boolean;
    diagnostics: Array<object>;
    executionTime: number;
    compilerVersion: string;
    languageVersion: string;
  };
  cacheKey?: string;               // For retrieving cached results
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
  includeBindings?: boolean; // Return TypeScript artifacts (default: false)
  libraries?: string[];      // OZ modules to link, e.g. ["access/Ownable", "token/FungibleToken"] (max 20)
}

// Output (success)
{
  success: true;
  message: string;           // "✅ Compilation successful (Compiler v0.21.0) in 2841ms"
  validationType: "compiler";
  compilerVersion: string;
  compilationMode: "syntax-only" | "full";
  output: {
    circuits: string[];
    ledgerFields: string[];
    exports: string[];
  };
  warnings: string[];
  bindings?: object;         // TypeScript artifacts (if includeBindings=true)
  cacheKey?: string;         // For retrieving cached results
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

#### midnight-visualize-contract

Generate a visual architecture graph of the contract showing circuit relationships, ledger access patterns, and witness dependencies.

```typescript
// Input
{
  code: string;              // Contract source code
  version?: string;          // Compiler version (default: latest)
}

// Output
{
  success: boolean;
  graph: {
    nodes: Array<{
      id: string;
      label: string;
      type: "circuit" | "ledger" | "witness";
      metadata?: object;
    }>;
    edges: Array<{
      source: string;
      target: string;
      label?: string;
      type: "calls" | "reads" | "writes";
    }>;
  };
  mermaid: string;           // Mermaid diagram representation
  cacheKey?: string;         // For retrieving cached results
}
```

#### midnight-prove-contract

Analyze ZK privacy boundaries of a contract — which data crosses proof boundaries, public vs. private inputs, and proof flow per circuit.

```typescript
// Input
{
  code: string;              // Contract source code
  version?: string;          // Compiler version (default: latest)
}

// Output
{
  success: boolean;
  circuits: Array<{
    name: string;
    privacyBoundary: {
      publicInputs: string[];
      privateInputs: string[];
      publicOutputs: string[];
    };
    proofFlow: {
      description: string;
      constraints: string[];
    };
  }>;
  cacheKey?: string;         // For retrieving cached results
}
```

#### midnight-compile-archive

Compile multi-file Compact projects. Accepts a map of file paths to source code.

```typescript
// Input
{
  files: Record<string, string>;     // relative path → source code
  version?: string;                  // Compiler version
  versions?: string[];               // Multi-version analysis
  options?: {
    skipZk?: boolean;                // Skip ZK generation (default: true)
    includeBindings?: boolean;       // Include TypeScript artifacts (default: false)
    libraries?: string[];            // OZ modules, e.g. ["access/Ownable"]
  };
}

// Output
{
  success: boolean;
  output: {
    circuits: string[];
    ledgerFields: string[];
    exports: string[];
  };
  errors: Array<{ message: string; file: string; line?: number }>;
  warnings: string[];
  insights?: string[];
  bindings?: object;                 // TypeScript artifacts (if includeBindings=true)
  cacheKey?: string;                 // For retrieving cached results
}
```

---

### Simulation Tools

#### midnight-simulate-deploy

Deploy a contract for interactive simulation. Returns a session ID for follow-up calls.

```typescript
// Input
{
  code: string;              // Contract source code
  version?: string;          // Compiler version (default: latest)
}

// Output
{
  success: boolean;
  sessionId: string;         // Store this for subsequent calls
  circuits: string[];        // Available circuits to call
  ledger: {
    fields: Array<{ name: string; value: unknown }>;
    initialState: object;
  };
}
```

#### midnight-simulate-call

Execute a circuit on a simulated contract.

```typescript
// Input
{
  sessionId: string;         // From simulate-deploy
  circuit: string;           // Circuit name to execute
  arguments?: Record<string, unknown>;  // Circuit arguments
}

// Output
{
  success: boolean;
  result: unknown;           // Circuit return value
  stateChanges: Array<{
    field: string;
    before: unknown;
    after: unknown;
  }>;
  updatedLedger: object;     // Current ledger state after call
}
```

#### midnight-simulate-state

Read the current simulation state without executing any circuits.

```typescript
// Input
{
  sessionId: string;         // From simulate-deploy
}

// Output
{
  success: boolean;
  ledger: object;            // Current ledger state
  circuits: string[];        // Available circuits
  callHistory: Array<{
    circuit: string;
    arguments: object;
    result: unknown;
    timestamp: string;
  }>;
}
```

#### midnight-simulate-delete

End a simulation session and free resources.

```typescript
// Input
{
  sessionId: string;         // From simulate-deploy
}

// Output
{
  success: boolean;
  message?: string;
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
  versions?: string[];  // Multi-version formatting for consistency testing
}

// Output
{
  success: boolean;
  formatted: string;  // Formatted contract source code
  changed: boolean;   // Whether the code was changed
  diff?: string;      // Diff showing formatting changes
  cacheKey?: string;  // For retrieving cached results
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
  cacheKey?: string;  // For retrieving cached results
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
  currentVersion: string;  // e.g., "v0.29.0" or "0.21.0"
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

#### midnight-list-compiler-versions

List all installed compiler versions with language version mapping.

```typescript
// Input: none

// Output
{
  default: string;  // e.g., "0.29.0"
  installed: Array<{
    version: string;
    languageVersion: string;
  }>;
}
```

#### midnight-list-libraries

List available OpenZeppelin Compact modules by domain.

```typescript
// Input: none

// Output
{
  libraries: Array<{
    name: string;
    domain: string;
    path: string;
    description?: string;
  }>;
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
