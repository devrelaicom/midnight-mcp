/**
 * Tool name to Zod schema mapping for runtime validation
 * Maps each tool's name to its Zod input schema so the CallTool handler
 * can validate and apply defaults/refinements at runtime.
 */

import type { ZodSchema } from "zod";
import { allTools } from "./index.js";
import { logger } from "../utils/index.js";

// Search schemas
import {
  SearchCompactInputSchema,
  SearchTypeScriptInputSchema,
  SearchDocsInputSchema,
  FetchDocsInputSchema,
} from "./search/schemas.js";

// Analyze schemas
import {
  AnalyzeContractInputSchema,
  ExplainCircuitInputSchema,
  CompileContractInputSchema,
} from "./analyze/schemas.js";

// Repository schemas
import {
  GetFileInputSchema,
  ListExamplesInputSchema,
  GetLatestUpdatesInputSchema,
  GetVersionInfoInputSchema,
  CheckBreakingChangesInputSchema,
  GetMigrationGuideInputSchema,
  GetFileAtVersionInputSchema,
  CompareSyntaxInputSchema,
  GetLatestSyntaxInputSchema,
  UpgradeCheckInputSchema,
  FullRepoContextInputSchema,
  ExtractContractStructureInputSchema,
} from "./repository/schemas.js";

// Health schemas
import {
  HealthCheckInputSchema,
  GetStatusInputSchema,
  CheckVersionInputSchema,
  AutoUpdateConfigInputSchema,
  GetUpdateInstructionsInputSchema,
} from "./health/schemas.js";

// Generation schemas
import {
  GenerateContractInputSchema,
  ReviewContractInputSchema,
  DocumentContractInputSchema,
} from "./generation/schemas.js";

// Meta schemas
import {
  ListToolCategoriesInputSchema,
  ListCategoryToolsInputSchema,
  SuggestToolInputSchema,
} from "./meta/schemas.js";

export const toolValidationSchemas: Record<string, ZodSchema> = {
  // Search tools
  "midnight-search-compact": SearchCompactInputSchema,
  "midnight-search-typescript": SearchTypeScriptInputSchema,
  "midnight-search-docs": SearchDocsInputSchema,
  "midnight-fetch-docs": FetchDocsInputSchema,

  // Analyze tools
  "midnight-analyze-contract": AnalyzeContractInputSchema,
  "midnight-explain-circuit": ExplainCircuitInputSchema,
  "midnight-compile-contract": CompileContractInputSchema,

  // Repository tools
  "midnight-get-file": GetFileInputSchema,
  "midnight-list-examples": ListExamplesInputSchema,
  "midnight-get-latest-updates": GetLatestUpdatesInputSchema,
  "midnight-get-version-info": GetVersionInfoInputSchema,
  "midnight-check-breaking-changes": CheckBreakingChangesInputSchema,
  "midnight-get-migration-guide": GetMigrationGuideInputSchema,
  "midnight-get-file-at-version": GetFileAtVersionInputSchema,
  "midnight-compare-syntax": CompareSyntaxInputSchema,
  "midnight-get-latest-syntax": GetLatestSyntaxInputSchema,
  "midnight-upgrade-check": UpgradeCheckInputSchema,
  "midnight-get-repo-context": FullRepoContextInputSchema,
  "midnight-extract-contract-structure": ExtractContractStructureInputSchema,

  // Health tools
  "midnight-health-check": HealthCheckInputSchema,
  "midnight-get-status": GetStatusInputSchema,
  "midnight-check-version": CheckVersionInputSchema,
  "midnight-auto-update-config": AutoUpdateConfigInputSchema,
  "midnight-get-update-instructions": GetUpdateInstructionsInputSchema,

  // Generation tools
  "midnight-generate-contract": GenerateContractInputSchema,
  "midnight-review-contract": ReviewContractInputSchema,
  "midnight-document-contract": DocumentContractInputSchema,

  // Meta tools
  "midnight-list-tool-categories": ListToolCategoriesInputSchema,
  "midnight-list-category-tools": ListCategoryToolsInputSchema,
  "midnight-suggest-tool": SuggestToolInputSchema,
};

// Verify all validation schema keys match actual tool names (runs once at import time)
const toolNames = new Set(allTools.map((t) => t.name));
for (const key of Object.keys(toolValidationSchemas)) {
  if (!toolNames.has(key)) {
    logger.warn(`Validation schema registered for unknown tool: ${key}`);
  }
}
