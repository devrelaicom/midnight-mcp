/**
 * Generation tool input schemas
 * Zod schemas for validating tool inputs
 */

import { z } from "zod";

// Schema definitions
export const GenerateContractInputSchema = z.object({
  requirements: z.string().describe("Natural language description of the contract requirements"),
  contractType: z
    .enum(["counter", "token", "voting", "custom"])
    .optional()
    .describe("Type of contract to generate"),
  baseExample: z.string().optional().describe("Example contract code to use as a base"),
});

export const ReviewContractInputSchema = z.object({
  code: z.string().describe("Compact contract code to review"),
});

export const DocumentContractInputSchema = z.object({
  code: z.string().describe("Compact contract code to document"),
  format: z
    .enum(["markdown", "jsdoc"])
    .optional()
    .describe("Documentation format (default: markdown)"),
});

// Type exports
export type GenerateContractInput = z.infer<typeof GenerateContractInputSchema>;
export type ReviewContractInput = z.infer<typeof ReviewContractInputSchema>;
export type DocumentContractInput = z.infer<typeof DocumentContractInputSchema>;
