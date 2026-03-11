/**
 * Analyze handler functions
 * Business logic for analysis-related MCP tools
 */

import { parseCompactFile, CodeUnit } from "../../pipeline/index.js";
import { logger, MCPError, ErrorCodes } from "../../utils/index.js";
import {
  compileContract as compileWithService,
  checkCompilerHealth,
  getCompilerUrl,
} from "../../services/compiler.js";
import type {
  AnalyzeContractInput,
  ExplainCircuitInput,
  CompileContractInput,
  SecurityFinding,
} from "./schemas.js";

/**
 * Analyze a Compact smart contract for structure, patterns, and potential issues
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function analyzeContract(input: AnalyzeContractInput) {
  logger.debug("Analyzing Compact contract");

  const parsed = parseCompactFile("contract.compact", input.code);
  const findings: SecurityFinding[] = [];

  // Extract structured information
  const ledgerFields = parsed.codeUnits.filter((u) => u.type === "ledger");
  const circuits = parsed.codeUnits.filter((u) => u.type === "circuit");
  const witnesses = parsed.codeUnits.filter((u) => u.type === "witness");
  const types = parsed.codeUnits.filter((u) => u.type === "type");

  // Security analysis
  if (input.checkSecurity) {
    // Check for private state exposure
    const privateFields = ledgerFields.filter((f) => f.isPrivate);
    for (const field of privateFields) {
      // Check if private field is used in a public circuit without proper protection
      for (const circuit of circuits) {
        if (circuit.isPublic && circuit.code.includes(field.name)) {
          if (!circuit.code.includes("disclose") && !circuit.code.includes("commit")) {
            findings.push({
              severity: "warning",
              message: `Private field '${field.name}' used in public circuit '${circuit.name}' without disclose/commit`,
              suggestion: "Consider using disclose() or commit() to properly handle private data",
            });
          }
        }
      }
    }

    // Check for missing access control on state-modifying circuits
    for (const circuit of circuits) {
      if (circuit.isPublic) {
        const modifiesState =
          circuit.code.includes(".insert") ||
          circuit.code.includes(".increment") ||
          circuit.code.includes(".decrement") ||
          circuit.code.includes("=");

        if (modifiesState && !circuit.code.includes("assert")) {
          findings.push({
            severity: "info",
            message: `Public circuit '${circuit.name}' modifies state without assertions`,
            suggestion: "Consider adding assertions to validate inputs and permissions",
          });
        }
      }
    }

    // Check for unused witnesses
    for (const witness of witnesses) {
      let isUsed = false;
      for (const circuit of circuits) {
        if (circuit.code.includes(witness.name)) {
          isUsed = true;
          break;
        }
      }
      if (!isUsed) {
        findings.push({
          severity: "info",
          message: `Witness '${witness.name}' is defined but not used in any circuit`,
          suggestion: "Remove unused witnesses or implement their usage",
        });
      }
    }

    // Check for common patterns
    if (!parsed.imports.includes("CompactStandardLibrary")) {
      findings.push({
        severity: "info",
        message: "Standard library not imported",
        suggestion: "Consider adding 'import CompactStandardLibrary;' for common utilities",
      });
    }
  }

  // Generate summary
  const summary = {
    hasLedger: parsed.metadata.hasLedger,
    hasCircuits: parsed.metadata.hasCircuits,
    hasWitnesses: parsed.metadata.hasWitnesses,
    totalLines: parsed.metadata.lineCount,
    publicCircuits: circuits.filter((c) => c.isPublic).length,
    privateCircuits: circuits.filter((c) => !c.isPublic).length,
    publicState: ledgerFields.filter((f) => !f.isPrivate).length,
    privateState: ledgerFields.filter((f) => f.isPrivate).length,
  };

  return {
    summary,
    structure: {
      imports: parsed.imports,
      exports: parsed.exports,
      ledger: ledgerFields.map((f) => ({
        name: f.name,
        type: f.returnType,
        isPrivate: f.isPrivate,
      })),
      circuits: circuits.map((c) => ({
        name: c.name,
        isPublic: c.isPublic,
        parameters: c.parameters,
        returnType: c.returnType,
      })),
      witnesses: witnesses.map((w) => ({
        name: w.name,
        parameters: w.parameters,
        returnType: w.returnType,
      })),
      types: types.map((t) => ({
        name: t.name,
        definition: t.returnType,
      })),
    },
    securityFindings: findings,
    recommendations:
      findings.length === 0
        ? ["Contract structure looks good! No issues found."]
        : findings.map((f) => f.suggestion).filter(Boolean),
  };
}

/**
 * Explain what a specific circuit does in plain language
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function explainCircuit(input: ExplainCircuitInput) {
  logger.debug("Explaining circuit");

  const parsed = parseCompactFile("circuit.compact", input.circuitCode);
  const circuit = parsed.codeUnits.find((u) => u.type === "circuit");

  if (!circuit) {
    throw new MCPError(
      "No circuit definition found in the provided code",
      ErrorCodes.INVALID_INPUT,
      "Provide a complete circuit definition including the 'circuit' keyword. " +
        "Example: export circuit myFunction(param: Field): [] { ... }",
    );
  }

  // Analyze the circuit
  const operations: string[] = [];
  const zkImplications: string[] = [];

  // Detect common operations
  if (circuit.code.includes("disclose")) {
    operations.push("Reveals private data selectively (disclose)");
    zkImplications.push(
      "Data revealed via disclose() will be visible on-chain while proving possession of private data",
    );
  }

  if (circuit.code.includes("commit")) {
    operations.push("Creates cryptographic commitments (commit)");
    zkImplications.push("Commitments allow hiding data while proving properties about it");
  }

  if (circuit.code.includes("hash")) {
    operations.push("Computes cryptographic hashes (hash)");
    zkImplications.push(
      "Hashes are computed in-circuit and can be verified without revealing preimages",
    );
  }

  if (circuit.code.includes("assert")) {
    operations.push("Validates constraints (assert)");
    zkImplications.push(
      "Assertions create ZK constraints - the proof will fail if any assertion fails",
    );
  }

  if (circuit.code.includes(".insert")) {
    operations.push("Inserts data into ledger storage");
  }

  if (circuit.code.includes(".increment")) {
    operations.push("Increments a counter value");
  }

  if (circuit.code.includes(".decrement")) {
    operations.push("Decrements a counter value");
  }

  // Build explanation
  const explanation = buildCircuitExplanation(circuit, operations);

  return {
    circuitName: circuit.name,
    isPublic: circuit.isPublic,
    parameters: circuit.parameters,
    returnType: circuit.returnType,
    explanation,
    operations,
    zkImplications:
      zkImplications.length > 0
        ? zkImplications
        : [
            "This circuit generates a zero-knowledge proof that the computation was performed correctly",
          ],
    privacyConsiderations: getPrivacyConsiderations(circuit),
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildCircuitExplanation(circuit: CodeUnit, operations: string[]): string {
  let explanation = `The circuit '${circuit.name}' is a `;

  if (circuit.isPublic) {
    explanation += "public (exported) function that can be called by anyone. ";
  } else {
    explanation += "private (internal) function used by other circuits. ";
  }

  if (circuit.parameters && circuit.parameters.length > 0) {
    explanation += `It takes ${circuit.parameters.length} parameter(s): `;
    explanation += circuit.parameters.map((p) => `${p.name} (${p.type})`).join(", ");
    explanation += ". ";
  }

  if (circuit.returnType && circuit.returnType !== "Void") {
    explanation += `It returns a value of type ${circuit.returnType}. `;
  }

  if (operations.length > 0) {
    explanation += `\n\nKey operations performed:\n`;
    operations.forEach((op, i) => {
      explanation += `${i + 1}. ${op}\n`;
    });
  }

  return explanation;
}

function getPrivacyConsiderations(circuit: CodeUnit): string[] {
  const considerations: string[] = [];

  if (circuit.code.includes("disclose")) {
    considerations.push("Uses disclose() - some private data will be revealed on-chain");
  }

  if (circuit.isPublic) {
    considerations.push("Public circuit - anyone can call this and generate proofs");
  }

  if (circuit.code.includes("@private") || circuit.code.includes("witness")) {
    considerations.push(
      "Accesses private state or witnesses - ensure sensitive data is handled correctly",
    );
  }

  if (considerations.length === 0) {
    considerations.push("No specific privacy concerns identified in this circuit");
  }

  return considerations;
}
/**
 * Compile a Compact smart contract using the hosted compiler service
 * Falls back to static analysis if the compiler service is unavailable
 */
export async function compileContract(input: CompileContractInput): Promise<object> {
  logger.info("Compiling Compact contract via hosted service", {
    codeLength: input.code.length,
    skipZk: input.skipZk,
    fullCompile: input.fullCompile,
  });

  // Determine compilation mode
  const skipZk = input.fullCompile ? false : input.skipZk;

  // Call the hosted compiler service
  const result = await compileWithService(input.code, {
    wrapWithDefaults: true,
    skipZk,
  });

  if (result.success) {
    return {
      success: true,
      message: result.message,
      compilerVersion: result.compilerVersion,
      compilationMode: skipZk ? "syntax-only" : "full",
      validationType: "compiler",
      output: {
        circuits: result.circuits || [],
        ledgerFields: result.ledgerFields || [],
        exports: result.exports || [],
      },
      warnings: result.warnings || [],
      serviceUrl: getCompilerUrl(),
    };
  } else {
    // Check if service is unavailable - fall back to static analysis
    if (!result.serviceAvailable) {
      logger.warn("Compiler service unavailable, falling back to static analysis", {
        error: result.error,
      });

      // Run static analysis as fallback
      const staticResult = await analyzeContract({
        code: input.code,
        checkSecurity: true,
      });

      // Include security findings as warnings (without noisy prefix)
      const securityWarnings = staticResult.securityFindings.map(
        (f: SecurityFinding) => `[${f.severity}] ${f.message}`,
      );

      return {
        success: true, // Static analysis succeeded
        message: "Static analysis completed (compiler service unavailable)",
        validationType: "static-analysis-fallback",
        compilationMode: "none",
        serviceAvailable: false,
        serviceUrl: getCompilerUrl(),
        fallbackReason: result.message,
        warnings: securityWarnings,
        staticAnalysis: {
          summary: staticResult.summary,
          structure: staticResult.structure,
          securityFindings: staticResult.securityFindings,
          recommendations: staticResult.recommendations,
        },
      };
    }

    // Compiler available but compilation failed — throw so the server's
    // catch block returns { isError: true } per our error handling convention.
    const hint =
      result.error === "TIMEOUT"
        ? "The contract may be too complex. Try simplifying or breaking it into smaller pieces."
        : result.errorDetails?.line
          ? `Check line ${result.errorDetails.line} for the issue.`
          : undefined;

    throw new MCPError(result.message || "Compilation failed", ErrorCodes.PARSE_ERROR, hint, {
      compilerError: result.error,
      validationType: "compiler",
      serviceAvailable: result.serviceAvailable,
      serviceUrl: getCompilerUrl(),
      ...(result.errorDetails && {
        location: {
          line: result.errorDetails.line,
          column: result.errorDetails.column,
          errorType: result.errorDetails.errorType,
        },
      }),
    });
  }
}

/**
 * Check compiler service health status
 */
export async function getCompilerStatus(): Promise<object> {
  const health = await checkCompilerHealth();

  return {
    serviceUrl: getCompilerUrl(),
    available: health.available,
    compilerVersion: health.version,
    error: health.error,
    message: health.available
      ? `✅ Compiler service online (v${health.version})`
      : `❌ Compiler service unavailable: ${health.error ?? "unknown error"}`,
  };
}
