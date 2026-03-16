/**
 * Analyze handler functions
 * Business logic for analysis-related MCP tools
 */

import { logger } from "../../utils/index.js";
import { compile, analyze } from "../../services/playground.js";
import type { AnalyzeContractInput, CompileContractInput } from "./schemas.js";

/**
 * Analyze a Compact smart contract via the playground API
 */
export async function analyzeContract(input: AnalyzeContractInput) {
  logger.debug("Analyzing Compact contract via playground API");

  const result = await analyze(input.code, input.mode);

  return {
    success: result.success,
    mode: result.mode,
    pragma: result.pragma,
    imports: result.imports,
    circuits: result.circuits,
    ledger: result.ledger,
    ...(result.compilation && { compilation: result.compilation }),
  };
}

/**
 * Compile a Compact smart contract via the playground API proxy
 */
export async function compileContract(input: CompileContractInput): Promise<object> {
  logger.info("Compiling Compact contract via API proxy", {
    codeLength: input.code.length,
    skipZk: input.skipZk,
    fullCompile: input.fullCompile,
    version: input.version,
    versions: input.versions,
  });

  const skipZk = input.fullCompile ? false : input.skipZk;

  const result = await compile(input.code, {
    skipZk,
    wrapWithDefaults: true,
    version: input.version,
    versions: input.versions,
  });

  return {
    ...result,
    compilationMode: skipZk ? "syntax-only" : "full",
  };
}
