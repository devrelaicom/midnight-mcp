# Playground Full Proxy — Design Spec

**Date:** 2026-03-16
**Status:** Draft
**Supersedes:** 2026-03-11-playground-api-proxy-design.md (extends, does not invalidate)
**Scope:** Proxy all compact-playground endpoints through the API layer; add 9 new MCP tools; enhance 3 existing tools; add playground-specific dashboard metrics with version tracking.

---

## Goal

Expose every compact-playground feature through the MCP server by proxying all requests through the API layer. This ensures unified auth, rate limiting, version-aware metrics, and dashboard visibility for all playground interactions. Switch the default playground URL from Railway to Fly.io.

## Architecture

```
LLM Client
    ↓  (MCP protocol)
MCP Server (thin client — validation, API calls, response formatting)
    ↓  (HTTPS to hostedApiUrl)
API Layer (/pg/* routes — auth, rate limits, metrics with version tracking)
    ↓  (1:1 proxy to COMPACT_PLAYGROUND_URL)
compact-playground (compile, format, analyze, diff, visualize, prove, simulate, versions, libraries, cached-response)
```

The MCP server remains a thin client. All compilation, analysis, formatting, diffing, visualization, proof analysis, and simulation logic lives in the playground, proxied through the API.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Coverage | All playground endpoints | User requirement: full feature parity |
| Playground URL default | `https://compact-playground.fly.dev` | Fly.io is the active test deployment; remains configurable via `COMPACT_PLAYGROUND_URL` |
| Simulation tools | 4 separate tools (deploy, call, state, delete) | LLMs work better with focused parameter schemas per operation |
| Visualize/Prove | Separate tools (not modes on analyze) | Fundamentally different return types; clearer output schemas |
| Versions/Libraries | Tools (not MCP resources) | Universal client support; consistent with existing tool patterns |
| Version tracking | Extract from response body, not request | Playground resolves versions and includes them in responses — more accurate |
| cached-response | Proxied but no dedicated MCP tool | Useful for API-level caching; LLMs have no reason to request by hash |
| Simulate file organization | Own module `src/tools/simulate/` | Distinct stateful workflow, 4 tools, warrants separation from analyze |
| Dashboard | New playground section | Endpoint + version + error breakdown |

---

## 1. API Proxy Layer

### 1.1 New Routes

Expand `/api/src/routes/pg.ts` from 5 routes to 15:

| API Route | Playground Endpoint | Method | Status |
|-----------|-------------------|--------|--------|
| `POST /pg/compile` | `/compile` | POST | Exists |
| `POST /pg/format` | `/format` | POST | Exists |
| `POST /pg/analyze` | `/analyze` | POST | Exists |
| `POST /pg/diff` | `/diff` | POST | Exists |
| `GET /pg/health` | `/health` | GET | Exists |
| `POST /pg/visualize` | `/visualize` | POST | **New** |
| `POST /pg/prove` | `/prove` | POST | **New** |
| `POST /pg/compile/archive` | `/compile/archive` | POST | **New** |
| `POST /pg/simulate/deploy` | `/simulate/deploy` | POST | **New** |
| `POST /pg/simulate/:id/call` | `/simulate/:id/call` | POST | **New** |
| `GET /pg/simulate/:id/state` | `/simulate/:id/state` | GET | **New** |
| `DELETE /pg/simulate/:id` | `/simulate/:id` | DELETE | **New** |
| `GET /pg/versions` | `/versions` | GET | **New** |
| `GET /pg/libraries` | `/libraries` | GET | **New** |
| `GET /pg/cached-response/:hash` | `/cached-response/:hash` | GET | **New** |

### 1.2 Proxy Implementation

Generalize the existing `proxyPost` helper into a `proxyRequest` function that handles GET, POST, and DELETE:

```typescript
async function proxyRequest(
  c: Context<{ Bindings: Bindings }>,
  path: string,
  method: "GET" | "POST" | "DELETE" = "POST"
): Promise<Response>
```

Each route calls `proxyRequest`, then extracts version info from the response body and calls `trackPlaygroundCall`.

### 1.3 Version Extraction from Responses

Version info is extracted from the **response body** after proxying (the playground resolves versions and includes them):

- **Single-version responses:** read `version` or `compilerVersion` field
- **Multi-version responses:** read `results[].version`, join as comma-separated string
- **Endpoints without version info** (simulate, libraries): track as `null`

### 1.4 Rate Limiting

All `/pg/*` routes use the existing rate limit tiers:
- Anonymous: 10 requests / 60 seconds
- Authenticated: 60 requests / 60 seconds

Same limits for all endpoints initially. Can tighten archive compilation later if needed.

### 1.5 Config Change

Update `wrangler.toml`:
```toml
COMPACT_PLAYGROUND_URL = "https://compact-playground.fly.dev"
```

### 1.6 Error Handling

Unchanged from current behavior:
- Playground 5xx → API returns `503 { error: "Compilation service unavailable", retryAfter: 30 }`
- Playground timeout → same 503
- Playground 4xx → passed through as-is with original status code
- Network failure → 503

---

## 2. New MCP Tools

Nine new tools across three modules.

### 2.1 Analyze Module Additions (`src/tools/analyze/`)

**`midnight-visualize-contract`**

Generates a visual architecture graph of the contract — circuit call relationships, ledger access patterns, witness dependencies.

```
Input:  { code: string, version?: string }
Output: { success: boolean, graph: { nodes[], edges[] }, mermaid: string }
```

Annotations: `readOnlyHint: true`, `idempotentHint: true`, category: `"analyze"`

**`midnight-prove-contract`**

Analyzes ZK privacy boundaries — which data crosses the proof boundary, what's public vs. private, proof flow per circuit.

```
Input:  { code: string, version?: string }
Output: { success: boolean, circuits[]: { name, privacyBoundary, publicInputs, privateInputs, proofFlow } }
```

Annotations: `readOnlyHint: true`, `idempotentHint: true`, category: `"analyze"`

**`midnight-compile-archive`**

Compiles multi-file Compact projects from a base64-encoded `.tar.gz` archive.

```
Input:  {
  archive: string,              // base64 .tar.gz
  version?: string,
  versions?: string[],
  options?: {
    skipZk?: boolean,           // default: true
    includeBindings?: boolean,  // default: false
    libraries?: string[]        // OZ modules, e.g. ["access/Ownable"]
  }
}
Output: { success, output, errors[], warnings[], insights?, bindings?, cacheKey? }
```

Annotations: `readOnlyHint: true`, `idempotentHint: true`, `openWorldHint: true`, category: `"analyze"`

### 2.2 Simulate Module (`src/tools/simulate/` — new)

New 4-file module: `schemas.ts`, `handlers.ts`, `tools.ts`, `index.ts`.

**`midnight-simulate-deploy`**

Deploys a contract for interactive simulation. Returns a `sessionId` for follow-up calls. Sessions expire after 15 minutes of inactivity.

```
Input:  { code: string, version?: string }
Output: { success: boolean, sessionId: string, circuits[], ledger: { initial state } }
```

Annotations: `readOnlyHint: false`, `idempotentHint: false`, category: `"analyze"`

Tool description must instruct the LLM to store the `sessionId` and pass it to subsequent simulate calls.

**`midnight-simulate-call`**

Executes a circuit on a simulated contract.

```
Input:  { sessionId: string, circuit: string, arguments?: Record<string, unknown> }
Output: { success: boolean, result: unknown, stateChanges[], updatedLedger }
```

Annotations: `readOnlyHint: false`, `idempotentHint: false`, category: `"analyze"`

**`midnight-simulate-state`**

Reads the current simulation state.

```
Input:  { sessionId: string }
Output: { success: boolean, ledger, circuits[], callHistory[] }
```

Annotations: `readOnlyHint: true`, `idempotentHint: true`, category: `"analyze"`

**`midnight-simulate-delete`**

Ends a simulation session and frees resources.

```
Input:  { sessionId: string }
Output: { success: boolean }
```

Annotations: `readOnlyHint: false`, `destructiveHint: true`, category: `"analyze"`

### 2.3 Health Module Additions (`src/tools/health/`)

**`midnight-list-compiler-versions`**

Lists all installed compiler versions with language version mapping.

```
Input:  {} (no parameters)
Output: { default: string, installed: [{ version: string, languageVersion: string }] }
```

Annotations: `readOnlyHint: true`, `idempotentHint: true`, category: `"health"`

**`midnight-list-libraries`**

Lists available OpenZeppelin Compact modules by domain.

```
Input:  {} (no parameters)
Output: { libraries: [{ name: string, domain: string, path: string }] }
```

Annotations: `readOnlyHint: true`, `idempotentHint: true`, category: `"health"`

---

## 3. Enhancements to Existing Tools

### 3.1 `midnight-analyze-contract`

**New parameters:**
- `include?: string[]` — filter response sections: `"diagnostics"`, `"facts"`, `"findings"`, `"recommendations"`, `"circuits"`. Passed through to the playground. `summary` and `structure` are always returned.
- `circuit?: string` — focus analysis on a single circuit by name.
- `versions?: string[]` — multi-version analysis (deep mode only).
- `version?: string` — specific compiler version.

**Response changes:** Stop reshaping the playground response. Pass through the full output including:

| Field | Description |
|-------|-------------|
| `summary` | hasLedger, hasCircuits, hasWitnesses, totalLines, publicCircuits, privateCircuits, publicState, privateState |
| `structure` | imports, exports, ledger[], circuits[], witnesses[], types[] |
| `facts` | hasStdLibImport, unusedWitnesses |
| `findings[]` | code, severity, message, suggestion |
| `recommendations[]` | message, priority, relatedFindings |
| `circuits[]` | name, structure, explanation (explanation, operations, zkImplications, privacyConsiderations), facts (readsPrivateState, revealsPrivateData, commitsData, hashesData, constrainsExecution, mutatesLedger, ledgerMutations), findings |
| `compilation` | (deep mode only) success, diagnostics, executionTime, compilerVersion, languageVersion |

Update the output schema to reflect all available fields.

### 3.2 `midnight-compile-contract`

**New parameters:**
- `includeBindings?: boolean` — return compiler-generated TypeScript artifacts. Forces full ZK compilation. Default: `false`.
- `libraries?: string[]` — OZ modules to link, e.g. `["access/Ownable", "token/FungibleToken"]`. Max 20.

### 3.3 `midnight-format-contract`

**New parameter:**
- `versions?: string[]` — multi-version formatting for consistency testing.

---

## 4. Playground Service Expansion

`src/services/playground.ts` gets new functions and helpers.

### 4.1 New Helpers

```typescript
async function get<T>(path: string): Promise<T>    // GET with timeout + error handling
async function del<T>(path: string): Promise<T>     // DELETE with timeout + error handling
```

### 4.2 New Functions

```typescript
// Analyze module
visualize(code: string, options?: { version?: string }): Promise<VisualizeResult>
prove(code: string, options?: { version?: string }): Promise<ProveResult>
compileArchive(archive: string, options?: ArchiveCompileOptions): Promise<CompileResult>

// Simulate module
simulateDeploy(code: string, options?: { version?: string }): Promise<SimulateDeployResult>
simulateCall(sessionId: string, circuit: string, args?: Record<string, unknown>): Promise<SimulateCallResult>
simulateState(sessionId: string): Promise<SimulateStateResult>
simulateDelete(sessionId: string): Promise<SimulateDeleteResult>

// Health module
listVersions(): Promise<VersionsResult>
listLibraries(): Promise<LibrariesResult>
```

### 4.3 Updated Functions

- `compile()` — add `includeBindings` and `libraries` to options interface
- `analyze()` — add `include`, `circuit`, `version`, `versions` parameters
- `format()` — add `versions` parameter

---

## 5. Dashboard Updates

### 5.1 New Metrics Fields

Extend the `Metrics` interface:

```typescript
// New playground-specific metrics
playgroundCalls: number;
playgroundByEndpoint: Record<string, number>;    // e.g. { "/compile": 45, "/simulate/deploy": 12 }
playgroundByVersion: Record<string, number>;     // e.g. { "0.29.0": 30, "0.26.0": 15 }
playgroundErrors: number;
```

Extend the `ToolCall` interface:

```typescript
endpoint?: string;  // e.g. "/pg/compile"
```

### 5.2 Dashboard Section

New **Playground** section in the dashboard HTML showing:

- Total playground requests (aggregate count)
- Requests by endpoint (table/bar showing which features are used most)
- Requests by compiler version (table/bar showing version distribution)
- Error rate (playground-specific failure rate)
- Recent playground activity (last N requests with endpoint, version, success/failure, duration)

### 5.3 Implementation

Update `api/src/templates/dashboard.ts` — the `generateDashboardHtml` function already receives the full metrics object. Add HTML to render the new playground fields. No new routes or data fetching needed.

---

## 6. End-to-End Data Flow

### 6.1 Simulate Deploy Example

```
1. LLM calls midnight-simulate-deploy(code: "export circuit ...")
2. MCP Server:
   a. Validates input via Zod schema
   b. Calls playground.simulateDeploy(code)
      → POST https://midnight-mcp-api.midnightmcp.workers.dev/pg/simulate/deploy
3. API Layer (Cloudflare Worker):
   a. CORS → body limit → auth → rate limit
   b. Proxy to https://compact-playground.fly.dev/simulate/deploy
   c. Extract version from response (if present)
   d. Track: endpoint="/pg/simulate/deploy", version=resolved, success=true
   e. Return response
4. MCP Server:
   a. Returns { success, sessionId: "abc-123", circuits, ledger }
5. LLM stores sessionId, uses in follow-up calls:
   → midnight-simulate-call(sessionId: "abc-123", circuit: "increment")
   → midnight-simulate-state(sessionId: "abc-123")
   → midnight-simulate-delete(sessionId: "abc-123")
```

### 6.2 Compile with Version Tracking Example

```
1. LLM calls midnight-compile-contract(code: "...", version: "0.26.0", libraries: ["token/FungibleToken"])
2. MCP Server:
   a. Validates input
   b. Calls playground.compile(code, { version: "0.26.0", libraries: ["token/FungibleToken"] })
      → POST .../pg/compile
3. API Layer:
   a. Auth + rate limit
   b. Proxy to playground
   c. Extract version from response body (e.g. "0.26.0" from resolved version)
   d. Track: endpoint="/pg/compile", version="0.26.0", success=true, durationMs=2400
   e. Return response
4. MCP Server:
   a. Returns compile result with compilationMode, errors, etc.
```

---

## 7. File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `src/tools/simulate/schemas.ts` | Zod schemas for 4 simulate tools |
| `src/tools/simulate/handlers.ts` | Handler functions for simulate tools |
| `src/tools/simulate/tools.ts` | Tool definitions for simulate tools |
| `src/tools/simulate/index.ts` | Barrel export |

### Modified Files

| File | Changes |
|------|---------|
| `api/src/routes/pg.ts` | Add 10 new proxy routes, generalize proxy helper, add response version extraction and tracking |
| `api/src/services/metrics.ts` | Add playground-specific metrics fields and `trackPlaygroundCall` function |
| `api/src/interfaces.ts` | Extend `Metrics` and `ToolCall` interfaces |
| `api/src/templates/dashboard.ts` | Add playground metrics section to dashboard HTML |
| `api/wrangler.toml` | Update `COMPACT_PLAYGROUND_URL` to `https://compact-playground.fly.dev` |
| `src/services/playground.ts` | Add `get()`, `del()` helpers; add 9 new endpoint functions; update `compile()`, `analyze()`, `format()` signatures |
| `src/tools/analyze/schemas.ts` | Add visualize, prove, archive schemas; update analyze and compile schemas with new params |
| `src/tools/analyze/handlers.ts` | Add visualize, prove, archive handlers; update analyze handler to pass through full response; update compile handler with new options |
| `src/tools/analyze/tools.ts` | Add 3 new tool definitions; update analyze and compile tool descriptions/output schemas |
| `src/tools/analyze/index.ts` | Re-export new tools |
| `src/tools/health/schemas.ts` | Add versions and libraries schemas |
| `src/tools/health/handlers.ts` | Add versions and libraries handlers |
| `src/tools/health/tools.ts` | Add 2 new tool definitions |
| `src/tools/health/index.ts` | Re-export new tools |
| `src/tools/format/schemas.ts` | Add `versions` parameter |
| `src/tools/format/handlers.ts` | Pass `versions` through to playground service |
| `src/tools/index.ts` | Import and register simulate tools |

### Tool Count

Before: 23 tools
After: 32 tools (9 new)
