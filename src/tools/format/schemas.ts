import { z } from "zod";

export const FormatContractInputSchema = z.object({
  code: z.string().describe("Compact contract source code to format"),
  version: z.string().optional().describe("Compiler version to use for formatting (e.g. '0.29.0')"),
  versions: z
    .array(z.string())
    .optional()
    .describe("Format with multiple compiler versions for consistency testing"),
});

export type FormatContractInput = z.infer<typeof FormatContractInputSchema>;
