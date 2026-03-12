/**
 * Repository module exports
 * Barrel file for repository-related tools
 */

// Schemas and types
export {
  GetFileInputSchema,
  ListExamplesInputSchema,
  GetLatestUpdatesInputSchema,
  CheckBreakingChangesInputSchema,
  GetFileAtVersionInputSchema,
  CompareSyntaxInputSchema,
  type GetFileInput,
  type ListExamplesInput,
  type GetLatestUpdatesInput,
  type CheckBreakingChangesInput,
  type GetFileAtVersionInput,
  type CompareSyntaxInput,
} from "./schemas.js";

// Constants
export { REPO_ALIASES, EXAMPLES, type ExampleDefinition } from "./constants.js";

// Handlers
export {
  resolveRepo,
  getFile,
  listExamples,
  getLatestUpdates,
  checkBreakingChanges,
  getFileAtVersion,
  compareSyntax,
} from "./handlers.js";

// Tools
export { repositoryTools } from "./tools.js";
