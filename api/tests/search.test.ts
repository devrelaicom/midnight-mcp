/**
 * Search route tests.
 * Verifies the Worker search routes honor the MCP tool contract:
 * - filter.repository is forwarded to Vectorize
 * - includeTypes=false filters out type/interface results
 * - category filters docs by file path conventions
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "../src/index";
import { createMockBindings, createMockExecutionCtx } from "./helpers/mock-bindings";

// Stub embedding generation — returns a fixed vector
vi.mock("../src/services/embeddings", () => ({
  getEmbedding: vi.fn(async () => new Array(1536).fill(0)),
}));

// Stub query tracking — no-op
vi.mock("../src/services/metrics", () => ({
  trackQuery: vi.fn(async () => {}),
  recordSearchMetrics: vi.fn(),
  recordToolMetrics: vi.fn(),
  getMetrics: vi.fn(async () => ({})),
}));

function createMatchWithMetadata(overrides: Record<string, unknown> = {}) {
  return {
    id: "vec-1",
    score: 0.9,
    metadata: {
      content: "test content",
      repository: "compact",
      filePath: "/src/example.compact",
      startLine: 1,
      endLine: 10,
      codeType: "function",
      codeName: "example",
      language: "compact",
      isPublic: true,
      ...overrides,
    },
  };
}

function postSearch(path: string, body: Record<string, unknown>, env: ReturnType<typeof createMockBindings>) {
  return app.request(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    env,
    createMockExecutionCtx(),
  );
}

describe("Search routes — MCP tool contract", () => {
  let env: ReturnType<typeof createMockBindings>;
  let querySpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    querySpy = vi.fn(async () => ({
      matches: [createMatchWithMetadata()],
      count: 1,
    }));
    const vectorize = { query: querySpy } as unknown as VectorizeIndex;
    env = createMockBindings({ VECTORIZE: vectorize });
  });

  it("POST /v1/search/compact forwards filter.repository to Vectorize", async () => {
    const res = await postSearch("/v1/search/compact", {
      query: "counter contract",
      filter: { repository: "midnight-examples" },
    }, env);

    expect(res.status).toBe(200);
    const filterArg = querySpy.mock.calls[0][1].filter;
    expect(filterArg).toEqual({
      language: "compact",
      repository: "midnight-examples",
    });
  });

  it("POST /v1/search/compact without filter uses endpoint default only", async () => {
    const res = await postSearch("/v1/search/compact", {
      query: "counter contract",
    }, env);

    expect(res.status).toBe(200);
    const filterArg = querySpy.mock.calls[0][1].filter;
    expect(filterArg).toEqual({ language: "compact" });
  });

  it("POST /v1/search/typescript with includeTypes=false filters out type results", async () => {
    querySpy.mockResolvedValueOnce({
      matches: [
        createMatchWithMetadata({ codeType: "function", codeName: "buildTx", language: "typescript" }),
        createMatchWithMetadata({ codeType: "type", codeName: "TxParams", language: "typescript" }),
        createMatchWithMetadata({ codeType: "interface", codeName: "IWallet", language: "typescript" }),
      ],
      count: 3,
    });

    const res = await postSearch("/v1/search/typescript", {
      query: "build transaction",
      includeTypes: false,
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(1);
    expect(body.results[0].content).toContain("test content");
  });

  it("POST /v1/search/typescript with includeTypes=true (default) keeps all results", async () => {
    querySpy.mockResolvedValueOnce({
      matches: [
        createMatchWithMetadata({ codeType: "function", language: "typescript" }),
        createMatchWithMetadata({ codeType: "type", language: "typescript" }),
      ],
      count: 2,
    });

    const res = await postSearch("/v1/search/typescript", {
      query: "build transaction",
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(2);
  });

  it("POST /v1/search/docs with category filters by file path", async () => {
    querySpy.mockResolvedValueOnce({
      matches: [
        createMatchWithMetadata({ filePath: "/develop/faq.md", language: "markdown" }),
        createMatchWithMetadata({ filePath: "/api/reference.md", language: "markdown" }),
        createMatchWithMetadata({ filePath: "/getting-started/install.md", language: "markdown" }),
      ],
      count: 3,
    });

    const res = await postSearch("/v1/search/docs", {
      query: "how to install",
      category: "guides",
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    // Only /develop/faq.md and /getting-started/install.md match "guides" category
    expect(body.results).toHaveLength(2);
  });

  it("POST /v1/search/docs with category=all returns all results", async () => {
    querySpy.mockResolvedValueOnce({
      matches: [
        createMatchWithMetadata({ filePath: "/develop/faq.md", language: "markdown" }),
        createMatchWithMetadata({ filePath: "/api/reference.md", language: "markdown" }),
      ],
      count: 2,
    });

    const res = await postSearch("/v1/search/docs", {
      query: "midnight overview",
      category: "all",
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(2);
  });

  it("POST /v1/search (generic) merges request-body language filter", async () => {
    const res = await postSearch("/v1/search", {
      query: "test query",
      filter: { language: "compact" },
    }, env);

    expect(res.status).toBe(200);
    const filterArg = querySpy.mock.calls[0][1].filter;
    expect(filterArg).toEqual({ language: "compact" });
  });
});
