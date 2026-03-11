/**
 * Services index
 * Export all service modules
 */

// Playground API client (new — routes through API /pg/* proxy)
export { compile, format, analyze, diff, healthCheck } from "./playground.js";
export type {
  CompileResult,
  MultiVersionCompileResult,
  FormatResult,
  AnalyzeResult,
  DiffResult,
} from "./playground.js";

export {
  isSamplingAvailable,
  registerSamplingCallback,
  generateContract,
  reviewContract,
  generateDocumentation,
} from "./sampling.js";
