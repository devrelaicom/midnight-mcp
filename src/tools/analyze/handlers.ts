/**
 * Analyze handler functions
 * Business logic for analysis-related MCP tools
 */

import { logger, MCPError, ErrorCodes } from "../../utils/index.js";
import { compile, analyze } from "../../services/playground.js";
import type { AnalyzeContractInput, ExplainCircuitInput, CompileContractInput } from "./schemas.js";

/**
 * Analyze a Compact smart contract via the playground API
 */
export async function analyzeContract(input: AnalyzeContractInput) {
  logger.debug("Analyzing Compact contract via playground API");

  const result = await analyze(input.code, input.mode);

  return {
    success: result.success,
    mode: result.mode,
    pragma: result.pragma,
    imports: result.imports,
    circuits: result.circuits,
    ledger: result.ledger,
    ...(result.compilation && { compilation: result.compilation }),
  };
}

/**
 * Explain what a specific circuit does in plain language
 * Uses the playground API for analysis, then builds explanation from results
 */
export async function explainCircuit(input: ExplainCircuitInput) {
  logger.debug("Explaining circuit via playground API");

  const result = await analyze(input.circuitCode, "fast");
  const circuit = result.circuits[0];

  if (!circuit) {
    throw new MCPError(
      "No circuit definition found in the provided code",
      ErrorCodes.INVALID_INPUT,
      "Provide a complete circuit definition including the 'circuit' keyword. " +
        "Example: export circuit myFunction(param: Field): [] { ... }",
    );
  }

  // Detect common operations from the source code
  const code = input.circuitCode;
  const operations: string[] = [];
  const zkImplications: string[] = [];

  if (code.includes("disclose")) {
    operations.push("Reveals private data selectively (disclose)");
    zkImplications.push(
      "Data revealed via disclose() will be visible on-chain while proving possession of private data",
    );
  }
  if (code.includes("commit")) {
    operations.push("Creates cryptographic commitments (commit)");
    zkImplications.push("Commitments allow hiding data while proving properties about it");
  }
  if (code.includes("hash")) {
    operations.push("Computes cryptographic hashes (hash)");
    zkImplications.push(
      "Hashes are computed in-circuit and can be verified without revealing preimages",
    );
  }
  if (code.includes("assert")) {
    operations.push("Validates constraints (assert)");
    zkImplications.push(
      "Assertions create ZK constraints - the proof will fail if any assertion fails",
    );
  }
  if (code.includes(".insert")) operations.push("Inserts data into ledger storage");
  if (code.includes(".increment")) operations.push("Increments a counter value");
  if (code.includes(".decrement")) operations.push("Decrements a counter value");

  // Build explanation
  let explanation = `The circuit '${circuit.name}' is a `;
  explanation += circuit.exported
    ? "public (exported) function that can be called by anyone. "
    : "private (internal) function used by other circuits. ";

  if (circuit.params.length > 0) {
    explanation += `It takes ${circuit.params.length} parameter(s): `;
    explanation += circuit.params.map((p) => `${p.name} (${p.type})`).join(", ");
    explanation += ". ";
  }

  if (circuit.returnType && circuit.returnType !== "Void" && circuit.returnType !== "[]") {
    explanation += `It returns a value of type ${circuit.returnType}. `;
  }

  if (operations.length > 0) {
    explanation += `\n\nKey operations performed:\n`;
    operations.forEach((op, i) => {
      explanation += `${i + 1}. ${op}\n`;
    });
  }

  // Privacy considerations
  const privacyConsiderations: string[] = [];
  if (code.includes("disclose")) {
    privacyConsiderations.push("Uses disclose() - some private data will be revealed on-chain");
  }
  if (circuit.exported) {
    privacyConsiderations.push("Public circuit - anyone can call this and generate proofs");
  }
  if (code.includes("@private") || code.includes("witness")) {
    privacyConsiderations.push(
      "Accesses private state or witnesses - ensure sensitive data is handled correctly",
    );
  }
  if (privacyConsiderations.length === 0) {
    privacyConsiderations.push("No specific privacy concerns identified in this circuit");
  }

  return {
    circuitName: circuit.name,
    isPublic: circuit.exported,
    parameters: circuit.params,
    returnType: circuit.returnType,
    explanation,
    operations,
    zkImplications:
      zkImplications.length > 0
        ? zkImplications
        : [
            "This circuit generates a zero-knowledge proof that the computation was performed correctly",
          ],
    privacyConsiderations,
  };
}
/**
 * Compile a Compact smart contract via the playground API proxy
 */
export async function compileContract(input: CompileContractInput): Promise<object> {
  logger.info("Compiling Compact contract via API proxy", {
    codeLength: input.code.length,
    skipZk: input.skipZk,
    fullCompile: input.fullCompile,
    version: input.version,
    versions: input.versions,
  });

  const skipZk = input.fullCompile ? false : input.skipZk;

  const result = await compile(input.code, {
    skipZk,
    wrapWithDefaults: true,
    version: input.version,
    versions: input.versions,
  });

  return {
    ...result,
    compilationMode: skipZk ? "syntax-only" : "full",
  };
}
