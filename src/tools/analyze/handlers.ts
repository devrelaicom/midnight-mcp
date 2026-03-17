/**
 * Analyze handler functions
 * Business logic for analysis-related MCP tools
 */

import { logger, MCPError, ErrorCodes } from "../../utils/index.js";
import {
  compile,
  analyze,
  visualize,
  prove,
  compileArchive,
  buildCacheUrl,
} from "../../services/playground.js";
import { createTarGzBase64 } from "../../utils/tar.js";
import type {
  AnalyzeContractInput,
  CompileContractInput,
  VisualizeContractInput,
  ProveContractInput,
  CompileArchiveInput,
} from "./schemas.js";

/**
 * Analyze a Compact smart contract via the playground API
 */
export async function analyzeContract(input: AnalyzeContractInput) {
  logger.debug("Analyzing Compact contract via playground API");

  const result = await analyze(input.code, {
    mode: input.mode,
    include: input.include,
    circuit: input.circuit,
    version: input.version,
    versions: input.versions,
  });

  const cacheKey = (result as unknown as Record<string, unknown>).cacheKey as string | undefined;
  return {
    ...result,
    ...(cacheKey && { cacheUrl: buildCacheUrl(cacheKey) }),
  };
}

interface CompileContractResult {
  success: boolean;
  output?: string;
  errors?: Array<{
    file?: string;
    line?: number;
    column?: number;
    severity?: string;
    message: string;
  }>;
  executionTime?: number;
  compiledAt?: string;
  cacheKey?: string;
  cacheUrl?: string;
  compilationMode: "syntax-only" | "full";
  [key: string]: unknown;
}

/**
 * Compile a Compact smart contract via the playground API proxy
 */
export async function compileContract(input: CompileContractInput): Promise<CompileContractResult> {
  logger.info("Compiling Compact contract via API proxy", {
    codeLength: input.code.length,
    skipZk: input.skipZk,
    fullCompile: input.fullCompile,
    version: input.version,
    versions: input.versions,
    includeBindings: input.includeBindings,
    libraries: input.libraries,
  });

  const skipZk = input.fullCompile || input.includeBindings ? false : input.skipZk;

  const result = await compile(input.code, {
    skipZk,
    wrapWithDefaults: true,
    version: input.version,
    versions: input.versions,
    includeBindings: input.includeBindings,
    libraries: input.libraries,
  });

  const cacheKey = (result as unknown as Record<string, unknown>).cacheKey as string | undefined;

  return {
    ...result,
    compilationMode: skipZk ? "syntax-only" : "full",
    ...(cacheKey && { cacheUrl: buildCacheUrl(cacheKey) }),
  };
}

/**
 * Generate a visual architecture graph of a Compact contract
 */
export async function visualizeContract(input: VisualizeContractInput) {
  logger.debug("Visualizing Compact contract architecture");
  const result = await visualize(input.code, { version: input.version });
  return {
    ...result,
    ...(result.cacheKey && { cacheUrl: buildCacheUrl(result.cacheKey) }),
  };
}

/**
 * Analyze ZK privacy boundaries for a Compact contract
 */
export async function proveContract(input: ProveContractInput) {
  logger.debug("Analyzing ZK privacy boundaries");
  const result = await prove(input.code, { version: input.version });
  return {
    ...result,
    ...(result.cacheKey && { cacheUrl: buildCacheUrl(result.cacheKey) }),
  };
}

/**
 * Compile a multi-file Compact project via archive
 */
export async function compileArchiveHandler(input: CompileArchiveInput) {
  // Validate file paths: no absolute paths or directory traversal
  for (const filePath of Object.keys(input.files)) {
    if (filePath.startsWith("/") || filePath.includes("..")) {
      throw new MCPError(
        `Invalid file path "${filePath}": paths must be relative and cannot contain ".."`,
        ErrorCodes.INVALID_INPUT,
      );
    }
  }

  logger.info("Compiling multi-file Compact archive", {
    fileCount: Object.keys(input.files).length,
  });

  const archive = await createTarGzBase64(input.files);

  const result = await compileArchive(archive, {
    version: input.version,
    versions: input.versions,
    skipZk: input.options?.skipZk,
    includeBindings: input.options?.includeBindings,
    libraries: input.options?.libraries,
  });

  const cacheKey = (result as unknown as Record<string, unknown>).cacheKey as string | undefined;
  return {
    ...result,
    ...(cacheKey && { cacheUrl: buildCacheUrl(cacheKey) }),
  };
}
