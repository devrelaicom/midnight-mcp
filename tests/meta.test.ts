/**
 * Tests for meta/discovery tools
 * Validates the suggestTool intent matching functionality
 * Uses the real handler — not a copy of the business logic
 */

import { describe, it, expect, vi } from "vitest";

// Mock the dependency chain so we can import the real suggestTool handler.
// The handlers module imports tool arrays that trigger deep circular deps.
vi.mock("../src/utils/config.js", () => ({
  config: { hostedApiUrl: "https://api.test", mode: "hosted", embeddingModel: "text-embedding-3-small" },
  isHostedMode: () => true,
  isLocalMode: () => false,
  DEFAULT_REPOSITORIES: [],
}));
vi.mock("../src/utils/index.js", () => ({
  config: { hostedApiUrl: "https://api.test", mode: "hosted", embeddingModel: "text-embedding-3-small" },
  isHostedMode: () => true,
  isLocalMode: () => false,
  DEFAULT_REPOSITORIES: [],
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  MCPError: class extends Error { code: string; constructor(m: string, c: string) { super(m); this.code = c; } },
  ErrorCodes: { INVALID_INPUT: "INVALID_INPUT", INTERNAL_ERROR: "INTERNAL_ERROR" },
  createErrorResponse: () => ({ content: [{ type: "text", text: "error" }] }),
  formatErrorResponse: () => ({ content: [{ type: "text", text: "error" }] }),
  createUserError: () => new Error("user error"),
}));
// Stub tool arrays to break circular init — suggestTool only uses schemas, not tool arrays
vi.mock("../src/tools/search/index.js", () => ({ searchTools: [] }));
vi.mock("../src/tools/analyze/index.js", () => ({ analyzeTools: [] }));
vi.mock("../src/tools/repository/index.js", () => ({ repositoryTools: [] }));
vi.mock("../src/tools/health/index.js", () => ({ healthTools: [] }));
vi.mock("../src/tools/format/index.js", () => ({ formatTools: [] }));
vi.mock("../src/tools/diff/index.js", () => ({ diffTools: [] }));
vi.mock("../src/tools/simulate/index.js", () => ({ simulateTools: [] }));
// Stub tools.ts to prevent circular setMetaTools call
vi.mock("../src/tools/meta/tools.js", () => ({ metaTools: [] }));

import { suggestTool } from "../src/tools/meta/handlers.js";

describe("suggestTool", () => {
  describe("high confidence matches", () => {
    it("should match voting-related intents to search-compact", async () => {
      const result = await suggestTool({
        intent: "find voting contract examples",
      });

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions[0]!.tool).toBe("midnight-search-compact");
      // Single keyword match = medium confidence, which is correct behavior
      expect(["high", "medium"]).toContain(result.suggestions[0]!.confidence);
    });

    it("should match security intents to analyze-contract", async () => {
      const result = await suggestTool({
        intent: "audit my contract for security vulnerabilities",
      });

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions[0]!.tool).toBe("midnight-analyze-contract");
      expect(result.suggestions[0]!.confidence).toBe("high");
    });

    it("should match upgrade intents to upgrade-check", async () => {
      const result = await suggestTool({
        intent: "is my code outdated? need to upgrade",
      });

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions[0]!.tool).toBe("midnight-upgrade-check");
    });

  });

  describe("domain-specific matches", () => {
    it("should match NFT intents", async () => {
      const result = await suggestTool({
        intent: "how to create an NFT contract",
      });

      expect(
        result.suggestions.some((s) => s.tool === "midnight-search-compact")
      ).toBe(true);
    });

    it("should match token intents", async () => {
      const result = await suggestTool({
        intent: "token transfer balance mint",
      });

      expect(result.suggestions[0]!.tool).toBe("midnight-search-compact");
    });

    it("should match DAO/governance intents", async () => {
      const result = await suggestTool({
        intent: "build a dao governance system",
      });

      expect(
        result.suggestions.some((s) => s.tool === "midnight-search-compact")
      ).toBe(true);
    });

    it("should match TypeScript SDK intents", async () => {
      const result = await suggestTool({
        intent: "typescript sdk integration",
      });

      expect(result.suggestions[0]!.tool).toBe("midnight-search-typescript");
    });
  });

  describe("getting started matches", () => {
    it("should match beginner intents to list-examples", async () => {
      const result = await suggestTool({
        intent: "simple beginner hello world",
      });

      expect(result.suggestions[0]!.tool).toBe("midnight-list-examples");
    });

    it("should match onboarding intents to get-repo-context", async () => {
      const result = await suggestTool({
        intent: "I'm new to midnight and want to get started",
      });

      expect(
        result.suggestions.some((s) => s.tool === "midnight-get-repo-context")
      ).toBe(true);
    });
  });

  describe("health and status matches", () => {
    it("should match error/broken intents to health-check", async () => {
      const result = await suggestTool({
        intent: "server not working broken error",
      });

      expect(result.suggestions[0]!.tool).toBe("midnight-health-check");
    });

    it("should match rate limit intents to health-check", async () => {
      const result = await suggestTool({
        intent: "getting 429 rate limit errors",
      });

      expect(result.suggestions[0]!.tool).toBe("midnight-health-check");
    });

    it("should match server status intents", async () => {
      const result = await suggestTool({ intent: "check server status" });

      expect(
        result.suggestions.some((s) => s.tool === "midnight-get-status")
      ).toBe(true);
    });
  });

  describe("documentation matches", () => {
    it("should route 'fetch docs' to fetch-docs, not search-docs", async () => {
      const result = await suggestTool({
        intent: "fetch the latest docs",
      });

      // fetch-docs should be the primary suggestion (first or highest confidence)
      const fetchDocsSuggestion = result.suggestions.find(
        (s) => s.tool === "midnight-fetch-docs"
      );
      const searchDocsSuggestion = result.suggestions.find(
        (s) => s.tool === "midnight-search-docs"
      );

      expect(fetchDocsSuggestion).toBeDefined();
      // fetch-docs should appear before search-docs or have higher confidence
      if (searchDocsSuggestion && fetchDocsSuggestion) {
        const fetchIndex = result.suggestions.indexOf(fetchDocsSuggestion);
        const searchIndex = result.suggestions.indexOf(searchDocsSuggestion);
        expect(fetchIndex).toBeLessThan(searchIndex);
      }
    });

    it("should route general 'show me docs' to search-docs", async () => {
      const result = await suggestTool({
        intent: "show me the documentation about witnesses",
      });

      // search-docs should match for discovery queries
      expect(
        result.suggestions.some((s) => s.tool === "midnight-search-docs")
      ).toBe(true);
    });
  });

  describe("version and migration matches", () => {
    it("should match syntax comparison intents", async () => {
      const result = await suggestTool({
        intent: "compare syntax between versions",
      });

      expect(
        result.suggestions.some((s) => s.tool === "midnight-compare-syntax")
      ).toBe(true);
    });

    it("should match breaking changes intents", async () => {
      const result = await suggestTool({
        intent: "what breaking changes are there",
      });

      expect(
        result.suggestions.some(
          (s) =>
            s.tool === "midnight-check-breaking-changes" ||
            s.tool === "midnight-upgrade-check"
        )
      ).toBe(true);
    });
  });

  describe("file and repository matches", () => {
    it("should match file retrieval intents", async () => {
      const result = await suggestTool({
        intent: "get file content from repo",
      });

      expect(result.suggestions[0]!.tool).toBe("midnight-get-file");
    });

    it("should match recent updates intents", async () => {
      const result = await suggestTool({
        intent: "what's new in recent changes",
      });

      expect(
        result.suggestions.some((s) => s.tool === "midnight-get-latest-updates")
      ).toBe(true);
    });

    it("should match contract structure intents", async () => {
      const result = await suggestTool({
        intent: "extract contract structure and anatomy",
      });

      expect(
        result.suggestions.some(
          (s) => s.tool === "midnight-analyze-contract"
        )
      ).toBe(true);
    });
  });

  describe("fallback behavior", () => {
    it("should provide fallback for unrecognized intents", async () => {
      const result = await suggestTool({ intent: "xyzabc123 nonsense query" });

      expect(result.fallback).toBeDefined();
      expect(result.fallback?.tool).toBe("midnight-list-tool-categories");
      expect(result.tip).toContain("Try rephrasing");
    });

    it("should always return suggestions array", async () => {
      const result = await suggestTool({ intent: "random unknown request" });

      expect(Array.isArray(result.suggestions)).toBe(true);
    });
  });

  describe("response structure", () => {
    it("should include primaryRecommendation for matches", async () => {
      const result = await suggestTool({ intent: "search for voting" });

      expect(result.primaryRecommendation).toBeDefined();
      expect(result.primaryRecommendation?.tool).toBeDefined();
    });

    it("should include tip in response", async () => {
      const result = await suggestTool({ intent: "audit security" });

      expect(result.tip).toBeDefined();
    });

    it("should limit suggestions to 3", async () => {
      // Query that matches multiple categories
      const result = await suggestTool({
        intent: "find and analyze voting contract with security audit",
      });

      expect(result.suggestions.length).toBeLessThanOrEqual(3);
    });
  });

  describe("meta tool matches", () => {
    it("should match tool listing intents", async () => {
      const result = await suggestTool({ intent: "what tools are available" });

      expect(
        result.suggestions.some(
          (s) => s.tool === "midnight-list-tool-categories"
        )
      ).toBe(true);
    });
  });
});
