import { z } from "zod";

export const DiffContractsInputSchema = z.object({
  before: z.string().describe("Original Compact contract source code"),
  after: z.string().describe("Modified Compact contract source code"),
});

export type DiffContractsInput = z.infer<typeof DiffContractsInputSchema>;
