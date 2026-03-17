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
      "Analysis mode: 'fast' for source-level analysis (instant), 'deep' for compile-backed analysis",
    ),
  include: z
    .array(z.string())
    .optional()
    .describe(
      "Filter response sections: 'diagnostics', 'facts', 'findings', 'recommendations', 'circuits'. Summary and structure are always returned.",
    ),
  circuit: z.string().optional().describe("Focus analysis on a single circuit by name"),
  version: z
    .string()
    .optional()
    .describe("Compiler version (e.g. '0.29.0') or 'detect' for pragma-based resolution"),
  versions: z
    .array(z.string())
    .optional()
    .describe("Multi-version analysis (deep mode only), e.g. ['latest', '0.26.0']"),
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
  includeBindings: z
    .boolean()
    .optional()
    .default(false)
    .describe("Return compiler-generated TypeScript artifacts. Forces full ZK compilation."),
  libraries: z
    .array(z.string())
    .max(20)
    .optional()
    .describe(
      "OpenZeppelin modules to link (e.g. ['access/Ownable', 'token/FungibleToken']). Max 20.",
    ),
});

export const VisualizeContractInputSchema = z.object({
  code: z.string().describe("Compact contract source code"),
  version: z.string().optional().describe("Compiler version (e.g. '0.29.0')"),
});

export const ProveContractInputSchema = z.object({
  code: z.string().describe("Compact contract source code"),
  version: z.string().optional().describe("Compiler version (e.g. '0.29.0')"),
});

export const CompileArchiveInputSchema = z.object({
  files: z
    .record(z.string(), z.string())
    .describe(
      "Map of relative file paths to source code. Keys preserve directory structure for import resolution. E.g. { 'src/main.compact': '...', 'src/lib/utils.compact': '...' }",
    ),
  version: z.string().optional().describe("Compiler version (e.g. '0.29.0')"),
  versions: z.array(z.string()).optional().describe("Multi-version compilation"),
  options: z
    .object({
      skipZk: z.boolean().optional().default(true).describe("Skip ZK generation (default: true)"),
      includeBindings: z
        .boolean()
        .optional()
        .default(false)
        .describe("Include TypeScript artifacts"),
      libraries: z.array(z.string()).max(20).optional().describe("OZ modules to link"),
    })
    .optional(),
});

// Type exports
export type AnalyzeContractInput = z.infer<typeof AnalyzeContractInputSchema>;
export type CompileContractInput = z.infer<typeof CompileContractInputSchema>;
export type VisualizeContractInput = z.infer<typeof VisualizeContractInputSchema>;
export type ProveContractInput = z.infer<typeof ProveContractInputSchema>;
export type CompileArchiveInput = z.infer<typeof CompileArchiveInputSchema>;
