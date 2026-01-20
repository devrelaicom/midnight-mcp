/**
 * Services index
 * Export all service modules
 */

export {
  isSamplingAvailable,
  registerSamplingCallback,
  generateContract,
  reviewContract,
  generateDocumentation,
} from "./sampling.js";
export {
  // ADT validation
  searchADTInfo,
  searchCompactSyntax,
  validateADTOperations,
  enrichSyntaxReference,
  verifyClaimAgainstDocs,
  // Comprehensive static data validation
  validateBuiltinFunctions,
  validateTypeCompatibility,
  validateCommonErrors,
  validateAllStaticData,
  // Deprecated pattern scanning
  scanForDeprecatedPatterns,
  DEPRECATED_SYNTAX_PATTERNS,
  // Constants
  CRITICAL_DOC_TOPICS,
  // Types
  type ADTInfo,
  type ADTOperation,
  type SyntaxValidationResult,
  type StaticDataValidation,
} from "./syntax-validator.js";

// Hosted Compact compiler service
export {
  compileContract,
  validateSyntax,
  fullCompile,
  checkCompilerHealth,
  getCompilerUrl,
  type CompileOptions,
  type CompilationResult,
} from "./compiler.js";
