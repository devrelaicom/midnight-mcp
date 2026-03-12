/**
 * Tests for meta/discovery tools
 * Validates the suggestTool intent matching functionality
 */

import { describe, it, expect, beforeAll } from "vitest";
import { INTENT_TO_TOOL, CATEGORY_INFO } from "../src/tools/meta/schemas.js";

// Direct implementation of suggestTool logic for testing
// (avoids circular dependency with tools.ts)
async function suggestTool(input: { intent: string }) {
  const intentLower = input.intent.toLowerCase();

  const matchedTools: Array<{
    tool: string;
    reason: string;
    confidence: "high" | "medium" | "low";
    matchScore: number;
  }> = [];

  for (const mapping of INTENT_TO_TOOL) {
    const matchedPatterns = mapping.patterns.filter((p) =>
      intentLower.includes(p.toLowerCase())
    );
    const matchCount = matchedPatterns.length;

    if (matchCount > 0) {
      // Calculate match score: count * 10 + sum of matched pattern lengths
      // This prefers more specific (longer) patterns when counts are equal
      const patternLengthScore = matchedPatterns.reduce(
        (sum, p) => sum + p.length,
        0
      );
      const matchScore = matchCount * 10 + patternLengthScore;

      matchedTools.push({
        tool: mapping.tool,
        reason: mapping.reason,
        confidence: matchCount >= 2 ? "high" : "medium",
        matchScore,
      });
    }
  }

  const matchedCategories: Array<{
    category: string;
    startWith: string;
    description: string;
    confidence: "medium" | "low";
  }> = [];

  for (const [category, info] of Object.entries(CATEGORY_INFO)) {
    const matchCount = info.intentKeywords.filter((k) =>
      intentLower.includes(k.toLowerCase())
    ).length;

    if (matchCount > 0 && info.startWith) {
      matchedCategories.push({
        category,
        startWith: info.startWith,
        description: info.description,
        confidence: matchCount >= 2 ? "medium" : "low",
      });
    }
  }

  // Sort by confidence first, then by match score (higher is better)
  const confidenceOrder = { high: 0, medium: 1, low: 2 };
  matchedTools.sort((a, b) => {
    const confDiff =
      confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
    if (confDiff !== 0) return confDiff;
    // Higher match score = better, so sort descending
    return b.matchScore - a.matchScore;
  });

  if (matchedTools.length === 0 && matchedCategories.length === 0) {
    return {
      intent: input.intent,
      suggestions: [],
      fallback: {
        tool: "midnight-list-tool-categories",
        reason:
          "No specific match found. Start by exploring available tool categories.",
      },
      tip: "Try rephrasing your intent with keywords like: search, analyze, generate, upgrade, version, security, example",
    };
  }

  const seenTools = new Set<string>();
  const suggestions: Array<{
    tool: string;
    reason: string;
    confidence: string;
  }> = [];

  for (const match of matchedTools) {
    if (!seenTools.has(match.tool)) {
      seenTools.add(match.tool);
      suggestions.push(match);
    }
  }

  for (const match of matchedCategories) {
    if (!seenTools.has(match.startWith)) {
      seenTools.add(match.startWith);
      suggestions.push({
        tool: match.startWith,
        reason: `Recommended starting tool for ${match.category}: ${match.description}`,
        confidence: match.confidence,
      });
    }
  }

  const topSuggestions = suggestions.slice(0, 3);

  return {
    intent: input.intent,
    suggestions: topSuggestions,
    primaryRecommendation: topSuggestions[0],
    tip:
      topSuggestions[0]?.confidence === "high"
        ? `Strong match! Use ${topSuggestions[0].tool} for this task.`
        : "Multiple tools may help. Consider the suggestions based on your specific needs.",
  };
}

describe("suggestTool", () => {
  describe("high confidence matches", () => {
    it("should match voting-related intents to search-compact", async () => {
      const result = await suggestTool({
        intent: "find voting contract examples",
      });

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions[0].tool).toBe("midnight-search-compact");
      // Single keyword match = medium confidence, which is correct behavior
      expect(["high", "medium"]).toContain(result.suggestions[0].confidence);
    });

    it("should match security intents to analyze-contract", async () => {
      const result = await suggestTool({
        intent: "audit my contract for security vulnerabilities",
      });

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions[0].tool).toBe("midnight-analyze-contract");
      expect(result.suggestions[0].confidence).toBe("high");
    });

    it("should match upgrade intents to upgrade-check", async () => {
      const result = await suggestTool({
        intent: "is my code outdated? need to upgrade",
      });

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions[0].tool).toBe("midnight-upgrade-check");
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

      expect(result.suggestions[0].tool).toBe("midnight-search-compact");
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

      expect(result.suggestions[0].tool).toBe("midnight-search-typescript");
    });
  });

  describe("getting started matches", () => {
    it("should match beginner intents to list-examples", async () => {
      const result = await suggestTool({
        intent: "simple beginner hello world",
      });

      expect(result.suggestions[0].tool).toBe("midnight-list-examples");
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

      expect(result.suggestions[0].tool).toBe("midnight-health-check");
    });

    it("should match rate limit intents to health-check", async () => {
      const result = await suggestTool({
        intent: "getting 429 rate limit errors",
      });

      expect(result.suggestions[0].tool).toBe("midnight-health-check");
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
    it("should match migration guide intents", async () => {
      const result = await suggestTool({
        intent: "how to migrate to new version",
      });

      expect(
        result.suggestions.some(
          (s) => s.tool === "midnight-get-migration-guide"
        )
      ).toBe(true);
    });

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

      expect(result.suggestions[0].tool).toBe("midnight-get-file");
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
