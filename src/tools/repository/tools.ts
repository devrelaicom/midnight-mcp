/**
 * Repository tool definitions
 * MCP tool registration for repository-related operations
 */

import type { ExtendedToolDefinition } from "../../types/index.js";
import { zodInputSchema } from "../../utils/schema.js";
import {
  GetFileInputSchema,
  ListExamplesInputSchema,
  GetLatestUpdatesInputSchema,
  CheckBreakingChangesInputSchema,
  GetFileAtVersionInputSchema,
  CompareSyntaxInputSchema,
  UpgradeCheckInputSchema,
  FullRepoContextInputSchema,
} from "./schemas.js";
import {
  getFile,
  listExamples,
  getLatestUpdates,
  checkBreakingChanges,
  getFileAtVersion,
  compareSyntax,
  upgradeCheck,
  getFullRepoContext,
} from "./handlers.js";

// Tool definitions for MCP
export const repositoryTools: ExtendedToolDefinition[] = [
  {
    name: "midnight-get-file",
    description: `Retrieve a specific file from Midnight repositories. Use repository aliases like 'compact', 'midnight-js', 'counter', or 'bboard' for convenience.

USAGE GUIDANCE:
• Use midnight-list-examples first if you're unsure which file to get
• For searching across files, use midnight-search-* tools instead
• Use 'ref' parameter to get specific versions (branch, tag, or commit)
• Use startLine/endLine to request specific sections of large files
• Files >50KB are truncated (first 25KB + last 25KB preserved)`,
    inputSchema: zodInputSchema(GetFileInputSchema),
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
      title: "Get Repository File",
      category: "repository",
    },
    handler: getFile,
  },
  {
    name: "midnight-list-examples",
    description:
      "List available Midnight example contracts and DApps with descriptions, complexity ratings, and key features.",
    inputSchema: zodInputSchema(ListExamplesInputSchema),
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      title: "List Example Contracts",
      category: "repository",
    },
    handler: listExamples,
  },
  {
    name: "midnight-get-latest-updates",
    description:
      "Retrieve recent changes and commits across Midnight repositories. Useful for staying up-to-date with the latest developments.",
    inputSchema: zodInputSchema(GetLatestUpdatesInputSchema),
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
      title: "Get Latest Updates",
      category: "repository",
    },
    handler: getLatestUpdates,
  },
  {
    name: "midnight-check-breaking-changes",
    description:
      "Check if there are breaking changes between your current version and the latest release. Essential before upgrading dependencies.",
    inputSchema: zodInputSchema(CheckBreakingChangesInputSchema),
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
      title: "Check Breaking Changes",
      category: "versioning",
    },
    handler: checkBreakingChanges,
  },
  {
    name: "midnight-get-file-at-version",
    description:
      "Get the exact content of a file at a specific version. CRITICAL: Use this to ensure code recommendations match the user's version. Always prefer this over get-file when version accuracy matters.",
    inputSchema: zodInputSchema(GetFileAtVersionInputSchema),
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      title: "Get File at Version",
      category: "versioning",
    },
    handler: getFileAtVersion,
  },
  {
    name: "midnight-compare-syntax",
    description:
      "Compare a file between two versions to see what changed. Use this before recommending code patterns to ensure they work with the user's version.",
    inputSchema: zodInputSchema(CompareSyntaxInputSchema),
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      title: "Compare Syntax Between Versions",
      category: "versioning",
    },
    handler: compareSyntax,
  },
  // ============================================================================
  // COMPOUND TOOLS - Multi-step operations in a single call
  // These reduce token usage by 50-70% compared to calling individual tools
  // ============================================================================
  {
    name: "midnight-upgrade-check",
    description:
      "🚀 COMPOUND TOOL: Complete upgrade analysis in ONE call. Combines version check + breaking changes + migration guide. Use this instead of calling midnight-get-version-info, midnight-check-breaking-changes, and midnight-get-migration-guide separately. Saves ~60% tokens.",
    inputSchema: zodInputSchema(UpgradeCheckInputSchema),
    outputSchema: {
      type: "object" as const,
      properties: {
        repository: { type: "string", description: "Full repository path" },
        currentVersion: {
          type: "string",
          description: "Version being checked",
        },
        version: {
          type: "object",
          description: "Version summary",
          properties: {
            latest: { type: "string" },
            latestStable: { type: "string" },
            isOutdated: { type: "boolean" },
            versionsBehind: { type: "number" },
          },
        },
        breakingChanges: {
          type: "object",
          description: "Breaking changes summary",
          properties: {
            count: { type: "number" },
            hasBreakingChanges: { type: "boolean" },
            items: { type: "array" },
          },
        },
        migration: { type: "object", description: "Migration guide if needed" },
        urgency: {
          type: "string",
          description: "none|low|medium|high|critical",
        },
        recommendation: {
          type: "string",
          description: "Actionable recommendation",
        },
      },
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
      longRunningHint: true,
      title: "⚡ Upgrade Check (Compound)",
      category: "compound",
    },
    handler: upgradeCheck,
  },
  {
    name: "midnight-get-repo-context",
    description:
      "🚀 COMPOUND TOOL: Get everything needed to start working with a repository in ONE call. Combines version info + syntax reference + relevant examples. Use this at the start of a coding session instead of multiple individual calls. Saves ~50% tokens.",
    inputSchema: zodInputSchema(FullRepoContextInputSchema),
    outputSchema: {
      type: "object" as const,
      properties: {
        repository: { type: "string", description: "Full repository path" },
        quickStart: {
          type: "object",
          description: "Version and install command",
        },
        version: { type: "object", description: "Version details" },
        syntax: { type: "object", description: "Syntax reference summary" },
        examples: { type: "array", description: "Relevant examples" },
      },
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
      longRunningHint: true,
      title: "⚡ Get Repo Context (Compound)",
      category: "compound",
    },
    handler: getFullRepoContext,
  },
];
