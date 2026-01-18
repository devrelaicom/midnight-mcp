/**
 * Health module exports
 * Barrel file for health-related tools
 */

// Schemas and types
export {
  HealthCheckInputSchema,
  GetStatusInputSchema,
  CheckVersionInputSchema,
  AutoUpdateConfigInputSchema,
  GetUpdateInstructionsInputSchema,
  type HealthCheckInput,
  type GetStatusInput,
  type CheckVersionInput,
  type AutoUpdateConfigInput,
  type GetUpdateInstructionsInput,
} from "./schemas.js";

// Handlers
export {
  healthCheck,
  getStatus,
  checkVersion,
  getAutoUpdateConfig,
  getUpdateInstructions,
} from "./handlers.js";

// Tools
export { healthTools } from "./tools.js";
