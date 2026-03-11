/**
 * Analyze tool input schemas
 * Zod schemas for validating tool inputs
 */

import { z } from "zod";

// Schema definitions
export const AnalyzeContractInputSchema = z.object({
  code: z.string().describe("Compact contract source code"),
  mode: z
    .enum(["fast", "deep"])
    .optional()
    .default("fast")
    .describe(
      "Analysis mode: 'fast' for regex-based structure extraction (instant), 'deep' for compile-backed analysis",
    ),
});

export const ExplainCircuitInputSchema = z.object({
  circuitCode: z.string().describe("Circuit definition from Compact"),
});

export const CompileContractInputSchema = z.object({
  code: z.string().describe("Compact contract source code to compile"),
  skipZk: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Skip ZK circuit generation for faster syntax-only validation (default: true). Overridden by fullCompile.",
    ),
  fullCompile: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Perform full compilation including ZK generation (slower but complete). Overrides skipZk.",
    ),
  version: z
    .string()
    .optional()
    .describe(
      "Compiler version to use (e.g. '0.29.0') or 'detect' to resolve from pragma constraints",
    ),
  versions: z
    .array(z.string())
    .optional()
    .describe(
      "Test against multiple compiler versions in parallel (e.g. ['latest', '0.26.0', 'detect'])",
    ),
});

// Type exports
export type AnalyzeContractInput = z.infer<typeof AnalyzeContractInputSchema>;
export type ExplainCircuitInput = z.infer<typeof ExplainCircuitInputSchema>;
export type CompileContractInput = z.infer<typeof CompileContractInputSchema>;

