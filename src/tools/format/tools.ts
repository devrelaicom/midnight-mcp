/**
 * Format tool definitions
 * MCP tool registration for formatting operations
 */

import type { ExtendedToolDefinition, OutputSchema } from "../../types/index.js";
import { zodInputSchema } from "../../utils/schema.js";
import { FormatContractInputSchema } from "./schemas.js";
import { formatContract } from "./handlers.js";

// ============================================================================
// Output Schemas
// ============================================================================

const formatContractOutputSchema: OutputSchema = {
  type: "object",
  properties: {
    success: {
      type: "boolean",
      description: "Whether formatting succeeded",
    },
    formatted: {
      type: "string",
      description: "The formatted contract source code",
    },
    changed: {
      type: "boolean",
      description: "Whether the code was changed by formatting",
    },
    diff: {
      type: "string",
      description: "Diff showing changes made by formatting",
    },
  },
  required: ["success", "formatted", "changed"],
  description: "Formatted contract code with diff of changes",
};

// ============================================================================
// Tool Definitions
// ============================================================================

export const formatTools: ExtendedToolDefinition[] = [
  {
    name: "midnight-format-contract",
    description: `Format Compact contract code using the official formatter. Returns formatted code with a diff showing changes made.

USAGE GUIDANCE:
• Call once per contract - formatting is deterministic
• Use version parameter to target a specific compiler version`,
    inputSchema: zodInputSchema(FormatContractInputSchema),
    outputSchema: formatContractOutputSchema,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      title: "Format Contract",
      category: "analyze",
    },
    handler: formatContract,
  },
];
