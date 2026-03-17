/**
 * Analyze tool definitions
 * MCP tool registration for analysis operations
 */

import type { ExtendedToolDefinition, OutputSchema } from "../../types/index.js";
import { zodInputSchema } from "../../utils/schema.js";
import {
  AnalyzeContractInputSchema,
  CompileContractInputSchema,
  VisualizeContractInputSchema,
  ProveContractInputSchema,
  CompileArchiveInputSchema,
} from "./schemas.js";
import {
  analyzeContract,
  compileContract,
  visualizeContract,
  proveContract,
  compileArchiveHandler,
} from "./handlers.js";

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

Modes:
• mode='fast' (default): Source-level analysis — returns summary, structure, findings, recommendations, circuit explanations
• mode='deep': Compile-backed analysis — includes compilation results alongside full analysis

Filtering:
• include: Filter response to specific sections ('diagnostics', 'facts', 'findings', 'recommendations', 'circuits')
• circuit: Focus analysis on a single circuit by name
• version/versions: Select compiler version(s) for deep mode

USAGE GUIDANCE:
• Call once per contract - results are deterministic
• Use include to reduce response size when you only need specific sections
• Use mode='deep' when you need compilation diagnostics alongside analysis`,
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
  {
    name: "midnight-visualize-contract",
    description: `Generate a visual architecture graph of a Compact contract.

Returns a DAG of circuit call relationships, ledger access patterns, and witness dependencies.
Includes a Mermaid diagram string that can be rendered by supporting clients.

Use this for: understanding contract architecture, mapping dependencies, documentation.`,
    inputSchema: zodInputSchema(VisualizeContractInputSchema),
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      title: "Visualize Contract Architecture",
      category: "analyze",
    },
    handler: visualizeContract,
  },
  {
    name: "midnight-prove-contract",
    description: `Analyze ZK privacy boundaries for a Compact contract.

Returns per-circuit analysis of what data crosses the proof boundary, public vs private inputs,
and proof flow. Helps understand the privacy model of a contract.

Use this for: privacy auditing, understanding what's exposed on-chain, proof flow analysis.`,
    inputSchema: zodInputSchema(ProveContractInputSchema),
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      title: "Analyze ZK Privacy Boundaries",
      category: "analyze",
    },
    handler: proveContract,
  },
  {
    name: "midnight-compile-archive",
    description: `Compile a multi-file Compact project.

Accepts a map of relative file paths to source code. Directory structure in the keys is preserved
so that imports between files resolve correctly. The files are packaged into an archive and
sent to the compiler.

Example files map:
  { "src/main.compact": "import ...", "src/lib/utils.compact": "export circuit ..." }

Use this for: projects with multiple Compact source files that import from each other.`,
    inputSchema: zodInputSchema(CompileArchiveInputSchema),
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      title: "Compile Multi-File Archive",
      category: "analyze",
    },
    handler: compileArchiveHandler,
  },
];
