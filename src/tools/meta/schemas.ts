/**
 * Meta tool input schemas
 * Zod schemas for validating tool inputs
 */

import { z } from "zod";
import type { ToolCategory } from "../../types/index.js";

// Schema definitions
export const ListToolCategoriesInputSchema = z.object({
  includeToolCounts: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include number of tools per category"),
});

export const ListCategoryToolsInputSchema = z.object({
  category: z
    .enum([
      "search",
      "analyze",
      "repository",
      "versioning",
      "generation",
      "health",
      "meta",
      "compound",
    ])
    .describe("Category to list tools for"),
  includeSchemas: z.boolean().optional().default(false).describe("Include input/output schemas"),
});

export const SuggestToolInputSchema = z.object({
  intent: z
    .string()
    .describe(
      "What you want to accomplish (e.g., 'find example voting contract', 'check if my version is outdated', 'analyze my contract for security issues')",
    ),
});

// Type exports
export type ListToolCategoriesInput = z.infer<typeof ListToolCategoriesInputSchema>;
export type ListCategoryToolsInput = z.infer<typeof ListCategoryToolsInputSchema>;
export type SuggestToolInput = z.infer<typeof SuggestToolInputSchema>;

// Category info type
export interface CategoryInfo {
  description: string;
  useCases: string[];
  intentKeywords: string[]; // Keywords that suggest this category
  startWith?: string; // Recommended tool to start with
}

// Category descriptions with intent matching
export const CATEGORY_INFO: Record<ToolCategory, CategoryInfo> = {
  search: {
    description: "Semantic search across Midnight codebase - find code by meaning, not keywords",
    useCases: ["Find example implementations", "Search for patterns", "Discover relevant code"],
    intentKeywords: [
      // Core search verbs
      "find",
      "search",
      "look for",
      "locate",
      "discover",
      "explore",
      // Question patterns
      "example",
      "how to",
      "show me",
      "where is",
      "what is",
      "can i see",
      "give me",
      // Code-specific
      "pattern",
      "implementation",
      "code for",
      "sample",
      "snippet",
      "reference",
      "similar to",
    ],
    startWith: "midnight-search-compact",
  },
  analyze: {
    description: "Analyze, format, diff, and compile Compact contracts via the playground API",
    useCases: ["Security audit", "Code review", "Format contracts", "Compare contract versions"],
    intentKeywords: [
      // Analysis verbs
      "analyze",
      "check",
      "inspect",
      "examine",
      "evaluate",
      "assess",
      // Security-related
      "security",
      "audit",
      "vulnerability",
      "vulnerabilities",
      "safe",
      "secure",
      "risk",
      // Understanding
      "review",
      "structure",
      "explain",
      "understand",
      "what does",
      "breakdown",
      "how does",
      "meaning of",
      // Format & Diff
      "format",
      "diff",
      "compare contract",
      "compile",
    ],
    startWith: "midnight-analyze-contract",
  },
  repository: {
    description: "Access repository files, examples, and recent updates",
    useCases: ["Get specific files", "List examples", "Track repository changes"],
    intentKeywords: [
      // File access
      "get file",
      "fetch",
      "download",
      "read file",
      "open",
      "source code",
      "raw",
      // Listing
      "list",
      "examples",
      "show examples",
      "available",
      "what examples",
      // Repository state
      "recent",
      "updates",
      "changes",
      "commits",
      "history",
      "modified",
      "new files",
    ],
    startWith: "midnight-list-examples",
  },
  versioning: {
    description: "Version management, breaking changes, and migration assistance",
    useCases: ["Check for updates", "Plan upgrades", "Compare versions", "Get migration guides"],
    intentKeywords: [
      // Version-related
      "version",
      "upgrade",
      "update",
      "migrate",
      "migration",
      // State checks
      "breaking",
      "outdated",
      "latest",
      "current",
      "deprecated",
      "old",
      "new version",
      // Comparison
      "compare",
      "diff",
      "difference",
      "changed between",
      "what changed",
      // Guidance
      "syntax",
      "correct syntax",
      "reference",
    ],
    startWith: "midnight-upgrade-check",
  },
  generation: {
    description: "AI-powered code generation, review, and documentation (requires sampling)",
    useCases: ["Generate contracts", "Review code", "Generate documentation"],
    intentKeywords: [
      // Creation verbs
      "generate",
      "create",
      "write",
      "build",
      "make",
      "scaffold",
      "boilerplate",
      // AI-specific
      "ai",
      "help me write",
      "draft",
      "produce",
      // Documentation
      "document",
      "documentation",
      "explain code",
      "comment",
      // Review
      "improve",
      "suggest fix",
      "refactor",
    ],
    startWith: "midnight-generate-contract",
  },
  health: {
    description: "Server health checks and status monitoring",
    useCases: ["Check API status", "Monitor rate limits", "Debug connectivity"],
    intentKeywords: [
      // Status checks
      "health",
      "status",
      "working",
      "alive",
      "running",
      "up",
      // Problems
      "rate limit",
      "throttle",
      "quota",
      "error",
      "issue",
      "problem",
      // Debugging
      "debug",
      "connection",
      "connectivity",
      "api",
      "server",
      "not working",
      "broken",
    ],
    startWith: "midnight-health-check",
  },
  meta: {
    description: "Tool discovery and navigation - find the right tool for your task",
    useCases: [
      "Browse available tools",
      "Find the right tool for a task",
      "Understand tool capabilities",
    ],
    intentKeywords: [
      "what tools",
      "available tools",
      "list tools",
      "show tools",
      "tool list",
      "which tool",
      "help me find",
      "capabilities",
      "what can",
    ],
    startWith: "midnight-list-tool-categories",
  },
  compound: {
    description: "Multi-step operations in a single call - saves tokens and reduces latency",
    useCases: ["Full upgrade analysis", "Get complete repo context", "One-shot operations"],
    intentKeywords: [
      // Completeness
      "everything",
      "all",
      "complete",
      "full",
      "comprehensive",
      "entire",
      "whole",
      // Starting points
      "start",
      "begin",
      "setup",
      "getting started",
      "onboard",
      "new project",
      // Efficiency
      "one shot",
      "single call",
      "efficient",
      "quick",
      "fast",
    ],
    startWith: "midnight-get-repo-context",
  },
};

// Tool-specific recommendations based on common intents
export const INTENT_TO_TOOL: Array<{
  patterns: string[];
  tool: string;
  reason: string;
}> = [
  // Examples & Getting Started
  {
    patterns: [
      "counter",
      "simple",
      "beginner",
      "start",
      "hello world",
      "basic",
      "first contract",
      "tutorial",
      "starter",
    ],
    tool: "midnight-list-examples",
    reason: "Lists all example contracts including the beginner-friendly counter",
  },
  {
    patterns: [
      "getting started",
      "begin",
      "first time",
      "new to midnight",
      "learn midnight",
      "introduction",
      "overview",
      "onboarding",
      "setup project",
    ],
    tool: "midnight-get-repo-context",
    reason: "Get everything needed to start working (compound tool)",
  },

  // Domain-specific searches
  {
    patterns: [
      "voting",
      "governance",
      "election",
      "ballot",
      "poll",
      "referendum",
      "proposal",
      "dao",
    ],
    tool: "midnight-search-compact",
    reason: "Search for voting/governance-related patterns and examples",
  },
  {
    patterns: [
      "token",
      "transfer",
      "balance",
      "mint",
      "burn",
      "erc20",
      "fungible",
      "asset",
      "coin",
    ],
    tool: "midnight-search-compact",
    reason: "Search for token-related implementations",
  },
  {
    patterns: ["nft", "non-fungible", "collectible", "unique", "ownership", "deed"],
    tool: "midnight-search-compact",
    reason: "Search for NFT and non-fungible token patterns",
  },
  {
    patterns: ["auction", "bid", "bidding", "marketplace", "sale", "exchange"],
    tool: "midnight-search-compact",
    reason: "Search for auction and marketplace patterns",
  },
  {
    patterns: ["access control", "permission", "role", "admin", "owner", "authorization", "acl"],
    tool: "midnight-search-compact",
    reason: "Search for access control and permission patterns",
  },

  // Security & Analysis
  {
    patterns: [
      "security",
      "vulnerability",
      "audit",
      "safe",
      "attack",
      "exploit",
      "risk",
      "issue",
      "bug",
    ],
    tool: "midnight-analyze-contract",
    reason: "Performs security analysis on your contract code",
  },
  {
    patterns: [
      "circuit",
      "zk",
      "zero knowledge",
      "proof",
      "privacy",
      "private",
      "witness",
      "constraint",
    ],
    tool: "midnight-explain-circuit",
    reason: "Explains circuit logic and ZK implications",
  },

  // Version & Upgrade
  {
    patterns: [
      "upgrade",
      "update",
      "outdated",
      "new version",
      "breaking",
      "deprecat",
      "migrate",
      "migration guide",
    ],
    tool: "midnight-upgrade-check",
    reason: "Complete upgrade analysis in one call (compound tool)",
  },
  {
    patterns: [
      "syntax",
      "correct",
      "how to write",
      "format",
      "proper way",
      "right way",
      "convention",
      "best practice",
    ],
    tool: "midnight-get-latest-syntax",
    reason: "Get authoritative syntax reference to avoid mistakes",
  },
  {
    patterns: [
      "what changed",
      "changelog",
      "release notes",
      "difference between",
      "compare versions",
    ],
    tool: "midnight-compare-syntax",
    reason: "Compare syntax/features between versions",
  },

  // SDK & TypeScript
  {
    patterns: [
      "sdk",
      "typescript",
      "javascript",
      "api",
      "integration",
      "client",
      "frontend",
      "dapp",
      "web3",
    ],
    tool: "midnight-search-typescript",
    reason: "Search TypeScript SDK code and types",
  },
  {
    patterns: ["type", "types", "interface", "typing", "definition"],
    tool: "midnight-search-typescript",
    reason: "Search TypeScript type definitions",
  },

  // Documentation
  {
    patterns: [
      "docs",
      "documentation",
      "guide",
      "tutorial",
      "learn",
      "concept",
      "explanation",
      "manual",
    ],
    tool: "midnight-search-docs",
    reason: "Search official Midnight documentation",
  },
  {
    patterns: [
      "fetch docs",
      "fetch documentation",
      "fetch the docs",
      "fetch the latest",
      "get the docs page",
      "get latest docs",
      "live docs",
      "real-time docs",
      "realtime docs",
      "current docs",
      "fresh docs",
      "updated docs",
      "faq page",
      "installation page",
      "getting started page",
      "/develop/",
      "/getting-started/",
      "/compact",
      "/blog",
      "/learn/",
    ],
    tool: "midnight-fetch-docs",
    reason: "Fetch live documentation directly from docs.midnight.network",
  },

  // Code Generation
  {
    patterns: [
      "generate",
      "create contract",
      "write contract",
      "new contract",
      "scaffold",
      "template",
      "boilerplate",
    ],
    tool: "midnight-generate-contract",
    reason: "AI-powered contract generation (requires sampling)",
  },
  {
    patterns: ["review", "check my code", "is this correct", "feedback", "improve my", "fix my"],
    tool: "midnight-review-contract",
    reason: "AI-powered code review (requires sampling)",
  },
  {
    patterns: ["document my", "add comments", "explain my code", "generate docs"],
    tool: "midnight-generate-documentation",
    reason: "AI-powered documentation generation (requires sampling)",
  },

  // Health & Debugging
  {
    patterns: ["not working", "error", "broken", "failing", "issue with server", "api down"],
    tool: "midnight-health-check",
    reason: "Check server status and connectivity",
  },
  {
    patterns: ["rate limit", "quota", "throttle", "429", "too many requests"],
    tool: "midnight-health-check",
    reason: "Check rate limit status and remaining quota",
  },
  {
    patterns: ["server status", "api status", "is api up", "check server"],
    tool: "midnight-get-status",
    reason: "Get detailed server and API status information",
  },
  {
    patterns: ["mcp version", "server version", "what version am i using", "installed version"],
    tool: "midnight-check-version",
    reason: "Check the current MCP server version",
  },
  // Repository & Files
  {
    patterns: [
      "recent changes",
      "latest commits",
      "what's new",
      "updates",
      "modified",
      "new features",
      "repo activity",
    ],
    tool: "midnight-get-latest-updates",
    reason: "See recent repository activity and changes",
  },
  {
    patterns: ["read file", "get file", "show file", "file content", "source"],
    tool: "midnight-get-file",
    reason: "Fetch specific file content from repository",
  },
  {
    patterns: [
      "file from version",
      "old version of file",
      "file at version",
      "historical file",
      "previous version",
    ],
    tool: "midnight-get-file-at-version",
    reason: "Get a file as it existed in a specific version",
  },

  // Version Comparison & Info
  {
    patterns: [
      "what version",
      "current version",
      "latest version",
      "version number",
      "compact version",
    ],
    tool: "midnight-get-version-info",
    reason: "Get version information for Midnight components",
  },
  {
    patterns: ["breaking changes", "what broke", "incompatible", "api changes", "deprecations"],
    tool: "midnight-check-breaking-changes",
    reason: "Check for breaking changes between versions",
  },
  {
    patterns: [
      "how to migrate",
      "migration steps",
      "upgrade guide",
      "migration path",
      "move to new version",
    ],
    tool: "midnight-get-migration-guide",
    reason: "Get step-by-step migration guidance",
  },
  {
    patterns: ["compare syntax", "syntax diff", "syntax between versions", "syntax comparison"],
    tool: "midnight-compare-syntax",
    reason: "Compare Compact syntax between two versions",
  },

  // Contract Structure (now via analyze)
  {
    patterns: [
      "extract structure",
      "contract structure",
      "parse contract",
      "contract outline",
      "functions in contract",
      "contract anatomy",
    ],
    tool: "midnight-analyze-contract",
    reason: "Analyze contract structure (circuits, ledger, imports) via the playground API",
  },

  // Format
  {
    patterns: [
      "format contract",
      "format code",
      "format compact",
      "reformat",
      "prettify",
      "beautify",
      "indent",
      "auto format",
    ],
    tool: "midnight-format-contract",
    reason: "Format Compact contract code using the official formatter",
  },

  // Diff contracts
  {
    patterns: [
      "diff contracts",
      "compare contracts",
      "contract diff",
      "what changed in contract",
      "before and after",
      "contract comparison",
    ],
    tool: "midnight-diff-contracts",
    reason: "Compare two versions of a contract to see structural changes",
  },

  // Meta/Discovery (fallback patterns)
  {
    patterns: ["what tools", "available tools", "list tools", "show tools", "tool list"],
    tool: "midnight-list-tool-categories",
    reason: "Browse available tool categories",
  },
];
