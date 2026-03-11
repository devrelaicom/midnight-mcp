/**
 * Tool name to Zod schema mapping for runtime validation
 * Maps each tool's name to its Zod input schema so the CallTool handler
 * can validate and apply defaults/refinements at runtime.
 */

import type { ZodType } from "zod";
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
} from "./repository/schemas.js";

// Health schemas
import {
  HealthCheckInputSchema,
  GetStatusInputSchema,
  CheckVersionInputSchema,
  GetUpdateInstructionsInputSchema,
} from "./health/schemas.js";

// Generation schemas
import {
  GenerateContractInputSchema,
  ReviewContractInputSchema,
  DocumentContractInputSchema,
} from "./generation/schemas.js";

// Format schemas
import { FormatContractInputSchema } from "./format/schemas.js";

// Diff schemas
import { DiffContractsInputSchema } from "./diff/schemas.js";

// Meta schemas
import {
  ListToolCategoriesInputSchema,
  ListCategoryToolsInputSchema,
  SuggestToolInputSchema,
} from "./meta/schemas.js";

export const toolValidationSchemas: Record<string, ZodType> = {
  // Search tools
  "midnight-search-compact": SearchCompactInputSchema,
  "midnight-search-typescript": SearchTypeScriptInputSchema,
  "midnight-search-docs": SearchDocsInputSchema,
  "midnight-fetch-docs": FetchDocsInputSchema,

  // Analyze tools
  "midnight-analyze-contract": AnalyzeContractInputSchema,
  "midnight-explain-circuit": ExplainCircuitInputSchema,
  "midnight-compile-contract": CompileContractInputSchema,

  // Format tools
  "midnight-format-contract": FormatContractInputSchema,

  // Diff tools
  "midnight-diff-contracts": DiffContractsInputSchema,

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

  // Health tools
  "midnight-health-check": HealthCheckInputSchema,
  "midnight-get-status": GetStatusInputSchema,
  "midnight-check-version": CheckVersionInputSchema,
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
// Verify every registered tool has a validation schema
for (const name of toolNames) {
  if (!toolValidationSchemas[name]) {
    logger.warn(`Tool "${name}" has no registered validation schema`);
  }
}
