/**
 * Main orchestrator for contract structure extraction.
 * Coordinates security checks, parsing, issue detection, and result assembly.
 */

import { readFile } from "fs/promises";
import { basename } from "path";
import { logger } from "../../../utils/index.js";
import type { ExtractContractStructureInput } from "../schemas.js";
import { validateFilePath, isValidUtf8Text } from "./security.js";
import { parseContract } from "./parsers.js";
import { detectIssues } from "./checks.js";

/**
 * Extract the structure of a Compact contract (circuits, witnesses, ledger, etc.)
 * This helps agents understand what a contract does without parsing it themselves
 */
export async function extractContractStructure(input: ExtractContractStructureInput) {
  logger.debug("Extracting contract structure", {
    hasCode: !!input.code,
    filePath: input.filePath,
  });

  // Resolve code source
  let code: string;
  let filename: string;

  if (input.filePath) {
    // SECURITY: Validate file path
    const pathValidation = validateFilePath(input.filePath);
    if (!pathValidation.valid) {
      return {
        success: false,
        error: "Invalid file path",
        message: pathValidation.error,
      };
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      code = await readFile(pathValidation.normalizedPath!, "utf-8");
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      filename = basename(pathValidation.normalizedPath!);

      // Check for binary content
      if (!isValidUtf8Text(code)) {
        return {
          success: false,
          error: "Invalid file content",
          message: "File appears to be binary or contains invalid characters",
        };
      }
    } catch (fsError: unknown) {
      const err = fsError as { code?: string; message?: string };
      return {
        success: false,
        error: "Failed to read file",
        message: `Cannot read file: ${input.filePath}`,
        details: err.code === "ENOENT" ? "File does not exist" : err.message,
      };
    }
  } else if (input.code) {
    code = input.code;
    filename = "contract.compact";

    // Check for binary content
    if (!isValidUtf8Text(code)) {
      return {
        success: false,
        error: "Invalid code content",
        message: "Code contains invalid characters",
      };
    }
  } else {
    return {
      success: false,
      error: "No contract provided",
      message: "Must provide either 'code' or 'filePath'",
    };
  }

  // Parse contract structure
  const parsed = parseContract(code);

  // Compute exports
  const exports = {
    circuits: parsed.circuits.filter((c) => c.isExport).map((c) => c.name),
    witnesses: parsed.witnesses.filter((w) => w.isExport).map((w) => w.name),
    ledger: parsed.ledgerItems.filter((l) => l.isExport).map((l) => l.name),
  };

  // Detect issues
  const potentialIssues = detectIssues(parsed);

  // Build summary
  const summary = [];
  if (parsed.circuits.length > 0) {
    summary.push(`${parsed.circuits.length} circuit(s)`);
  }
  if (parsed.witnesses.length > 0) {
    summary.push(`${parsed.witnesses.length} witness(es)`);
  }
  if (parsed.ledgerItems.length > 0) {
    summary.push(`${parsed.ledgerItems.length} ledger item(s)`);
  }
  if (parsed.types.length > 0) {
    summary.push(`${parsed.types.length} type alias(es)`);
  }
  if (parsed.structs.length > 0) {
    summary.push(`${parsed.structs.length} struct(s)`);
  }
  if (parsed.enums.length > 0) {
    summary.push(`${parsed.enums.length} enum(s)`);
  }

  return {
    success: true,
    filename,
    languageVersion: parsed.languageVersion,
    imports: parsed.imports,
    structure: {
      circuits: parsed.circuits,
      witnesses: parsed.witnesses,
      ledgerItems: parsed.ledgerItems,
      types: parsed.types,
      structs: parsed.structs,
      enums: parsed.enums,
    },
    exports,
    stats: {
      lineCount: parsed.lines.length,
      circuitCount: parsed.circuits.length,
      witnessCount: parsed.witnesses.length,
      ledgerCount: parsed.ledgerItems.length,
      typeCount: parsed.types.length,
      structCount: parsed.structs.length,
      enumCount: parsed.enums.length,
      exportedCircuits: exports.circuits.length,
      exportedWitnesses: exports.witnesses.length,
      exportedLedger: exports.ledger.length,
    },
    potentialIssues: potentialIssues.length > 0 ? potentialIssues : undefined,
    summary: summary.length > 0 ? summary.join(", ") : "Empty contract",
    message:
      potentialIssues.length > 0
        ? `⚠️ Found ${potentialIssues.length} potential issue(s). Contract contains: ${summary.join(", ") || "no definitions found"}`
        : `📋 Contract contains: ${summary.join(", ") || "no definitions found"}`,
  };
}
