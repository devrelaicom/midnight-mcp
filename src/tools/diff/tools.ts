/**
 * Diff tool definitions
 * MCP tool registration for contract diff operations
 */

import type { ExtendedToolDefinition, OutputSchema } from "../../types/index.js";
import { zodInputSchema } from "../../utils/schema.js";
import { DiffContractsInputSchema } from "./schemas.js";
import { diffContracts } from "./handlers.js";

// ============================================================================
// Output Schemas
// ============================================================================

const diffContractsOutputSchema: OutputSchema = {
  type: "object",
  properties: {
    hasChanges: {
      type: "boolean",
      description: "Whether any structural changes were detected",
    },
    circuits: {
      type: "object",
      description: "Circuit-level changes between the two contracts",
      properties: {
        added: {
          type: "array",
          items: { type: "string" },
          description: "Circuits added in the modified contract",
        },
        removed: {
          type: "array",
          items: { type: "string" },
          description: "Circuits removed from the original contract",
        },
        modified: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              changes: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
          description: "Circuits that were modified",
        },
      },
    },
    ledger: {
      type: "object",
      description: "Ledger field changes between the two contracts",
      properties: {
        added: {
          type: "array",
          items: { type: "string" },
          description: "Ledger fields added in the modified contract",
        },
        removed: {
          type: "array",
          items: { type: "string" },
          description: "Ledger fields removed from the original contract",
        },
        modified: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              changes: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
          description: "Ledger fields that were modified",
        },
      },
    },
    pragma: {
      type: "object",
      description: "Pragma directive changes",
      properties: {
        before: { type: "string", description: "Pragma value in original contract" },
        after: { type: "string", description: "Pragma value in modified contract" },
        changed: { type: "boolean", description: "Whether the pragma changed" },
      },
    },
    imports: {
      type: "object",
      description: "Import statement changes",
      properties: {
        added: {
          type: "array",
          items: { type: "string" },
          description: "Imports added in the modified contract",
        },
        removed: {
          type: "array",
          items: { type: "string" },
          description: "Imports removed from the original contract",
        },
      },
    },
  },
  required: ["hasChanges", "circuits", "ledger", "pragma", "imports"],
  description: "Semantic diff of two Compact contracts showing structural changes",
};

// ============================================================================
// Tool Definitions
// ============================================================================

export const diffTools: ExtendedToolDefinition[] = [
  {
    name: "midnight-diff-contracts",
    description: `Compare two versions of a Compact contract and show semantic differences. Shows added/removed/modified circuits, ledger fields, imports, and pragma changes.

USAGE GUIDANCE:
• Provide both the original and modified contract code
• Results show structural changes, not line-by-line text diff`,
    inputSchema: zodInputSchema(DiffContractsInputSchema),
    outputSchema: diffContractsOutputSchema,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      title: "Diff Contracts",
      category: "analyze",
    },
    handler: diffContracts,
  },
];
