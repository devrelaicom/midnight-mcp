export { config, isHostedMode, isLocalMode } from "./config.js";
export type { Config, RepositoryConfig } from "./config.js";
export { DEFAULT_REPOSITORIES } from "./config.js";
export { logger, initLogging, setMCPLogFunction, resetLoggerState } from "./logger.js";
export {
  MCPError,
  ErrorCodes,
  createUserError,
  createErrorResponse,
  formatErrorResponse,
  withErrorHandling,
  SelfCorrectionHints,
} from "./errors.js";

// Validation utilities
export {
  validateQuery,
  validateRepository,
  validatePath,
  validateRef,
  validateNumber,
  validateToolArgs,
  sanitizeString,
} from "./validation.js";
export type { ValidationResult } from "./validation.js";

// Health check utilities
export { getHealthStatus, getQuickHealthStatus } from "./health.js";
export type { HealthStatus } from "./health.js";

// Rate limit tracking
export {
  updateRateLimitFromHeaders,
  updateRateLimit,
  getRateLimitStatus,
  shouldProceedWithRequest,
  getTimeUntilReset,
  formatRateLimitStatus,
  decrementRemaining,
} from "./rate-limit.js";
export type { RateLimitInfo, RateLimitStatus } from "./rate-limit.js";

// Caching utilities
export {
  Cache,
  createCacheKey,
  searchCache,
  fileCache,
  metadataCache,
  pruneAllCaches,
} from "./cache.js";
export type { CacheOptions, CacheEntry, CacheStats } from "./cache.js";

// Hosted API client
export {
  searchCompactHosted,
  searchTypeScriptHosted,
  searchDocsHosted,
  searchHosted,
  checkHostedApiHealth,
  getHostedApiStats,
  trackToolCall,
} from "./hosted-api.js";
export type { HostedSearchResult, HostedSearchResponse, HostedSearchFilter } from "./hosted-api.js";

// Output serialization (YAML default, JSON optional)
export { serialize, setOutputFormat, isJsonOutput, getOutputMimeType } from "./serializer.js";

// Schema conversion utilities
export { zodInputSchema } from "./schema.js";

// External boundary validation
export { parseJsonResponse, validateJson } from "./parse-response.js";

// HTML-to-markdown extraction
export { extractContentFromHtml } from "./html-to-markdown.js";
export type { ExtractedContent } from "./html-to-markdown.js";

// Shared version constant
export { CURRENT_VERSION } from "./version.js";
