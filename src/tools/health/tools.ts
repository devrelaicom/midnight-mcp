/**
 * Health tool definitions
 * MCP tool registration for health-related operations
 */

import type {
  ExtendedToolDefinition,
  OutputSchema,
} from "../../types/index.js";
import {
  healthCheck,
  getStatus,
  checkVersion,
  getAutoUpdateConfig,
  getUpdateInstructions,
} from "./handlers.js";

// ============================================================================
// Output Schemas
// ============================================================================

const healthCheckOutputSchema: OutputSchema = {
  type: "object",
  properties: {
    status: {
      type: "string",
      enum: ["healthy", "degraded", "unhealthy"],
      description: "Overall health status",
    },
    version: { type: "string", description: "Server version" },
    rateLimit: {
      type: "object",
      properties: {
        remaining: { type: "number" },
        limit: { type: "number" },
        percentUsed: { type: "number" },
        status: { type: "string" },
      },
    },
    cacheStats: {
      type: "object",
      properties: {
        search: { type: "object" },
        file: { type: "object" },
        metadata: { type: "object" },
      },
    },
  },
  required: ["status"],
  description: "Server health status with optional detailed diagnostics",
};

const getStatusOutputSchema: OutputSchema = {
  type: "object",
  properties: {
    server: { type: "string", description: "Server name" },
    status: { type: "string", description: "Running status" },
    timestamp: { type: "string", description: "ISO timestamp" },
    rateLimit: {
      type: "object",
      properties: {
        remaining: { type: "number" },
        limit: { type: "number" },
        percentUsed: { type: "number" },
        status: { type: "string" },
        message: { type: "string" },
      },
    },
    cache: {
      type: "object",
      properties: {
        search: { type: "object" },
        file: { type: "object" },
        metadata: { type: "object" },
      },
    },
  },
  required: ["server", "status", "timestamp"],
  description: "Current server status and statistics",
};

const checkVersionOutputSchema: OutputSchema = {
  type: "object" as const,
  properties: {
    currentVersion: {
      type: "string",
      description: "Your installed version",
    },
    latestVersion: { type: "string", description: "Latest version on npm" },
    isUpToDate: {
      type: "boolean",
      description: "Whether you have the latest",
    },
    message: { type: "string", description: "Status message" },
    updateInstructions: {
      type: "object",
      description: "How to update if outdated",
    },
    newFeatures: {
      type: "array",
      items: { type: "string" },
      description: "New features in latest version",
    },
  },
};

const autoUpdateConfigOutputSchema: OutputSchema = {
  type: "object" as const,
  properties: {
    instruction: { type: "string" },
    platform: { type: "string" },
    configPaths: { type: "object" },
    searchAndReplace: { type: "object" },
    agentInstructions: { type: "array", items: { type: "string" } },
    postUpdateMessage: { type: "string" },
  },
};

// ============================================================================
// Tool Definitions
// ============================================================================

export const healthTools: ExtendedToolDefinition[] = [
  {
    name: "midnight-health-check",
    description:
      "Check the health status of the Midnight MCP server. Returns server status, API connectivity, and resource availability.",
    inputSchema: {
      type: "object" as const,
      properties: {
        detailed: {
          type: "boolean",
          description:
            "Include detailed checks including GitHub API and vector store status (slower)",
          default: false,
        },
      },
    },
    outputSchema: healthCheckOutputSchema,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      title: "Health Check",
      category: "health",
    },
    handler: healthCheck,
  },
  {
    name: "midnight-get-status",
    description:
      "Get current server status including rate limits and cache statistics. Quick status check without external API calls.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
    outputSchema: getStatusOutputSchema,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      title: "Get Server Status",
      category: "health",
    },
    handler: getStatus,
  },
  {
    name: "midnight-check-version",
    description:
      "🔄 Check if you're running the latest version of midnight-mcp. " +
      "Compares your installed version against npm registry and provides update instructions if outdated. " +
      "Use this if tools seem missing or you want to ensure you have the latest features.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
    outputSchema: checkVersionOutputSchema,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      title: "🔄 Check for Updates",
      category: "health",
    },
    handler: checkVersion,
  },
  {
    name: "midnight-auto-update-config",
    description:
      "⚠️ DEPRECATED: Auto-update is NOT possible because AI agents run in sandboxed environments without access to local filesystems. " +
      "Instead, tell users to manually update their config to use midnight-mcp@latest, then run: rm -rf ~/.npm/_npx && restart their editor. " +
      "This tool only returns config file paths for reference.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
    outputSchema: autoUpdateConfigOutputSchema,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      title: "🔧 Auto-Update Config",
      category: "health",
    },
    handler: getAutoUpdateConfig,
  },
  {
    name: "midnight-get-update-instructions",
    description:
      "📋 Get detailed, platform-specific instructions for updating Midnight MCP to the latest version. " +
      "Provides step-by-step guidance including config file locations, commands to run, and troubleshooting tips. " +
      "Use this when a user needs help updating or is having issues with outdated versions.",
    inputSchema: {
      type: "object" as const,
      properties: {
        platform: {
          type: "string",
          enum: ["auto", "mac", "windows", "linux"],
          description: "Target platform (auto-detects if not specified)",
          default: "auto",
        },
        editor: {
          type: "string",
          enum: ["auto", "claude-desktop", "cursor", "vscode", "windsurf"],
          description: "Target editor (defaults to Claude Desktop)",
          default: "auto",
        },
      },
    },
    outputSchema: {
      type: "object" as const,
      properties: {
        title: { type: "string" },
        currentSetup: { type: "object" },
        steps: { type: "array", items: { type: "object" } },
        troubleshooting: { type: "array", items: { type: "object" } },
        exampleConfig: { type: "object" },
        helpfulLinks: { type: "object" },
      },
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      title: "📋 Get Update Instructions",
      category: "health",
    },
    handler: getUpdateInstructions,
  },
];
