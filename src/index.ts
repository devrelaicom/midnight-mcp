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
export {
  allResources,
  getDocumentation,
  getCode,
  getSchema,
} from "./resources/index.js";

// Prompt exports
export { promptDefinitions, generatePrompt } from "./prompts/index.js";

// Utility exports
export { logger } from "./utils/index.js";

// Type exports
export type { ExtendedToolDefinition, OutputSchema } from "./types/index.js";
