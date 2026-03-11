import { z } from "zod";

export const FormatContractInputSchema = z.object({
  code: z.string().describe("Compact contract source code to format"),
  version: z.string().optional().describe("Compiler version to use for formatting (e.g. '0.29.0')"),
});

export type FormatContractInput = z.infer<typeof FormatContractInputSchema>;
