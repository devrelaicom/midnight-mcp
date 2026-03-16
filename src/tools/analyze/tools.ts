/**
 * Analyze tool definitions
 * MCP tool registration for analysis operations
 */

import type { ExtendedToolDefinition, OutputSchema } from "../../types/index.js";
import { zodInputSchema } from "../../utils/schema.js";
import { AnalyzeContractInputSchema, CompileContractInputSchema } from "./schemas.js";
import { analyzeContract, compileContract } from "./handlers.js";

// ============================================================================
// Output Schemas
// ============================================================================

const analyzeContractOutputSchema: OutputSchema = {
  type: "object",
  properties: {
    summary: {
      type: "object",
      description: "Summary statistics of the contract",
      properties: {
        hasLedger: { type: "boolean" },
        hasCircuits: { type: "boolean" },
        hasWitnesses: { type: "boolean" },
        totalLines: { type: "number" },
        publicCircuits: { type: "number" },
        privateCircuits: { type: "number" },
        publicState: { type: "number" },
        privateState: { type: "number" },
      },
    },
    structure: {
      type: "object",
      description: "Contract structure breakdown",
      properties: {
        imports: { type: "array", items: { type: "string" } },
        exports: { type: "array", items: { type: "string" } },
        ledger: {
          type: "array",
          description: "Ledger state fields",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              type: { type: "string" },
              isPrivate: { type: "boolean" },
            },
          },
        },
        circuits: {
          type: "array",
          description: "Circuit definitions",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              isPublic: { type: "boolean" },
              parameters: { type: "array", items: { type: "object" } },
              returnType: { type: "string" },
            },
          },
        },
        witnesses: {
          type: "array",
          description: "Witness functions",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              parameters: { type: "array", items: { type: "object" } },
              returnType: { type: "string" },
            },
          },
        },
        types: {
          type: "array",
          description: "Type definitions",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              definition: { type: "string" },
            },
          },
        },
      },
    },
    securityFindings: {
      type: "array",
      description: "Security analysis findings",
      items: {
        type: "object",
        properties: {
          severity: {
            type: "string",
            enum: ["info", "warning", "error"],
          },
          message: { type: "string" },
          suggestion: { type: "string" },
        },
      },
    },
    recommendations: {
      type: "array",
      items: { type: "string" },
      description: "Recommendations for improvement",
    },
  },
  required: ["summary", "structure", "securityFindings", "recommendations"],
  description: "Detailed contract analysis with security findings",
};

const compileContractOutputSchema: OutputSchema = {
  type: "object",
  properties: {
    success: {
      type: "boolean",
      description: "Whether compilation succeeded",
    },
    output: {
      type: "string",
      description: "Compiler output message",
    },
    compilationMode: {
      type: "string",
      enum: ["syntax-only", "full"],
      description: "Type of compilation performed",
    },
    errors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          message: { type: "string" },
          line: { type: "number" },
          column: { type: "number" },
          severity: { type: "string" },
        },
      },
      description: "Compiler errors (if any)",
    },
    executionTime: {
      type: "number",
      description: "Compilation time in milliseconds",
    },
  },
  required: ["success"],
  description: "Compilation result from the hosted compiler service",
};

// ============================================================================
// Tool Definitions
// ============================================================================

export const analyzeTools: ExtendedToolDefinition[] = [
  {
    name: "midnight-analyze-contract",
    description: `Analyze Compact contract structure via the playground API.

Options:
• mode='fast' (default): Regex-based structure extraction — instant, returns pragma, imports, circuits, ledger fields
• mode='deep': Compile-backed analysis — includes compilation results alongside structure

Use this for: understanding structure, pre-compilation checks, circuit discovery.

USAGE GUIDANCE:
• Call once per contract - results are deterministic
• Use mode='deep' to also get compilation results`,
    inputSchema: zodInputSchema(AnalyzeContractInputSchema),
    outputSchema: analyzeContractOutputSchema,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      title: "Analyze Compact Contract",
      category: "analyze",
    },
    handler: analyzeContract,
  },
  {
    name: "midnight-compile-contract",
    description: `Compile Compact code using the hosted compiler service.

Returns real compiler errors with line numbers. No local fallback — if the service is down, you get a clear error.

Options:
• skipZk=true (default): Fast syntax validation only (~1-2s)
• fullCompile=true: Full compilation with ZK circuit generation (~10-30s)
• version: Specific compiler version (e.g. '0.29.0') or 'detect' for pragma-based resolution
• versions: Test against multiple compiler versions in parallel (e.g. ['latest', '0.26.0', 'detect'])

USAGE GUIDANCE:
• Call after generating or modifying Compact code
• Use skipZk=true for quick validation during development
• Use fullCompile=true for final validation before deployment
• Use versions to test compatibility across compiler releases`,
    inputSchema: zodInputSchema(CompileContractInputSchema),
    outputSchema: compileContractOutputSchema,
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true, // Makes network requests
      title: "🔧 Compile Contract",
      category: "analyze",
    },
    handler: compileContract,
  },
];
