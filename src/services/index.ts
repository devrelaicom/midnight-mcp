/**
 * Services index
 * Export all service modules
 */

// Playground API client (routes through API /pg/* proxy)
export {
  compile,
  format,
  analyze,
  diff,
  healthCheck,
  visualize,
  prove,
  compileArchive,
  listVersions,
  listLibraries,
  buildCacheUrl,
} from "./playground.js";
export type {
  CompileResult,
  CompileOptions,
  MultiVersionCompileResult,
  FormatResult,
  AnalyzeResult,
  AnalyzeOptions,
  DiffResult,
  VisualizeResult,
  ProveResult,
  ArchiveCompileOptions,
  VersionsResult,
  LibrariesResult,
} from "./playground.js";

export { registerSamplingCallback } from "./sampling.js";
