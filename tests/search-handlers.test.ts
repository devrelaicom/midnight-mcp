/**
 * Node search handler behavioral tests.
 * Verifies that searchCompact, searchTypeScript, and searchDocs
 * forward parameters correctly to the hosted API and handle errors.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSearchCompactHosted, mockSearchTypeScriptHosted, mockSearchDocsHosted } = vi.hoisted(
  () => ({
    mockSearchCompactHosted: vi.fn(),
    mockSearchTypeScriptHosted: vi.fn(),
    mockSearchDocsHosted: vi.fn(),
  }),
);

// Mock config (must come before handler imports)
vi.mock("../src/utils/config.js", () => ({
  config: {
    hostedApiUrl: "https://api.test",
    mode: "hosted",
    embeddingModel: "text-embedding-3-small",
  },
  clientId: "test-client-id",
  isHostedMode: () => true,
  isLocalMode: () => false,
  DEFAULT_REPOSITORIES: [],
}));

vi.mock("../src/utils/index.js", () => ({
  config: {
    hostedApiUrl: "https://api.test",
    mode: "hosted",
    embeddingModel: "text-embedding-3-small",
  },
  isHostedMode: () => true,
  isLocalMode: () => false,
  DEFAULT_REPOSITORIES: [],
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  MCPError: class extends Error {
    code: string;
    constructor(m: string, c: string) {
      super(m);
      this.code = c;
    }
  },
  ErrorCodes: { INVALID_INPUT: "INVALID_INPUT", INTERNAL_ERROR: "INTERNAL_ERROR" },
  validateQuery: (q: string) => {
    if (!q || q.trim().length < 2) {
      return { isValid: false, errors: ["Query too short"], warnings: [], sanitized: q };
    }
    return { isValid: true, errors: [], warnings: [], sanitized: q.trim() };
  },
  validateNumber: (_v: unknown, opts: { defaultValue: number }) => ({
    value: opts.defaultValue,
    warnings: [],
  }),
  searchCache: { get: () => null, set: vi.fn() },
  createCacheKey: (...args: unknown[]) => args.join(":"),
  searchCompactHosted: mockSearchCompactHosted,
  searchTypeScriptHosted: mockSearchTypeScriptHosted,
  searchDocsHosted: mockSearchDocsHosted,
  extractContentFromHtml: vi.fn(),
}));

vi.mock("../src/db/index.js", () => ({
  vectorStore: { search: vi.fn(async () => []) },
}));

vi.mock("../src/pipeline/embeddings.js", () => ({
  embeddingGenerator: { isDummyMode: false },
}));

vi.mock("../src/utils/version.js", () => ({
  CURRENT_VERSION: "0.0.0-test",
}));

import { searchCompact, searchTypeScript, searchDocs } from "../src/tools/search/handlers.js";

describe("Node search handlers — hosted mode behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("searchCompact", () => {
    it("forwards filter.repository to the hosted API", async () => {
      mockSearchCompactHosted.mockResolvedValueOnce({
        results: [
          {
            code: "contract {}",
            relevanceScore: 0.9,
            source: { repository: "compact", filePath: "/test.compact" },
          },
        ],
        totalResults: 1,
      });

      await searchCompact({
        query: "counter",
        limit: 10,
        filter: { repository: "midnight-examples" },
      });

      expect(mockSearchCompactHosted).toHaveBeenCalledOnce();
      const [, , filter] = mockSearchCompactHosted.mock.calls[0]!;
      expect(filter).toEqual({ repository: "midnight-examples" });
    });

    it("calls hosted API without filter when none provided", async () => {
      mockSearchCompactHosted.mockResolvedValueOnce({
        results: [],
        totalResults: 0,
      });

      await searchCompact({ query: "counter", limit: 10 });

      expect(mockSearchCompactHosted).toHaveBeenCalledOnce();
      const [, , filter] = mockSearchCompactHosted.mock.calls[0]!;
      expect(filter).toBeUndefined();
    });

    it("throws MCPError for invalid query", async () => {
      await expect(searchCompact({ query: "", limit: 10 })).rejects.toThrow("Invalid query");
    });
  });

  describe("searchTypeScript", () => {
    it("forwards includeTypes to the hosted API", async () => {
      mockSearchTypeScriptHosted.mockResolvedValueOnce({
        results: [],
        totalResults: 0,
      });

      await searchTypeScript({ query: "wallet api", includeTypes: false, limit: 10 });

      expect(mockSearchTypeScriptHosted).toHaveBeenCalledOnce();
      const [, , includeTypes] = mockSearchTypeScriptHosted.mock.calls[0]!;
      expect(includeTypes).toBe(false);
    });

    it("defaults includeTypes to true", async () => {
      mockSearchTypeScriptHosted.mockResolvedValueOnce({
        results: [],
        totalResults: 0,
      });

      await searchTypeScript({ query: "wallet api", includeTypes: true, limit: 10 });

      const [, , includeTypes] = mockSearchTypeScriptHosted.mock.calls[0]!;
      expect(includeTypes).toBe(true);
    });
  });

  describe("searchDocs", () => {
    it("forwards category to the hosted API", async () => {
      mockSearchDocsHosted.mockResolvedValueOnce({
        results: [],
        totalResults: 0,
      });

      await searchDocs({ query: "how to install", category: "guides", limit: 10 });

      expect(mockSearchDocsHosted).toHaveBeenCalledOnce();
      const [, , category] = mockSearchDocsHosted.mock.calls[0]!;
      expect(category).toBe("guides");
    });

    it("defaults category to all", async () => {
      mockSearchDocsHosted.mockResolvedValueOnce({
        results: [],
        totalResults: 0,
      });

      await searchDocs({ query: "overview", category: "all", limit: 10 });

      const [, , category] = mockSearchDocsHosted.mock.calls[0]!;
      expect(category).toBe("all");
    });

    it("includes freshness hint in response", async () => {
      mockSearchDocsHosted.mockResolvedValueOnce({
        results: [
          {
            content: "Install guide",
            relevanceScore: 0.8,
            source: { repository: "docs", filePath: "/install.md" },
          },
        ],
        totalResults: 1,
      });

      const result = await searchDocs({ query: "install", category: "all", limit: 10 });
      expect(result).toHaveProperty("hint");
      expect((result as Record<string, unknown>).hint).toContain("midnight-fetch-docs");
    });
  });
});
