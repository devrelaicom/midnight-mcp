/**
 * Analyze tool input schemas
 * Zod schemas for validating tool inputs
 */

import { z } from "zod";

// Schema definitions
export const AnalyzeContractInputSchema = z.object({
  code: z.string().describe("Compact contract source code"),
  checkSecurity: z
    .boolean()
    .optional()
    .default(true)
    .describe("Run security analysis"),
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
      "Skip ZK circuit generation for faster syntax-only validation (default: true)",
    ),
  fullCompile: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Perform full compilation including ZK generation (slower but complete)",
    ),
});

// Type exports
export type AnalyzeContractInput = z.infer<typeof AnalyzeContractInputSchema>;
export type ExplainCircuitInput = z.infer<typeof ExplainCircuitInputSchema>;
export type CompileContractInput = z.infer<typeof CompileContractInputSchema>;

// Shared types
export interface SecurityFinding {
  severity: "info" | "warning" | "error";
  message: string;
  line?: number;
  suggestion?: string;
}
