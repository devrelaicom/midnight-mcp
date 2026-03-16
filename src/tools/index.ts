/**
 * Tools module exports
 * Barrel file for all MCP tools
 */

// Search tools
export {
  searchTools,
  searchCompact,
  searchTypeScript,
  searchDocs,
  SearchCompactInputSchema,
  SearchTypeScriptInputSchema,
  SearchDocsInputSchema,
  type SearchCompactInput,
  type SearchTypeScriptInput,
  type SearchDocsInput,
} from "./search/index.js";

// Analyze tools
export {
  analyzeTools,
  analyzeContract,
  AnalyzeContractInputSchema,
  type AnalyzeContractInput,
} from "./analyze/index.js";

// Repository tools
export {
  repositoryTools,
  getFile,
  listExamples,
  getLatestUpdates,
  GetFileInputSchema,
  ListExamplesInputSchema,
  GetLatestUpdatesInputSchema,
  type GetFileInput,
  type ListExamplesInput,
  type GetLatestUpdatesInput,
} from "./repository/index.js";

// Health tools
export {
  healthTools,
  healthCheck,
  getStatus,
  checkVersion,
  HealthCheckInputSchema,
  GetStatusInputSchema,
  CheckVersionInputSchema,
  type HealthCheckInput,
  type GetStatusInput,
  type CheckVersionInput,
} from "./health/index.js";

// Meta tools
export {
  metaTools,
  listToolCategories,
  listCategoryTools,
  ListToolCategoriesInputSchema,
  ListCategoryToolsInputSchema,
  CATEGORY_INFO,
  type ListToolCategoriesInput,
  type ListCategoryToolsInput,
} from "./meta/index.js";

// Re-export types
export type { ExtendedToolDefinition, ToolAnnotations, OutputSchema } from "../types/index.js";

// Format tools
export {
  formatTools,
  formatContract,
  FormatContractInputSchema,
  type FormatContractInput,
} from "./format/index.js";

// Diff tools
export {
  diffTools,
  diffContracts,
  DiffContractsInputSchema,
  type DiffContractsInput,
} from "./diff/index.js";

// Combined tool list for MCP server
import { searchTools } from "./search/index.js";
import { analyzeTools } from "./analyze/index.js";
import { repositoryTools } from "./repository/index.js";
import { healthTools } from "./health/index.js";
import { metaTools } from "./meta/index.js";
import { formatTools } from "./format/index.js";
import { diffTools } from "./diff/index.js";
import type { ExtendedToolDefinition } from "../types/index.js";

export const allTools: ExtendedToolDefinition[] = [
  ...metaTools, // Discovery tools first for visibility
  ...searchTools,
  ...analyzeTools,
  ...formatTools,
  ...diffTools,
  ...repositoryTools,
  ...healthTools,
];
