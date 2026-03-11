/**
 * Health module exports
 * Barrel file for health-related tools
 */

// Schemas and types
export {
  HealthCheckInputSchema,
  GetStatusInputSchema,
  CheckVersionInputSchema,
  GetUpdateInstructionsInputSchema,
  type HealthCheckInput,
  type GetStatusInput,
  type CheckVersionInput,
  type GetUpdateInstructionsInput,
} from "./schemas.js";

// Handlers
export { healthCheck, getStatus, checkVersion, getUpdateInstructions } from "./handlers.js";

// Tools
export { healthTools } from "./tools.js";
