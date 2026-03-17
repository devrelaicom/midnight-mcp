# Playground Full Proxy Implementation Plan

**Goal:** Proxy all compact-playground endpoints through the API layer and expose them as MCP tools with version-aware metrics and dashboard visibility.

**Architecture:** The MCP server is a thin client — Zod validation, service calls, response formatting. The API layer (Cloudflare Worker) proxies to the compact-playground with auth, rate limiting, and metrics. Nine new MCP tools plus three enhanced existing tools.

**Tech Stack:** TypeScript, Hono (API), Zod (validation), Vitest (tests), Node.js tar/zlib (archive creation)

**Spec:** `docs/superpowers/specs/2026-03-16-playground-full-proxy-design.md`

---

## Chunk 1: API Layer — Interfaces, Metrics, and Config

### Task 1: Extend Metrics and ToolCall Interfaces

**Files:**
- Modify: `api/src/interfaces/index.ts:50-71`

- [ ] **Step 1: Write the failing test**

No test file for API interfaces — these are type-only changes. Verified by TypeScript compilation in later tasks.

- [ ] **Step 2: Add `endpoint` to ToolCall interface**

In `api/src/interfaces/index.ts`, add `endpoint` field to `ToolCall` (after line 55):

```typescript
export interface ToolCall {
  tool: string;
  timestamp: string;
  success: boolean;
  durationMs?: number;
  version?: string;
  endpoint?: string;  // playground endpoint, e.g. "/pg/compile"
}
```

- [ ] **Step 3: Add playground metrics to Metrics interface**

In `api/src/interfaces/index.ts`, add after `recentToolCalls` (after line 70):

```typescript
export interface Metrics {
  // ... existing fields ...
  totalToolCalls: number;
  toolCallsByName: Record<string, number>;
  recentToolCalls: ToolCall[];
  // Playground tracking
  playgroundCalls: number;
  playgroundByEndpoint: Record<string, number>;
  playgroundByVersion: Record<string, number>;
  playgroundErrors: number;
}
```

- [ ] **Step 4: Commit**

```bash
git add api/src/interfaces/index.ts
git commit -m "feat(api): extend Metrics and ToolCall interfaces for playground tracking"
```

### Task 2: Add trackPlaygroundCall and Update createDefaultMetrics

**Files:**
- Modify: `api/src/services/metrics.ts:8-23,97-124`
- Modify: `api/src/services/index.ts`

- [ ] **Step 1: Update createDefaultMetrics**

In `api/src/services/metrics.ts`, add playground defaults to `createDefaultMetrics()`:

```typescript
export function createDefaultMetrics(): Metrics {
  return {
    totalQueries: 0,
    queriesByEndpoint: {},
    queriesByLanguage: {},
    avgRelevanceScore: 0,
    scoreDistribution: { high: 0, medium: 0, low: 0 },
    recentQueries: [],
    documentsByRepo: {},
    lastUpdated: new Date().toISOString(),
    // Tool tracking
    totalToolCalls: 0,
    toolCallsByName: {},
    recentToolCalls: [],
    // Playground tracking
    playgroundCalls: 0,
    playgroundByEndpoint: {},
    playgroundByVersion: {},
    playgroundErrors: 0,
  };
}
```

- [ ] **Step 2: Add trackPlaygroundCall function**

After `trackToolCall` in `api/src/services/metrics.ts` (after line 124):

```typescript
/**
 * Track a playground proxy call with endpoint and version info.
 * Called by API proxy routes — separate from MCP-level tool tracking.
 */
export function trackPlaygroundCall(
  endpoint: string,
  success: boolean,
  durationMs?: number,
  version?: string | null,
): void {
  // Initialize if needed (for older metrics without playground tracking)
  if (!metrics.playgroundCalls) metrics.playgroundCalls = 0;
  if (!metrics.playgroundByEndpoint) metrics.playgroundByEndpoint = {};
  if (!metrics.playgroundByVersion) metrics.playgroundByVersion = {};
  if (!metrics.playgroundErrors) metrics.playgroundErrors = 0;

  metrics.playgroundCalls++;
  metrics.playgroundByEndpoint[endpoint] =
    (metrics.playgroundByEndpoint[endpoint] || 0) + 1;

  if (version) {
    metrics.playgroundByVersion[version] =
      (metrics.playgroundByVersion[version] || 0) + 1;
  }

  if (!success) {
    metrics.playgroundErrors++;
  }

  // Also add to recentToolCalls for unified activity view
  const logEntry: ToolCall = {
    tool: "pg-proxy",
    timestamp: new Date().toISOString(),
    success,
    durationMs,
    version: version ?? undefined,
    endpoint,
  };
  metrics.recentToolCalls.unshift(logEntry);
  if (metrics.recentToolCalls.length > 100) {
    metrics.recentToolCalls = metrics.recentToolCalls.slice(0, 100);
  }

  metrics.lastUpdated = new Date().toISOString();
}
```

- [ ] **Step 3: Export trackPlaygroundCall from services barrel**

In `api/src/services/index.ts`, add `trackPlaygroundCall` to the metrics export:

```typescript
export {
  getMetrics,
  trackQuery,
  trackToolCall,
  trackPlaygroundCall,
  persistMetrics,
  loadMetrics,
  createDefaultMetrics,
} from "./metrics";
```

- [ ] **Step 4: Commit**

```bash
git add api/src/services/metrics.ts api/src/services/index.ts
git commit -m "feat(api): add trackPlaygroundCall and playground metric defaults"
```

### Task 3: Update wrangler.toml Playground URL

**Files:**
- Modify: `api/wrangler.toml:7`

- [ ] **Step 1: Update COMPACT_PLAYGROUND_URL**

Change line 7 from:
```toml
COMPACT_PLAYGROUND_URL = "https://compact-playground.up.railway.app"
```
to:
```toml
COMPACT_PLAYGROUND_URL = "https://compact-playground.fly.dev"
```

- [ ] **Step 2: Commit**

```bash
git add api/wrangler.toml
git commit -m "config(api): switch playground URL to Fly.io deployment"
```

### Task 4: Rewrite pg.ts with Generic Proxy, Version Extraction, and All Routes

**Files:**
- Modify: `api/src/routes/pg.ts` (full rewrite)

- [ ] **Step 1: Rewrite pg.ts**

Replace entire contents of `api/src/routes/pg.ts`:

```typescript
/**
 * Playground proxy routes.
 * Forward requests to compact-playground with auth, rate limiting, and metrics.
 */

import { Hono, type Context } from "hono";
import type { Bindings } from "../interfaces";
import { trackPlaygroundCall, persistMetrics, loadMetrics } from "../services";

const pg = new Hono<{ Bindings: Bindings }>();

/**
 * Extract version info from a playground response body.
 * Reads resolved version from the response (more accurate than request).
 */
function extractVersion(data: Record<string, unknown>): string | null {
  // Single-version: look for version or compilerVersion
  if (typeof data.version === "string") return data.version;
  if (typeof data.compilerVersion === "string") return data.compilerVersion;

  // Multi-version: join results[].version
  if (Array.isArray(data.results)) {
    const versions = data.results
      .map((r: Record<string, unknown>) => r.version)
      .filter((v): v is string => typeof v === "string");
    if (versions.length > 0) return versions.join(",");
  }

  // Deep analyze: check compilation.compilerVersion
  const compilation = data.compilation as Record<string, unknown> | undefined;
  if (compilation && typeof compilation.compilerVersion === "string") {
    return compilation.compilerVersion;
  }

  return null;
}

/**
 * Generic proxy handler for any method.
 */
async function proxyRequest(
  c: Context<{ Bindings: Bindings }>,
  path: string,
  method: "GET" | "POST" | "DELETE" = "POST",
) {
  const playgroundUrl = c.env.COMPACT_PLAYGROUND_URL;
  const start = Date.now();

  const fetchOptions: RequestInit = { method };

  if (method === "POST") {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid or missing JSON body" }, 400);
    }
    fetchOptions.headers = { "Content-Type": "application/json" };
    fetchOptions.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${playgroundUrl}${path}`, fetchOptions);
    const durationMs = Date.now() - start;

    if (response.status >= 500) {
      await trackAndPersist(c, path, false, durationMs, null);
      return c.json(
        { error: "Compilation service unavailable", retryAfter: 30 },
        503,
      );
    }

    const data = await response.json() as Record<string, unknown>;
    const version = extractVersion(data);

    await trackAndPersist(c, path, response.ok, durationMs, version);

    return c.json(data, response.status as 200);
  } catch {
    const durationMs = Date.now() - start;
    await trackAndPersist(c, path, false, durationMs, null);
    return c.json(
      { error: "Compilation service unavailable", retryAfter: 30 },
      503,
    );
  }
}

async function trackAndPersist(
  c: Context<{ Bindings: Bindings }>,
  path: string,
  success: boolean,
  durationMs: number,
  version: string | null,
) {
  await loadMetrics(c.env.METRICS);
  trackPlaygroundCall(`/pg${path}`, success, durationMs, version);
  await persistMetrics(c.env.METRICS);
}

// ---- Existing routes (compile, format, analyze, diff, health) ----

pg.post("/compile", (c) => proxyRequest(c, "/compile"));
pg.post("/format", (c) => proxyRequest(c, "/format"));
pg.post("/analyze", (c) => proxyRequest(c, "/analyze"));
pg.post("/diff", (c) => proxyRequest(c, "/diff"));

pg.get("/health", (c) => proxyRequest(c, "/health", "GET"));

// ---- New routes ----

pg.post("/visualize", (c) => proxyRequest(c, "/visualize"));
pg.post("/prove", (c) => proxyRequest(c, "/prove"));
pg.post("/compile/archive", (c) => proxyRequest(c, "/compile/archive"));

// Simulation
pg.post("/simulate/deploy", (c) => proxyRequest(c, "/simulate/deploy"));
pg.post("/simulate/:id/call", (c) => {
  const id = c.req.param("id");
  return proxyRequest(c, `/simulate/${id}/call`);
});
pg.get("/simulate/:id/state", (c) => {
  const id = c.req.param("id");
  return proxyRequest(c, `/simulate/${id}/state`, "GET");
});
pg.delete("/simulate/:id", (c) => {
  const id = c.req.param("id");
  return proxyRequest(c, `/simulate/${id}`, "DELETE");
});

// Reference data
pg.get("/versions", (c) => proxyRequest(c, "/versions", "GET"));
pg.get("/libraries", (c) => proxyRequest(c, "/libraries", "GET"));

// Cache lookup
pg.get("/cached-response/:hash", (c) => {
  const hash = c.req.param("hash");
  return proxyRequest(c, `/cached-response/${hash}`, "GET");
});

export default pg;
```

- [ ] **Step 2: Run TypeScript check**

Run: `cd api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add api/src/routes/pg.ts
git commit -m "feat(api): rewrite pg proxy with all 15 routes, version tracking, and metrics"
```

---

## Chunk 2: Playground Service Expansion

### Task 5: Add get() and del() Helpers to Playground Service

**Files:**
- Modify: `src/services/playground.ts:12-55`
- Test: `tests/playground.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `tests/playground.test.ts`, after the existing imports, import the new functions:

```typescript
import {
  compile,
  format,
  analyze,
  diff,
  healthCheck,
  visualize,
  prove,
  simulateDeploy,
  simulateCall,
  simulateState,
  simulateDelete,
  listVersions,
  listLibraries,
} from "../src/services/playground.js";
```

Add test blocks after the `healthCheck` describe block:

```typescript
  // ---- visualize ----

  describe("visualize", () => {
    it("sends POST to /pg/visualize with code", async () => {
      const result = { success: true, graph: { nodes: [], edges: [] }, mermaid: "graph TD" };
      mockFetchOk(result);

      const res = await visualize("code");

      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/visualize`);
      expect(init?.method).toBe("POST");
      const parsed = JSON.parse(init?.body as string);
      expect(parsed.code).toBe("code");
      expect(res).toEqual(result);
    });
  });

  // ---- prove ----

  describe("prove", () => {
    it("sends POST to /pg/prove with code", async () => {
      const result = { success: true, circuits: [] };
      mockFetchOk(result);

      const res = await prove("code");

      const [url] = fetchSpy.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/prove`);
      expect(res).toEqual(result);
    });
  });

  // ---- simulate ----

  describe("simulateDeploy", () => {
    it("sends POST to /pg/simulate/deploy", async () => {
      const result = { success: true, sessionId: "sess-1", circuits: [], ledger: {} };
      mockFetchOk(result);

      const res = await simulateDeploy("code");

      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/simulate/deploy`);
      const parsed = JSON.parse(init?.body as string);
      expect(parsed.code).toBe("code");
      expect(res).toEqual(result);
    });
  });

  describe("simulateCall", () => {
    it("sends POST to /pg/simulate/:id/call", async () => {
      const result = { success: true, result: null, stateChanges: [] };
      mockFetchOk(result);

      const res = await simulateCall("sess-1", "increment", { amount: 1 });

      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/simulate/sess-1/call`);
      const parsed = JSON.parse(init?.body as string);
      expect(parsed.circuit).toBe("increment");
      expect(parsed.arguments).toEqual({ amount: 1 });
      expect(res).toEqual(result);
    });
  });

  describe("simulateState", () => {
    it("sends GET to /pg/simulate/:id/state", async () => {
      const result = { success: true, ledger: {}, circuits: [], callHistory: [] };
      mockFetchOk(result);

      const res = await simulateState("sess-1");

      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/simulate/sess-1/state`);
      expect(init?.method).toBe("GET");
      expect(res).toEqual(result);
    });
  });

  describe("simulateDelete", () => {
    it("sends DELETE to /pg/simulate/:id", async () => {
      const result = { success: true };
      mockFetchOk(result);

      const res = await simulateDelete("sess-1");

      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/simulate/sess-1`);
      expect(init?.method).toBe("DELETE");
      expect(res).toEqual(result);
    });
  });

  // ---- compileArchive ----

  describe("compileArchive", () => {
    it("sends POST to /pg/compile/archive", async () => {
      const result = { success: true, output: "OK" };
      mockFetchOk(result);

      // Import is tested at service level — archive is a base64 string by the time it reaches here
      const { compileArchive } = await import("../src/services/playground.js");
      const res = await compileArchive("base64data", { version: "0.29.0" });

      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/compile/archive`);
      const parsed = JSON.parse(init?.body as string);
      expect(parsed.archive).toBe("base64data");
      expect(parsed.version).toBe("0.29.0");
      expect(res).toEqual(result);
    });
  });

  // ---- listVersions ----

  describe("listVersions", () => {
    it("sends GET to /pg/versions", async () => {
      const result = { default: "0.29.0", installed: [{ version: "0.29.0", languageVersion: "0.21.0" }] };
      mockFetchOk(result);

      const res = await listVersions();

      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/versions`);
      expect(init?.method).toBe("GET");
      expect(res).toEqual(result);
    });
  });

  // ---- listLibraries ----

  describe("listLibraries", () => {
    it("sends GET to /pg/libraries", async () => {
      const result = { libraries: [{ name: "Ownable", domain: "access", path: "access/Ownable" }] };
      mockFetchOk(result);

      const res = await listLibraries();

      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/libraries`);
      expect(init?.method).toBe("GET");
      expect(res).toEqual(result);
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/playground.test.ts`
Expected: FAIL — functions not exported

- [ ] **Step 3: Add get() and del() helpers and all new functions**

Replace `src/services/playground.ts` entirely. The key changes:
1. Add `get<T>` and `del<T>` helpers mirroring `post<T>`
2. Update `analyze()` signature to options object
3. Add `includeBindings` and `libraries` to `compile()` options
4. Add `versions` to `format()` options
5. Add all 9 new functions
6. Add `cacheUrl` helper

```typescript
/**
 * Playground API client.
 * All compact-playground interactions go through the API layer's /pg/* routes.
 */

import { config } from "../utils/config.js";
import { MCPError, ErrorCodes } from "../utils/index.js";

const TIMEOUT = 30000;
const MAX_CODE_SIZE = 100 * 1024;

function apiUrl(path: string): string {
  return `${config.hostedApiUrl}/pg${path}`;
}

function buildCacheUrl(cacheKey: string): string {
  return `${config.hostedApiUrl}/pg/cached-response/${cacheKey}`;
}

// ---- HTTP helpers ----

async function post<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, TIMEOUT);

  try {
    const response = await fetch(apiUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (response.status === 503) {
      throw new MCPError(
        "Compilation service unavailable — try again later",
        ErrorCodes.INTERNAL_ERROR,
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "Unknown error");
      throw new MCPError(`API error (${response.status}): ${text}`, ErrorCodes.INTERNAL_ERROR);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof MCPError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new MCPError("Request timed out", ErrorCodes.INTERNAL_ERROR);
    }
    throw new MCPError(
      `Failed to connect to API: ${error instanceof Error ? error.message : "Unknown error"}`,
      ErrorCodes.INTERNAL_ERROR,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

async function get<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, TIMEOUT);

  try {
    const response = await fetch(apiUrl(path), {
      method: "GET",
      signal: controller.signal,
    });

    if (response.status === 503) {
      throw new MCPError(
        "Compilation service unavailable — try again later",
        ErrorCodes.INTERNAL_ERROR,
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "Unknown error");
      throw new MCPError(`API error (${response.status}): ${text}`, ErrorCodes.INTERNAL_ERROR);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof MCPError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new MCPError("Request timed out", ErrorCodes.INTERNAL_ERROR);
    }
    throw new MCPError(
      `Failed to connect to API: ${error instanceof Error ? error.message : "Unknown error"}`,
      ErrorCodes.INTERNAL_ERROR,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

async function del<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, TIMEOUT);

  try {
    const response = await fetch(apiUrl(path), {
      method: "DELETE",
      signal: controller.signal,
    });

    if (response.status === 503) {
      throw new MCPError(
        "Compilation service unavailable — try again later",
        ErrorCodes.INTERNAL_ERROR,
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "Unknown error");
      throw new MCPError(`API error (${response.status}): ${text}`, ErrorCodes.INTERNAL_ERROR);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof MCPError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new MCPError("Request timed out", ErrorCodes.INTERNAL_ERROR);
    }
    throw new MCPError(
      `Failed to connect to API: ${error instanceof Error ? error.message : "Unknown error"}`,
      ErrorCodes.INTERNAL_ERROR,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---- Compile ----

export interface CompileOptions {
  wrapWithDefaults?: boolean;
  skipZk?: boolean;
  version?: string;
  includeBindings?: boolean;
  libraries?: string[];
}

export interface CompileResult {
  success: boolean;
  output?: string;
  errors?: Array<{
    file?: string;
    line?: number;
    column?: number;
    severity?: string;
    message: string;
  }>;
  executionTime?: number;
  compiledAt?: string;
  originalCode?: string;
  wrappedCode?: string;
  cacheKey?: string;
}

export interface MultiVersionCompileResult {
  success: boolean;
  results: Array<{
    version: string;
    requestedVersion: string;
    success: boolean;
    output?: string;
    errors?: Array<{
      message: string;
      line?: number;
      column?: number;
      severity?: string;
    }>;
    executionTime?: number;
  }>;
}

export async function compile(
  code: string,
  options: CompileOptions & { versions?: string[] } = {},
): Promise<CompileResult | MultiVersionCompileResult> {
  if (code.length > MAX_CODE_SIZE) {
    throw new MCPError(
      `Code exceeds maximum size of ${MAX_CODE_SIZE / 1024}KB`,
      ErrorCodes.INVALID_INPUT,
    );
  }

  const body: Record<string, unknown> = {
    code,
    options: {
      wrapWithDefaults: options.wrapWithDefaults ?? true,
      skipZk: options.skipZk ?? true,
      ...(options.version && { version: options.version }),
      ...(options.includeBindings && { includeBindings: true }),
      ...(options.libraries?.length && { libraries: options.libraries }),
    },
  };

  if (options.versions) {
    body.versions = options.versions;
  }

  return post("/compile", body);
}

// ---- Format ----

export interface FormatResult {
  success: boolean;
  formatted: string;
  changed: boolean;
  diff?: string;
  cacheKey?: string;
}

export async function format(
  code: string,
  options: { version?: string; versions?: string[] } = {},
): Promise<FormatResult> {
  const body: Record<string, unknown> = { code, options };
  if (options.versions) {
    body.versions = options.versions;
  }
  return post("/format", body);
}

// ---- Analyze ----

export interface AnalyzeOptions {
  mode?: "fast" | "deep";
  include?: string[];
  circuit?: string;
  version?: string;
  versions?: string[];
}

export interface AnalyzeResult {
  success: boolean;
  mode: "fast" | "deep";
  [key: string]: unknown; // Pass through all playground fields
}

export async function analyze(
  code: string,
  options: AnalyzeOptions = {},
): Promise<AnalyzeResult> {
  const body: Record<string, unknown> = {
    code,
    mode: options.mode ?? "fast",
  };
  if (options.include) body.include = options.include;
  if (options.circuit) body.circuit = options.circuit;
  if (options.version) body.version = options.version;
  if (options.versions) body.versions = options.versions;

  return post("/analyze", body);
}

// ---- Diff ----

export interface DiffResult {
  success: boolean;
  hasChanges: boolean;
  circuits: {
    added: Array<{ name: string }>;
    removed: Array<{ name: string }>;
    modified: Array<{ name: string; changes: string[] }>;
  };
  ledger: {
    added: Array<{ name: string }>;
    removed: Array<{ name: string }>;
    modified: Array<{ name: string; changes: string[] }>;
  };
  pragma: { before: string | null; after: string | null; changed: boolean };
  imports: { added: string[]; removed: string[] };
  cacheKey?: string;
}

export async function diff(before: string, after: string): Promise<DiffResult> {
  return post("/diff", { before, after });
}

// ---- Visualize ----

export interface VisualizeResult {
  success: boolean;
  graph?: { nodes: unknown[]; edges: unknown[] };
  mermaid?: string;
  cacheKey?: string;
}

export async function visualize(
  code: string,
  options: { version?: string } = {},
): Promise<VisualizeResult> {
  return post("/visualize", { code, ...options });
}

// ---- Prove ----

export interface ProveResult {
  success: boolean;
  circuits?: unknown[];
  cacheKey?: string;
}

export async function prove(
  code: string,
  options: { version?: string } = {},
): Promise<ProveResult> {
  return post("/prove", { code, ...options });
}

// ---- Compile Archive ----

export interface ArchiveCompileOptions {
  version?: string;
  versions?: string[];
  skipZk?: boolean;
  includeBindings?: boolean;
  libraries?: string[];
}

export async function compileArchive(
  archive: string, // base64-encoded .tar.gz (created by handler from files map)
  options: ArchiveCompileOptions = {},
): Promise<CompileResult | MultiVersionCompileResult> {
  const body: Record<string, unknown> = {
    archive,
    options: {
      skipZk: options.skipZk ?? true,
      ...(options.includeBindings && { includeBindings: true }),
      ...(options.libraries?.length && { libraries: options.libraries }),
    },
  };
  if (options.version) body.version = options.version;
  if (options.versions) body.versions = options.versions;

  return post("/compile/archive", body);
}

// ---- Simulate ----

export interface SimulateDeployResult {
  success: boolean;
  sessionId: string;
  circuits?: unknown[];
  ledger?: unknown;
}

export async function simulateDeploy(
  code: string,
  options: { version?: string } = {},
): Promise<SimulateDeployResult> {
  return post("/simulate/deploy", { code, ...options });
}

export interface SimulateCallResult {
  success: boolean;
  result?: unknown;
  stateChanges?: unknown[];
  updatedLedger?: unknown;
}

export async function simulateCall(
  sessionId: string,
  circuit: string,
  args?: Record<string, unknown>,
): Promise<SimulateCallResult> {
  return post(`/simulate/${sessionId}/call`, {
    circuit,
    ...(args && { arguments: args }),
  });
}

export interface SimulateStateResult {
  success: boolean;
  ledger?: unknown;
  circuits?: unknown[];
  callHistory?: unknown[];
}

export async function simulateState(sessionId: string): Promise<SimulateStateResult> {
  return get(`/simulate/${sessionId}/state`);
}

export interface SimulateDeleteResult {
  success: boolean;
}

export async function simulateDelete(sessionId: string): Promise<SimulateDeleteResult> {
  return del(`/simulate/${sessionId}`);
}

// ---- Versions ----

export interface VersionsResult {
  default: string;
  installed: Array<{ version: string; languageVersion: string }>;
}

export async function listVersions(): Promise<VersionsResult> {
  return get("/versions");
}

// ---- Libraries ----

export interface LibrariesResult {
  libraries: Array<{ name: string; domain: string; path: string }>;
}

export async function listLibraries(): Promise<LibrariesResult> {
  return get("/libraries");
}

// ---- Health ----

export async function healthCheck(): Promise<{
  status: string;
  compactCli?: { installed: boolean; version?: string };
}> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 5000);
  try {
    const response = await fetch(apiUrl("/health"), {
      signal: controller.signal,
    });
    if (!response.ok) {
      return { status: "unavailable" };
    }
    return (await response.json()) as {
      status: string;
      compactCli?: { installed: boolean; version?: string };
    };
  } catch {
    return { status: "unavailable" };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---- Utilities ----

export { buildCacheUrl };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/playground.test.ts`
Expected: All existing tests pass. New tests pass (after updating imports).

Note: The existing `analyze` tests use `analyze("code", "deep")` which must be updated to `analyze("code", { mode: "deep" })` and `analyze("code")` stays the same (options defaults).

Update the two existing analyze test cases in `tests/playground.test.ts`:

```typescript
  describe("analyze", () => {
    it("sends POST to /pg/analyze with mode param", async () => {
      const result = { success: true, mode: "deep", circuits: [] };
      mockFetchOk(result);

      const res = await analyze("code", { mode: "deep" });

      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/analyze`);
      const parsed = JSON.parse(init?.body as string);
      expect(parsed.code).toBe("code");
      expect(parsed.mode).toBe("deep");
      expect(res).toEqual(result);
    });

    it("defaults mode to fast", async () => {
      mockFetchOk({ success: true, mode: "fast" });

      await analyze("code");

      const parsed = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(parsed.mode).toBe("fast");
    });
  });
```

- [ ] **Step 5: Run all tests**

Run: `npx vitest run tests/playground.test.ts`
Expected: PASS — all tests green

- [ ] **Step 6: Commit**

```bash
git add src/services/playground.ts tests/playground.test.ts
git commit -m "feat: expand playground service with get/del helpers and 9 new endpoint functions"
```

---

## Chunk 3: Enhanced Existing Tools

### Task 6: Update analyze Tool (Schema, Handler, Tool Definition)

**Files:**
- Modify: `src/tools/analyze/schemas.ts:9-18`
- Modify: `src/tools/analyze/handlers.ts:13-27`
- Modify: `src/tools/analyze/tools.ts:155-178`

- [ ] **Step 1: Update AnalyzeContractInputSchema**

In `src/tools/analyze/schemas.ts`, replace the `AnalyzeContractInputSchema`:

```typescript
export const AnalyzeContractInputSchema = z.object({
  code: z.string().describe("Compact contract source code"),
  mode: z
    .enum(["fast", "deep"])
    .optional()
    .default("fast")
    .describe(
      "Analysis mode: 'fast' for source-level analysis (instant), 'deep' for compile-backed analysis",
    ),
  include: z
    .array(z.string())
    .optional()
    .describe(
      "Filter response sections: 'diagnostics', 'facts', 'findings', 'recommendations', 'circuits'. Summary and structure are always returned.",
    ),
  circuit: z
    .string()
    .optional()
    .describe("Focus analysis on a single circuit by name"),
  version: z
    .string()
    .optional()
    .describe("Compiler version (e.g. '0.29.0') or 'detect' for pragma-based resolution"),
  versions: z
    .array(z.string())
    .optional()
    .describe("Multi-version analysis (deep mode only), e.g. ['latest', '0.26.0']"),
});
```

- [ ] **Step 2: Update analyzeContract handler to pass through full response**

In `src/tools/analyze/handlers.ts`, update the `analyzeContract` function:

```typescript
export async function analyzeContract(input: AnalyzeContractInput) {
  logger.debug("Analyzing Compact contract via playground API");

  const result = await analyze(input.code, {
    mode: input.mode,
    include: input.include,
    circuit: input.circuit,
    version: input.version,
    versions: input.versions,
  });

  // Pass through the full playground response, adding cacheUrl if cacheKey present
  const cacheKey = (result as Record<string, unknown>).cacheKey as string | undefined;
  return {
    ...result,
    ...(cacheKey && { cacheUrl: buildCacheUrl(cacheKey) }),
  };
}
```

- [ ] **Step 3: Update analyze tool description**

In `src/tools/analyze/tools.ts`, update the `midnight-analyze-contract` entry description:

```typescript
    description: `Analyze Compact contract structure via the playground API.

Modes:
• mode='fast' (default): Source-level analysis — returns summary, structure, findings, recommendations, circuit explanations
• mode='deep': Compile-backed analysis — includes compilation results alongside full analysis

Filtering:
• include: Filter response to specific sections ('diagnostics', 'facts', 'findings', 'recommendations', 'circuits')
• circuit: Focus analysis on a single circuit by name
• version/versions: Select compiler version(s) for deep mode

USAGE GUIDANCE:
• Call once per contract - results are deterministic
• Use include to reduce response size when you only need specific sections
• Use mode='deep' when you need compilation diagnostics alongside analysis`,
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/analyze.test.ts`
Expected: PASS (existing tests still work with updated schema)

- [ ] **Step 5: Commit**

```bash
git add src/tools/analyze/schemas.ts src/tools/analyze/handlers.ts src/tools/analyze/tools.ts
git commit -m "feat: enhance analyze tool with include, circuit, version params and full response pass-through"
```

### Task 7: Update compile Tool (Schema, Handler)

**Files:**
- Modify: `src/tools/analyze/schemas.ts:20-48`
- Modify: `src/tools/analyze/handlers.ts:32-54`

- [ ] **Step 1: Add includeBindings and libraries to CompileContractInputSchema**

In `src/tools/analyze/schemas.ts`, update `CompileContractInputSchema`:

```typescript
export const CompileContractInputSchema = z.object({
  code: z.string().describe("Compact contract source code to compile"),
  skipZk: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Skip ZK circuit generation for faster syntax-only validation (default: true). Overridden by fullCompile.",
    ),
  fullCompile: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Perform full compilation including ZK generation (slower but complete). Overrides skipZk.",
    ),
  version: z
    .string()
    .optional()
    .describe(
      "Compiler version to use (e.g. '0.29.0') or 'detect' to resolve from pragma constraints",
    ),
  versions: z
    .array(z.string())
    .optional()
    .describe(
      "Test against multiple compiler versions in parallel (e.g. ['latest', '0.26.0', 'detect'])",
    ),
  includeBindings: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Return compiler-generated TypeScript artifacts. Forces full ZK compilation.",
    ),
  libraries: z
    .array(z.string())
    .max(20)
    .optional()
    .describe(
      "OpenZeppelin modules to link (e.g. ['access/Ownable', 'token/FungibleToken']). Max 20.",
    ),
});
```

- [ ] **Step 2: Update compileContract handler**

In `src/tools/analyze/handlers.ts`, update `compileContract`:

```typescript
export async function compileContract(input: CompileContractInput): Promise<object> {
  logger.info("Compiling Compact contract via API proxy", {
    codeLength: input.code.length,
    skipZk: input.skipZk,
    fullCompile: input.fullCompile,
    version: input.version,
    versions: input.versions,
    includeBindings: input.includeBindings,
    libraries: input.libraries,
  });

  const skipZk = input.fullCompile || input.includeBindings ? false : input.skipZk;

  const result = await compile(input.code, {
    skipZk,
    wrapWithDefaults: true,
    version: input.version,
    versions: input.versions,
    includeBindings: input.includeBindings,
    libraries: input.libraries,
  });

  // Add cacheUrl if cacheKey present
  const cacheKey = (result as Record<string, unknown>).cacheKey as string | undefined;

  return {
    ...result,
    compilationMode: skipZk ? "syntax-only" : "full",
    ...(cacheKey && { cacheUrl: buildCacheUrl(cacheKey) }),
  };
}
```

Also update the import at the top of `handlers.ts`:
```typescript
import { compile, analyze, buildCacheUrl } from "../../services/playground.js";
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/analyze.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/tools/analyze/schemas.ts src/tools/analyze/handlers.ts
git commit -m "feat: add includeBindings, libraries params to compile tool"
```

### Task 8: Update format Tool

**Files:**
- Modify: `src/tools/format/schemas.ts`
- Modify: `src/tools/format/handlers.ts`

- [ ] **Step 1: Add versions to FormatContractInputSchema**

```typescript
import { z } from "zod";

export const FormatContractInputSchema = z.object({
  code: z.string().describe("Compact contract source code to format"),
  version: z.string().optional().describe("Compiler version to use for formatting (e.g. '0.29.0')"),
  versions: z
    .array(z.string())
    .optional()
    .describe("Format with multiple compiler versions for consistency testing"),
});

export type FormatContractInput = z.infer<typeof FormatContractInputSchema>;
```

- [ ] **Step 2: Update format handler to pass versions and add cacheUrl**

```typescript
import { format, buildCacheUrl } from "../../services/playground.js";
import { logger } from "../../utils/index.js";
import type { FormatContractInput } from "./schemas.js";

export async function formatContract(input: FormatContractInput) {
  logger.debug("Formatting Compact contract");
  const result = await format(input.code, {
    version: input.version,
    versions: input.versions,
  });
  return {
    success: result.success,
    formatted: result.formatted,
    changed: result.changed,
    diff: result.diff,
    ...(result.cacheKey && {
      cacheKey: result.cacheKey,
      cacheUrl: buildCacheUrl(result.cacheKey),
    }),
  };
}
```

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/tools/format/schemas.ts src/tools/format/handlers.ts
git commit -m "feat: add versions param and cacheUrl to format tool"
```

### Task 8b: Update diff Handler for cacheUrl

**Files:**
- Modify: `src/tools/diff/handlers.ts`

- [ ] **Step 1: Update diff handler to pass through cacheKey and add cacheUrl**

```typescript
import { diff, buildCacheUrl } from "../../services/playground.js";
import { logger } from "../../utils/index.js";
import type { DiffContractsInput } from "./schemas.js";

export async function diffContracts(input: DiffContractsInput) {
  logger.debug("Diffing Compact contracts");
  const result = await diff(input.before, input.after);
  return {
    hasChanges: result.hasChanges,
    circuits: result.circuits,
    ledger: result.ledger,
    pragma: result.pragma,
    imports: result.imports,
    ...(result.cacheKey && {
      cacheKey: result.cacheKey,
      cacheUrl: buildCacheUrl(result.cacheKey),
    }),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/diff/handlers.ts
git commit -m "feat: add cacheKey/cacheUrl to diff tool response"
```

---

## Chunk 4: New Analyze Tools (Visualize, Prove, Archive)

### Task 9: Add Visualize, Prove, and Archive Tool Schemas

**Files:**
- Modify: `src/tools/analyze/schemas.ts`

- [ ] **Step 1: Add new schemas after CompileContractInputSchema**

```typescript
export const VisualizeContractInputSchema = z.object({
  code: z.string().describe("Compact contract source code"),
  version: z.string().optional().describe("Compiler version (e.g. '0.29.0')"),
});

export const ProveContractInputSchema = z.object({
  code: z.string().describe("Compact contract source code"),
  version: z.string().optional().describe("Compiler version (e.g. '0.29.0')"),
});

export const CompileArchiveInputSchema = z.object({
  files: z
    .record(z.string(), z.string())
    .describe(
      "Map of relative file paths to source code. Keys preserve directory structure for import resolution. E.g. { 'src/main.compact': '...', 'src/lib/utils.compact': '...' }",
    ),
  version: z.string().optional().describe("Compiler version (e.g. '0.29.0')"),
  versions: z
    .array(z.string())
    .optional()
    .describe("Multi-version compilation"),
  options: z
    .object({
      skipZk: z.boolean().optional().default(true).describe("Skip ZK generation (default: true)"),
      includeBindings: z.boolean().optional().default(false).describe("Include TypeScript artifacts"),
      libraries: z.array(z.string()).max(20).optional().describe("OZ modules to link"),
    })
    .optional(),
});

export type VisualizeContractInput = z.infer<typeof VisualizeContractInputSchema>;
export type ProveContractInput = z.infer<typeof ProveContractInputSchema>;
export type CompileArchiveInput = z.infer<typeof CompileArchiveInputSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/analyze/schemas.ts
git commit -m "feat: add schemas for visualize, prove, and archive tools"
```

### Task 10: Add Visualize, Prove, and Archive Handlers

**Files:**
- Modify: `src/tools/analyze/handlers.ts`

- [ ] **Step 1: Add handler functions**

Update imports:
```typescript
import { compile, analyze, visualize, prove, compileArchive, buildCacheUrl } from "../../services/playground.js";
import { createTarGzBase64 } from "../../utils/tar.js";
import type {
  AnalyzeContractInput,
  CompileContractInput,
  VisualizeContractInput,
  ProveContractInput,
  CompileArchiveInput,
} from "./schemas.js";
```

Add handlers after existing ones:

```typescript
/**
 * Visualize contract architecture graph
 */
export async function visualizeContract(input: VisualizeContractInput) {
  logger.debug("Visualizing Compact contract architecture");
  const result = await visualize(input.code, { version: input.version });
  return {
    ...result,
    ...(result.cacheKey && { cacheUrl: buildCacheUrl(result.cacheKey) }),
  };
}

/**
 * Analyze ZK privacy boundaries
 */
export async function proveContract(input: ProveContractInput) {
  logger.debug("Analyzing ZK privacy boundaries");
  const result = await prove(input.code, { version: input.version });
  return {
    ...result,
    ...(result.cacheKey && { cacheUrl: buildCacheUrl(result.cacheKey) }),
  };
}

/**
 * Compile a multi-file Compact archive.
 * Converts the files map to a .tar.gz before sending to the playground.
 */
export async function compileArchiveHandler(input: CompileArchiveInput) {
  logger.info("Compiling multi-file Compact archive", {
    fileCount: Object.keys(input.files).length,
  });

  // Create tar.gz from files map
  const archive = await createTarGzBase64(input.files);

  const result = await compileArchive(archive, {
    version: input.version,
    versions: input.versions,
    skipZk: input.options?.skipZk,
    includeBindings: input.options?.includeBindings,
    libraries: input.options?.libraries,
  });

  const cacheKey = (result as Record<string, unknown>).cacheKey as string | undefined;
  return {
    ...result,
    ...(cacheKey && { cacheUrl: buildCacheUrl(cacheKey) }),
  };
}
```

- [ ] **Step 2: Create tar utility**

Create `src/utils/tar.ts`:

```typescript
import { createGzip } from "node:zlib";

/**
 * Create a base64-encoded .tar.gz from a map of relative paths to file contents.
 * Preserves directory structure from keys for correct import resolution.
 */
export async function createTarGzBase64(files: Record<string, string>): Promise<string> {
  // Simple tar implementation — each file gets a 512-byte header + padded content
  const blocks: Buffer[] = [];

  for (const [path, content] of Object.entries(files)) {
    const data = Buffer.from(content, "utf-8");
    const header = createTarHeader(path, data.length);
    blocks.push(header);
    blocks.push(data);
    // Pad to 512-byte boundary
    const padding = 512 - (data.length % 512);
    if (padding < 512) {
      blocks.push(Buffer.alloc(padding));
    }
  }

  // End-of-archive: two 512-byte zero blocks
  blocks.push(Buffer.alloc(1024));

  const tarBuffer = Buffer.concat(blocks);

  // Gzip compress
  return new Promise<string>((resolve, reject) => {
    const gzip = createGzip();
    const chunks: Buffer[] = [];

    gzip.on("data", (chunk: Buffer) => chunks.push(chunk));
    gzip.on("end", () => resolve(Buffer.concat(chunks).toString("base64")));
    gzip.on("error", reject);

    gzip.end(tarBuffer);
  });
}

function createTarHeader(name: string, size: number): Buffer {
  const header = Buffer.alloc(512);

  // Name (100 bytes)
  header.write(name.slice(0, 100), 0, 100, "utf-8");
  // Mode (8 bytes)
  header.write("0000644\0", 100, 8, "utf-8");
  // UID (8 bytes)
  header.write("0001000\0", 108, 8, "utf-8");
  // GID (8 bytes)
  header.write("0001000\0", 116, 8, "utf-8");
  // Size (12 bytes, octal)
  header.write(size.toString(8).padStart(11, "0") + "\0", 124, 12, "utf-8");
  // Mtime (12 bytes)
  const mtime = Math.floor(Date.now() / 1000);
  header.write(mtime.toString(8).padStart(11, "0") + "\0", 136, 12, "utf-8");
  // Checksum placeholder (8 spaces)
  header.write("        ", 148, 8, "utf-8");
  // Type flag: regular file
  header.write("0", 156, 1, "utf-8");

  // Calculate and write checksum
  let checksum = 0;
  for (let i = 0; i < 512; i++) {
    checksum += header[i];
  }
  header.write(checksum.toString(8).padStart(6, "0") + "\0 ", 148, 8, "utf-8");

  return header;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/tools/analyze/handlers.ts src/utils/tar.ts
git commit -m "feat: add visualize, prove, archive handlers with tar utility"
```

### Task 11: Add Visualize, Prove, Archive Tool Definitions

**Files:**
- Modify: `src/tools/analyze/tools.ts`
- Modify: `src/tools/analyze/index.ts`

- [ ] **Step 1: Add new tool definitions to tools.ts**

Add imports for new schemas and handlers:
```typescript
import {
  AnalyzeContractInputSchema,
  CompileContractInputSchema,
  VisualizeContractInputSchema,
  ProveContractInputSchema,
  CompileArchiveInputSchema,
} from "./schemas.js";
import {
  analyzeContract,
  compileContract,
  visualizeContract,
  proveContract,
  compileArchiveHandler,
} from "./handlers.js";
```

Add new entries to the `analyzeTools` array:

```typescript
  {
    name: "midnight-visualize-contract",
    description: `Generate a visual architecture graph of a Compact contract.

Returns a DAG of circuit call relationships, ledger access patterns, and witness dependencies.
Includes a Mermaid diagram string that can be rendered by supporting clients.

Use this for: understanding contract architecture, mapping dependencies, documentation.`,
    inputSchema: zodInputSchema(VisualizeContractInputSchema),
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      title: "Visualize Contract Architecture",
      category: "analyze",
    },
    handler: visualizeContract,
  },
  {
    name: "midnight-prove-contract",
    description: `Analyze ZK privacy boundaries for a Compact contract.

Returns per-circuit analysis of what data crosses the proof boundary, public vs private inputs,
and proof flow. Helps understand the privacy model of a contract.

Use this for: privacy auditing, understanding what's exposed on-chain, proof flow analysis.`,
    inputSchema: zodInputSchema(ProveContractInputSchema),
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      title: "Analyze ZK Privacy Boundaries",
      category: "analyze",
    },
    handler: proveContract,
  },
  {
    name: "midnight-compile-archive",
    description: `Compile a multi-file Compact project.

Accepts a map of relative file paths to source code. Directory structure in the keys is preserved
so that imports between files resolve correctly. The files are packaged into an archive and
sent to the compiler.

Example files map:
  { "src/main.compact": "import ...", "src/lib/utils.compact": "export circuit ..." }

Use this for: projects with multiple Compact source files that import from each other.`,
    inputSchema: zodInputSchema(CompileArchiveInputSchema),
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      title: "Compile Multi-File Archive",
      category: "analyze",
    },
    handler: compileArchiveHandler,
  },
```

- [ ] **Step 2: Update barrel exports in index.ts**

Update `src/tools/analyze/index.ts`:

```typescript
/**
 * Analyze module exports
 * Barrel file for analysis-related tools
 */

// Schemas and types
export {
  AnalyzeContractInputSchema,
  CompileContractInputSchema,
  VisualizeContractInputSchema,
  ProveContractInputSchema,
  CompileArchiveInputSchema,
  type AnalyzeContractInput,
  type CompileContractInput,
  type VisualizeContractInput,
  type ProveContractInput,
  type CompileArchiveInput,
} from "./schemas.js";

// Handlers
export {
  analyzeContract,
  compileContract,
  visualizeContract,
  proveContract,
  compileArchiveHandler,
} from "./handlers.js";

// Tools
export { analyzeTools } from "./tools.js";
```

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/tools/analyze/tools.ts src/tools/analyze/index.ts
git commit -m "feat: add visualize, prove, compile-archive tool definitions"
```

---

## Chunk 5: Simulate Tools Module

### Task 12: Create Simulate Module — Schemas

**Files:**
- Create: `src/tools/simulate/schemas.ts`

- [ ] **Step 1: Create schemas file**

```typescript
import { z } from "zod";

export const SimulateDeployInputSchema = z.object({
  code: z.string().describe("Compact contract source code to deploy for simulation"),
  version: z.string().optional().describe("Compiler version (e.g. '0.29.0')"),
});

export const SimulateCallInputSchema = z.object({
  sessionId: z.string().describe("Simulation session ID returned from midnight-simulate-deploy"),
  circuit: z.string().describe("Name of the circuit to execute"),
  arguments: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Arguments to pass to the circuit"),
});

export const SimulateStateInputSchema = z.object({
  sessionId: z.string().describe("Simulation session ID"),
});

export const SimulateDeleteInputSchema = z.object({
  sessionId: z.string().describe("Simulation session ID to terminate"),
});

export type SimulateDeployInput = z.infer<typeof SimulateDeployInputSchema>;
export type SimulateCallInput = z.infer<typeof SimulateCallInputSchema>;
export type SimulateStateInput = z.infer<typeof SimulateStateInputSchema>;
export type SimulateDeleteInput = z.infer<typeof SimulateDeleteInputSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/simulate/schemas.ts
git commit -m "feat: add simulate tool schemas"
```

### Task 13: Create Simulate Module — Handlers

**Files:**
- Create: `src/tools/simulate/handlers.ts`

- [ ] **Step 1: Create handlers file**

```typescript
import { logger } from "../../utils/index.js";
import {
  simulateDeploy,
  simulateCall,
  simulateState,
  simulateDelete,
} from "../../services/playground.js";
import type {
  SimulateDeployInput,
  SimulateCallInput,
  SimulateStateInput,
  SimulateDeleteInput,
} from "./schemas.js";

export async function handleSimulateDeploy(input: SimulateDeployInput) {
  logger.info("Deploying contract for simulation");
  return simulateDeploy(input.code, { version: input.version });
}

export async function handleSimulateCall(input: SimulateCallInput) {
  logger.info("Calling circuit on simulated contract", {
    sessionId: input.sessionId,
    circuit: input.circuit,
  });
  return simulateCall(input.sessionId, input.circuit, input.arguments);
}

export async function handleSimulateState(input: SimulateStateInput) {
  logger.debug("Reading simulation state", { sessionId: input.sessionId });
  return simulateState(input.sessionId);
}

export async function handleSimulateDelete(input: SimulateDeleteInput) {
  logger.info("Deleting simulation session", { sessionId: input.sessionId });
  return simulateDelete(input.sessionId);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/simulate/handlers.ts
git commit -m "feat: add simulate tool handlers"
```

### Task 14: Create Simulate Module — Tool Definitions and Index

**Files:**
- Create: `src/tools/simulate/tools.ts`
- Create: `src/tools/simulate/index.ts`

- [ ] **Step 1: Create tools.ts**

```typescript
import type { ExtendedToolDefinition } from "../../types/index.js";
import { zodInputSchema } from "../../utils/schema.js";
import {
  SimulateDeployInputSchema,
  SimulateCallInputSchema,
  SimulateStateInputSchema,
  SimulateDeleteInputSchema,
} from "./schemas.js";
import {
  handleSimulateDeploy,
  handleSimulateCall,
  handleSimulateState,
  handleSimulateDelete,
} from "./handlers.js";

export const simulateTools: ExtendedToolDefinition[] = [
  {
    name: "midnight-simulate-deploy",
    description: `Deploy a Compact contract for interactive simulation.

Returns a sessionId that MUST be passed to subsequent simulate calls (midnight-simulate-call,
midnight-simulate-state, midnight-simulate-delete). Sessions expire after 15 minutes of inactivity.

Workflow: deploy → call circuits → inspect state → delete session.`,
    inputSchema: zodInputSchema(SimulateDeployInputSchema),
    annotations: {
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: true,
      title: "Deploy Contract for Simulation",
      category: "analyze",
    },
    handler: handleSimulateDeploy,
  },
  {
    name: "midnight-simulate-call",
    description: `Execute a circuit on a simulated contract.

Requires a sessionId from midnight-simulate-deploy. Returns the circuit result,
state changes, and updated ledger values.`,
    inputSchema: zodInputSchema(SimulateCallInputSchema),
    annotations: {
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: true,
      title: "Call Circuit on Simulation",
      category: "analyze",
    },
    handler: handleSimulateCall,
  },
  {
    name: "midnight-simulate-state",
    description: `Read the current state of a simulation session.

Returns ledger values, available circuits, and call history. Requires a sessionId
from midnight-simulate-deploy.`,
    inputSchema: zodInputSchema(SimulateStateInputSchema),
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      title: "Get Simulation State",
      category: "analyze",
    },
    handler: handleSimulateState,
  },
  {
    name: "midnight-simulate-delete",
    description: `End a simulation session and free resources.

Use when done interacting with a simulated contract. Sessions also auto-expire
after 15 minutes of inactivity.`,
    inputSchema: zodInputSchema(SimulateDeleteInputSchema),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: true,
      title: "Delete Simulation Session",
      category: "analyze",
    },
    handler: handleSimulateDelete,
  },
];
```

- [ ] **Step 2: Create index.ts**

```typescript
/**
 * Simulate module exports
 * Barrel file for simulation-related tools
 */

export {
  SimulateDeployInputSchema,
  SimulateCallInputSchema,
  SimulateStateInputSchema,
  SimulateDeleteInputSchema,
  type SimulateDeployInput,
  type SimulateCallInput,
  type SimulateStateInput,
  type SimulateDeleteInput,
} from "./schemas.js";

export {
  handleSimulateDeploy,
  handleSimulateCall,
  handleSimulateState,
  handleSimulateDelete,
} from "./handlers.js";

export { simulateTools } from "./tools.js";
```

- [ ] **Step 3: Commit**

```bash
git add src/tools/simulate/tools.ts src/tools/simulate/index.ts
git commit -m "feat: add simulate tool definitions and module index"
```

---

## Chunk 6: Health Tools (Versions, Libraries) and Tool Registry

### Task 15: Add Versions and Libraries to Health Module

**Files:**
- Modify: `src/tools/health/schemas.ts`
- Modify: `src/tools/health/handlers.ts`
- Modify: `src/tools/health/tools.ts`
- Modify: `src/tools/health/index.ts`

- [ ] **Step 1: Add schemas**

Add to end of `src/tools/health/schemas.ts`:

```typescript
export const ListCompilerVersionsInputSchema = z.object({});
export const ListLibrariesInputSchema = z.object({});

export type ListCompilerVersionsInput = z.infer<typeof ListCompilerVersionsInputSchema>;
export type ListLibrariesInput = z.infer<typeof ListLibrariesInputSchema>;
```

- [ ] **Step 2: Add handlers**

Add to `src/tools/health/handlers.ts`:

```typescript
import { listVersions, listLibraries } from "../../services/playground.js";
import type { ListCompilerVersionsInput, ListLibrariesInput } from "./schemas.js";
```

Add handler functions:

```typescript
/**
 * List installed compiler versions
 */
export async function handleListCompilerVersions(_input: ListCompilerVersionsInput) {
  return listVersions();
}

/**
 * List available OpenZeppelin Compact libraries
 */
export async function handleListLibraries(_input: ListLibrariesInput) {
  return listLibraries();
}
```

- [ ] **Step 3: Add tool definitions**

Add imports to `src/tools/health/tools.ts`:
```typescript
import {
  HealthCheckInputSchema,
  GetStatusInputSchema,
  CheckVersionInputSchema,
  GetUpdateInstructionsInputSchema,
  ListCompilerVersionsInputSchema,
  ListLibrariesInputSchema,
} from "./schemas.js";
import {
  healthCheck,
  getStatus,
  checkVersion,
  getUpdateInstructions,
  handleListCompilerVersions,
  handleListLibraries,
} from "./handlers.js";
```

Add new entries to `healthTools` array:

```typescript
  {
    name: "midnight-list-compiler-versions",
    description:
      "List all installed Compact compiler versions with their language version mapping. " +
      "Use this to check what compiler versions are available before compiling or analyzing contracts.",
    inputSchema: zodInputSchema(ListCompilerVersionsInputSchema),
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      title: "List Compiler Versions",
      category: "health",
    },
    handler: handleListCompilerVersions,
  },
  {
    name: "midnight-list-libraries",
    description:
      "List available OpenZeppelin Compact modules by domain (access, security, token, utils). " +
      "Use this to check what libraries can be linked when compiling contracts with the libraries parameter.",
    inputSchema: zodInputSchema(ListLibrariesInputSchema),
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      title: "List Available Libraries",
      category: "health",
    },
    handler: handleListLibraries,
  },
```

- [ ] **Step 4: Update barrel exports**

Update `src/tools/health/index.ts`:
```typescript
export {
  HealthCheckInputSchema,
  GetStatusInputSchema,
  CheckVersionInputSchema,
  GetUpdateInstructionsInputSchema,
  ListCompilerVersionsInputSchema,
  ListLibrariesInputSchema,
  type HealthCheckInput,
  type GetStatusInput,
  type CheckVersionInput,
  type GetUpdateInstructionsInput,
  type ListCompilerVersionsInput,
  type ListLibrariesInput,
} from "./schemas.js";

export {
  healthCheck,
  getStatus,
  checkVersion,
  getUpdateInstructions,
  handleListCompilerVersions,
  handleListLibraries,
} from "./handlers.js";

export { healthTools } from "./tools.js";
```

- [ ] **Step 5: Commit**

```bash
git add src/tools/health/
git commit -m "feat: add list-compiler-versions and list-libraries tools"
```

### Task 16: Register Simulate Tools in Main Index

**Files:**
- Modify: `src/tools/index.ts`

- [ ] **Step 1: Add simulate imports and registration**

Add to `src/tools/index.ts`:

```typescript
// Simulate tools
export {
  simulateTools,
  handleSimulateDeploy,
  handleSimulateCall,
  handleSimulateState,
  handleSimulateDelete,
  SimulateDeployInputSchema,
  SimulateCallInputSchema,
  SimulateStateInputSchema,
  SimulateDeleteInputSchema,
  type SimulateDeployInput,
  type SimulateCallInput,
  type SimulateStateInput,
  type SimulateDeleteInput,
} from "./simulate/index.js";
```

Add import and include in `allTools`:

```typescript
import { simulateTools } from "./simulate/index.js";

export const allTools: ExtendedToolDefinition[] = [
  ...metaTools,
  ...searchTools,
  ...analyzeTools,
  ...formatTools,
  ...diffTools,
  ...simulateTools,
  ...repositoryTools,
  ...healthTools,
];
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/tools/index.ts
git commit -m "feat: register simulate tools in main tool index"
```

### Task 17: Update Meta Tool Count

**Files:**
- Modify: `src/tools/meta/tools.ts`

- [ ] **Step 1: Find and update hardcoded tool count**

Search for the hardcoded number in the meta tools description and update it to 32.

- [ ] **Step 2: Commit**

```bash
git add src/tools/meta/tools.ts
git commit -m "chore: update meta tool count to 32"
```

---

## Chunk 7: Dashboard Updates

### Task 18: Add Playground Section to Dashboard

**Files:**
- Modify: `api/src/templates/dashboard.ts`

- [ ] **Step 1: Add playground section to generateDashboardContent**

In `api/src/templates/dashboard.ts`, update `generateDashboardContent` to include a playground section. After the existing overview and activity sections, add:

```typescript
${generatePlaygroundSection(metrics)}
```

Add the playground section generator function:

```typescript
/**
 * Generate playground analytics section
 */
function generatePlaygroundSection(metrics: Metrics): string {
  const pgCalls = metrics.playgroundCalls || 0;
  const pgByEndpoint = metrics.playgroundByEndpoint || {};
  const pgByVersion = metrics.playgroundByVersion || {};
  const pgErrors = metrics.playgroundErrors || 0;

  if (pgCalls === 0) {
    return generateCard(
      generateEmptyState("No playground activity recorded yet", { icon: "🔧" }),
      { title: "Playground" }
    );
  }

  const errorRate = pgCalls > 0 ? Math.round((pgErrors / pgCalls) * 100) : 0;

  const endpointCard = generateCard(
    generateBarChart(pgByEndpoint, pgCalls, {
      maxItems: 10,
      emptyMessage: "No endpoint data",
    }),
    { title: "Playground — By Endpoint" }
  );

  const versionCard = generateCard(
    generateBarChart(pgByVersion, pgCalls, {
      maxItems: 8,
      emptyMessage: "No version data",
    }),
    { title: "Playground — By Compiler Version" }
  );

  const summaryHtml = `
    <div style="display: flex; gap: 24px; margin-bottom: 16px;">
      <div><strong>${pgCalls.toLocaleString()}</strong> total requests</div>
      <div><strong>${errorRate}%</strong> error rate</div>
      <div><strong>${Object.keys(pgByEndpoint).length}</strong> endpoints used</div>
      <div><strong>${Object.keys(pgByVersion).length}</strong> compiler versions</div>
    </div>
  `;

  const summaryCard = generateCard(summaryHtml, { title: "Playground — Overview" });

  return `
    <h2 style="margin: 32px 0 16px; color: #eee;">Playground Analytics</h2>
    ${summaryCard}
    ${generateGrid([endpointCard, versionCard])}
  `;
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `cd api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add api/src/templates/dashboard.ts
git commit -m "feat(api): add playground analytics section to dashboard"
```

---

## Chunk 8: Final Verification

### Task 19: Full Build and Test

- [ ] **Step 1: Run all MCP server tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run TypeScript check for MCP server**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run TypeScript check for API**

Run: `cd api && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Build the project**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Verify tool count**

Run: `node -e "const {allTools} = require('./dist/tools/index.js'); console.log('Tool count:', allTools.length)"`
Expected: `Tool count: 32`

- [ ] **Step 6: Commit any remaining fixes**

If any fixes were needed, commit them:
```bash
git add -A
git commit -m "fix: address build/test issues from playground full proxy implementation"
```
