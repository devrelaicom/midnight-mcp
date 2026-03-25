/**
 * Mock Cloudflare Worker bindings for testing.
 * Provides in-memory implementations of D1, KV, RateLimit, and Vectorize.
 */

import type { Bindings } from "../../src/interfaces";

// ---------------------------------------------------------------------------
// Mock execution context (required by Hono Workers handlers)
// ---------------------------------------------------------------------------
export function createMockExecutionCtx(): ExecutionContext {
  return {
    waitUntil: () => {},
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;
}

// ---------------------------------------------------------------------------
// In-memory KV mock
// ---------------------------------------------------------------------------
export function createMockKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
    getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
  } as unknown as KVNamespace;
}

// ---------------------------------------------------------------------------
// In-memory D1 mock
// ---------------------------------------------------------------------------
export function createMockD1(): D1Database {
  const mockStatement = {
    bind: () => mockStatement,
    first: async () => null,
    all: async () => ({ results: [], success: true, meta: {} }),
    run: async () => ({ success: true, meta: {} }),
    raw: async () => [],
  };

  return {
    prepare: () => mockStatement,
    batch: async (stmts: unknown[]) => stmts.map(() => ({ results: [], success: true, meta: {} })),
    exec: async () => ({ count: 0, duration: 0 }),
    dump: async () => new ArrayBuffer(0),
  } as unknown as D1Database;
}

// ---------------------------------------------------------------------------
// Mock RateLimit
// ---------------------------------------------------------------------------
export function createMockRateLimit(success = true) {
  return {
    limit: async () => ({ success }),
  };
}

// ---------------------------------------------------------------------------
// Mock Vectorize
// ---------------------------------------------------------------------------
export function createMockVectorize() {
  return {
    query: async () => ({ matches: [], count: 0 }),
    insert: async () => ({ mutationId: "mock" }),
    upsert: async () => ({ mutationId: "mock" }),
    deleteByIds: async () => ({ mutationId: "mock" }),
    getByIds: async () => [],
    describe: async () => ({ dimensions: 1536, metric: "cosine" }),
  };
}

// ---------------------------------------------------------------------------
// Complete mock bindings
// ---------------------------------------------------------------------------
export function createMockBindings(overrides: Partial<Bindings> = {}): Bindings {
  return {
    VECTORIZE: createMockVectorize() as unknown as VectorizeIndex,
    OPENAI_API_KEY: "test-openai-key",
    ENVIRONMENT: "test",
    METRICS: createMockKV(),
    DB: createMockD1(),
    GITHUB_CLIENT_ID: "test-client-id",
    GITHUB_CLIENT_SECRET: "test-client-secret",
    DASHBOARD_ALLOWED_ORGS: "test-org",
    RATE_LIMIT_ANON: createMockRateLimit() as unknown as RateLimit,
    RATE_LIMIT_AUTH: createMockRateLimit() as unknown as RateLimit,
    COMPACT_PLAYGROUND_URL: "https://playground.test",
    ...overrides,
  };
}
