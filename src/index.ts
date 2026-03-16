/**
 * Midnight MCP Server - Library exports
 *
 * For CLI usage, use bin.ts or run: npx midnight-mcp --help
 */

// Server exports
export { startServer, startHttpServer } from "./server.js";

// Tool exports
export { allTools } from "./tools/index.js";

// Resource exports
export { allResources, getDocumentation, getSchema } from "./resources/index.js";

// Utility exports
export { logger } from "./utils/index.js";

// Type exports
export type { ExtendedToolDefinition, OutputSchema } from "./types/index.js";
