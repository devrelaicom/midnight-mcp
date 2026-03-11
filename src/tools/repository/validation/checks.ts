/**
 * Pre-compilation issue detection for Compact contracts.
 * All 11 checks that catch common mistakes before hitting the compiler.
 */

import { escapeRegex } from "./security.js";
import type { ParsedContract } from "./parsers.js";

// ============================================================================
// Types
// ============================================================================

export interface PotentialIssue {
  type: string;
  line?: number;
  message: string;
  suggestion: string;
  severity: "error" | "warning";
}

// Known CompactStandardLibrary exports that shouldn't be redefined
const stdlibExports = [
  "burnAddress",
  "ownPublicKey",
  "contractAddress",
  "default",
  "disclose",
  "assert",
  "pad",
  "unpad",
  "Counter",
  "Map",
  "Set",
  "MerkleTree",
  "Opaque",
  "Vector",
];

// ============================================================================
// Issue Detection
// ============================================================================

/**
 * Run all issue detection checks against a parsed contract.
 */
export function detectIssues(parsed: ParsedContract): PotentialIssue[] {
  const issues: PotentialIssue[] = [];
  const { code, lineByIndex, imports, circuits, ledgerItems, witnesses } = parsed;

  // ========== CRITICAL SYNTAX CHECKS (P0) ==========
  checkDeprecatedLedgerBlock(code, lineByIndex, issues);
  checkVoidReturnType(code, lineByIndex, issues);
  checkOldPragmaFormat(code, lineByIndex, issues);
  checkUnexportedEnums(code, lineByIndex, issues);
  checkDeprecatedCellWrapper(code, lineByIndex, issues);

  // ========== EXISTING CHECKS ==========
  checkModuleLevelConst(code, lineByIndex, issues);
  checkStdlibNameCollisions(imports, circuits, code, issues);
  checkSealedExportConflicts(code, lineByIndex, circuits, issues);
  checkMissingConstructor(code, circuits, issues);
  checkStdlibTypeMismatches(imports, code, lineByIndex, issues);
  checkDivisionOperator(code, lineByIndex, issues);
  checkCounterValueAccess(code, lineByIndex, ledgerItems, issues);
  checkPotentialOverflow(code, lineByIndex, issues);
  checkUndisclosedWitnessConditionals(code, lineByIndex, witnesses, issues);
  checkUndisclosedConstructorParams(code, ledgerItems, issues);
  checkIfExpressionAssignment(code, lineByIndex, issues);

  return issues;
}

// ============================================================================
// Individual Checks
// ============================================================================

/** P0-1. Detect deprecated ledger block syntax */
function checkDeprecatedLedgerBlock(
  code: string,
  lineByIndex: number[],
  issues: PotentialIssue[],
): void {
  const ledgerBlockPattern = /ledger\s*\{/g;
  let match;
  while ((match = ledgerBlockPattern.exec(code)) !== null) {
    const lineNum = lineByIndex[match.index] || 1;
    issues.push({
      type: "deprecated_ledger_block",
      line: lineNum,
      message: `Deprecated ledger block syntax 'ledger { }' - causes parse error`,
      suggestion: `Use individual declarations: 'export ledger fieldName: Type;'`,
      severity: "error",
    });
  }
}

/** P0-2. Detect Void return type (doesn't exist in Compact) */
function checkVoidReturnType(code: string, lineByIndex: number[], issues: PotentialIssue[]): void {
  const voidReturnPattern = /circuit\s+\w+\s*\([^)]*\)\s*:\s*Void\b/g;
  let match;
  while ((match = voidReturnPattern.exec(code)) !== null) {
    const lineNum = lineByIndex[match.index] || 1;
    issues.push({
      type: "invalid_void_type",
      line: lineNum,
      message: `Invalid return type 'Void' - Void does not exist in Compact`,
      suggestion: `Use '[]' (empty tuple) for circuits that return nothing: 'circuit fn(): []'`,
      severity: "error",
    });
  }
}

/** P0-3. Detect old pragma format with patch version */
function checkOldPragmaFormat(code: string, lineByIndex: number[], issues: PotentialIssue[]): void {
  const oldPragmaPattern = /pragma\s+language_version\s*>=?\s*\d+\.\d+\.\d+/g;
  let match;
  while ((match = oldPragmaPattern.exec(code)) !== null) {
    const lineNum = lineByIndex[match.index] || 1;
    issues.push({
      type: "invalid_pragma_format",
      line: lineNum,
      message: `Pragma includes patch version which may cause parse errors`,
      suggestion: `Use bounded range format: 'pragma language_version >= 0.16 && <= 0.18;'`,
      severity: "error",
    });
  }
}

/** P0-4. Detect missing export on enums */
function checkUnexportedEnums(code: string, lineByIndex: number[], issues: PotentialIssue[]): void {
  const unexportedEnumPattern = /(?<!export\s+)enum\s+(\w+)\s*\{/g;
  let match;
  while ((match = unexportedEnumPattern.exec(code)) !== null) {
    const before = code.substring(Math.max(0, match.index - 10), match.index);
    if (!before.includes("export")) {
      const lineNum = lineByIndex[match.index] || 1;
      issues.push({
        type: "unexported_enum",
        line: lineNum,
        message: `Enum '${match[1] ?? ""}' is not exported - won't be accessible from TypeScript`,
        suggestion: `Add 'export' keyword: 'export enum ${match[1] ?? ""} { ... }'`,
        severity: "warning",
      });
    }
  }
}

/** P0-5. Detect Cell<T> wrapper (deprecated since 0.15) */
function checkDeprecatedCellWrapper(
  code: string,
  lineByIndex: number[],
  issues: PotentialIssue[],
): void {
  const cellPattern = /Cell\s*<\s*\w+\s*>/g;
  let match;
  while ((match = cellPattern.exec(code)) !== null) {
    const lineNum = lineByIndex[match.index] || 1;
    issues.push({
      type: "deprecated_cell_wrapper",
      line: lineNum,
      message: `'Cell<T>' wrapper is deprecated since Compact 0.15`,
      suggestion: `Use the type directly: 'Field' instead of 'Cell<Field>'`,
      severity: "error",
    });
  }
}

/** 1. Detect module-level const (not supported in Compact) */
function checkModuleLevelConst(
  code: string,
  lineByIndex: number[],
  issues: PotentialIssue[],
): void {
  const constPattern = /^const\s+(\w+)\s*:/gm;
  let match;
  while ((match = constPattern.exec(code)) !== null) {
    const beforeConst = code.substring(0, match.index);
    const lastCircuitStart = Math.max(
      beforeConst.lastIndexOf("circuit "),
      beforeConst.lastIndexOf("constructor {"),
    );
    const lastCloseBrace = beforeConst.lastIndexOf("}");

    if (lastCircuitStart === -1 || lastCloseBrace > lastCircuitStart) {
      const lineNum = lineByIndex[match.index] || 1;
      issues.push({
        type: "module_level_const",
        line: lineNum,
        message: `Module-level 'const ${match[1] ?? ""}' is not supported in Compact`,
        suggestion: `Use 'pure circuit ${match[1] ?? ""}(): <type> { return <value>; }' instead`,
        severity: "error",
      });
    }
  }
}

/** 2. Detect standard library name collisions */
function checkStdlibNameCollisions(
  imports: string[],
  circuits: ParsedContract["circuits"],
  code: string,
  issues: PotentialIssue[],
): void {
  const hasStdlibImport =
    imports.includes("CompactStandardLibrary") || code.includes("import CompactStandardLibrary");

  if (hasStdlibImport) {
    for (const circuit of circuits) {
      if (stdlibExports.includes(circuit.name)) {
        issues.push({
          type: "stdlib_name_collision",
          line: circuit.line,
          message: `Circuit '${circuit.name}' conflicts with CompactStandardLibrary.${circuit.name}()`,
          suggestion: `Rename to avoid ambiguity, or remove to use the standard library version`,
          severity: "error",
        });
      }
    }
  }
}

/** 3. Detect sealed + export conflicts */
function checkSealedExportConflicts(
  code: string,
  lineByIndex: number[],
  circuits: ParsedContract["circuits"],
  issues: PotentialIssue[],
): void {
  const sealedFields: Array<{ name: string; line: number }> = [];
  const sealedPattern = /sealed\s+ledger\s+(\w+)\s*:/g;
  let match;
  while ((match = sealedPattern.exec(code)) !== null) {
    const lineNum = lineByIndex[match.index] ?? 1;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    sealedFields.push({ name: match[1]!, line: lineNum });
  }

  if (sealedFields.length > 0) {
    for (const circuit of circuits) {
      if (circuit.isExport) {
        const escapedCircuitName = escapeRegex(circuit.name);
        const circuitBodyMatch = code.match(
          new RegExp(
            `(?:export\\s+)?circuit\\s+${escapedCircuitName}\\s*\\([^)]*\\)\\s*:[^{]*\\{([\\s\\S]*?)\\n\\}`,
            "m",
          ),
        );
        if (circuitBodyMatch) {
          const body = circuitBodyMatch[1] ?? "";
          for (const field of sealedFields) {
            const escapedFieldName = escapeRegex(field.name);
            if (
              new RegExp(`\\b${escapedFieldName}\\s*=`).test(body) ||
              new RegExp(`\\b${escapedFieldName}\\s*\\.\\s*\\w+\\s*\\(`).test(body)
            ) {
              issues.push({
                type: "sealed_export_conflict",
                line: circuit.line,
                message: `Exported circuit '${circuit.name}' modifies sealed field '${field.name}'`,
                suggestion: `Move sealed field initialization to a 'constructor { }' block instead`,
                severity: "error",
              });
            }
          }
        }
      }
    }
  }
}

/** 4. Detect missing constructor when sealed fields exist */
function checkMissingConstructor(
  code: string,
  circuits: ParsedContract["circuits"],
  issues: PotentialIssue[],
): void {
  const sealedPattern = /sealed\s+ledger\s+\w+\s*:/g;
  if (!sealedPattern.test(code)) return;

  const hasConstructor = /constructor\s*\{/.test(code);
  if (!hasConstructor) {
    const initCircuit = circuits.find(
      (c) => c.name.toLowerCase().includes("init") || c.name.toLowerCase() === "setup",
    );
    if (initCircuit && initCircuit.isExport) {
      issues.push({
        type: "missing_constructor",
        line: initCircuit.line,
        message: `Contract has sealed fields but uses '${initCircuit.name}' instead of constructor`,
        suggestion: `Sealed fields must be initialized in 'constructor { }', not in exported circuits`,
        severity: "warning",
      });
    }
  }
}

/** 5. Detect potential type mismatches with stdlib functions */
function checkStdlibTypeMismatches(
  imports: string[],
  code: string,
  lineByIndex: number[],
  issues: PotentialIssue[],
): void {
  const hasStdlibImport =
    imports.includes("CompactStandardLibrary") || code.includes("import CompactStandardLibrary");
  if (!hasStdlibImport) return;

  const burnAddressUsages = code.matchAll(/burnAddress\s*\(\s*\)/g);
  for (const usage of burnAddressUsages) {
    const usageIdx = usage.index;
    const afterUsage = code.substring(usageIdx + usage[0].length, usageIdx + usage[0].length + 50);
    const beforeUsage = code.substring(Math.max(0, usageIdx - 100), usageIdx);

    if (
      !afterUsage.startsWith(".left") &&
      !afterUsage.startsWith(".right") &&
      !afterUsage.startsWith(".is_left")
    ) {
      if (/\(\s*$/.test(beforeUsage) || /,\s*$/.test(beforeUsage)) {
        const lineNum = lineByIndex[usageIdx] ?? 1;
        issues.push({
          type: "stdlib_type_mismatch",
          line: lineNum,
          message: `burnAddress() returns Either<ZswapCoinPublicKey, ContractAddress>, not ZswapCoinPublicKey`,
          suggestion: `Use burnAddress().left for ZswapCoinPublicKey, or define 'pure circuit zeroKey(): ZswapCoinPublicKey { return default<ZswapCoinPublicKey>; }'`,
          severity: "warning",
        });
        break;
      }
    }
  }
}

/** 6. Detect division operator usage */
function checkDivisionOperator(
  code: string,
  lineByIndex: number[],
  issues: PotentialIssue[],
): void {
  const divisionPattern = /[^/]\/[^/*]/g;
  let match;
  while ((match = divisionPattern.exec(code)) !== null) {
    const beforeDiv = code.substring(0, match.index);
    const lastLineStart = beforeDiv.lastIndexOf("\n") + 1;
    const lineContent = beforeDiv.substring(lastLineStart);
    if (lineContent.includes("//")) continue;

    const lineNum = lineByIndex[match.index] ?? 1;
    issues.push({
      type: "unsupported_division",
      line: lineNum,
      message: `Division operator '/' is not in the documented Compact operators (+, -, *)`,
      suggestion: `If you need division, compute it off-chain in a witness and verify on-chain: 'witness divide(a, b): [quotient, remainder]'`,
      severity: "warning",
    });
    break;
  }
}

/** 7. Detect Counter.value() - suggest using .read() instead */
function checkCounterValueAccess(
  code: string,
  lineByIndex: number[],
  ledgerItems: ParsedContract["ledgerItems"],
  issues: PotentialIssue[],
): void {
  const counterValuePattern = /(\w+)\.value\s*\(/g;
  let match;
  while ((match = counterValuePattern.exec(code)) !== null) {
    const varName = match[1] ?? "";
    const counterLedger = ledgerItems.find((l) => l.name === varName && l.type === "Counter");
    if (counterLedger) {
      const lineNum = lineByIndex[match.index] ?? 1;
      issues.push({
        type: "invalid_counter_access",
        line: lineNum,
        message: `Counter type '${varName}' does not have '.value()' - use '.read()' instead`,
        suggestion: `Counter ADT methods: increment(n), decrement(n), read(), lessThan(n), resetToDefault()`,
        severity: "error",
      });
    }
  }
}

/** 8. Detect potential Uint overflow in multiplication */
function checkPotentialOverflow(
  code: string,
  lineByIndex: number[],
  issues: PotentialIssue[],
): void {
  const multiplyPattern = /(\w+)\s*\*\s*(\w+)(?:\s*\+\s*\w+)?\s*(?:as\s+Uint|==)/g;
  let match;
  while ((match = multiplyPattern.exec(code)) !== null) {
    const beforeMult = code.substring(Math.max(0, match.index - 200), match.index);
    const afterMult = code.substring(match.index, match.index + match[0].length + 50);

    if (afterMult.includes("as Field") || beforeMult.includes("as Field")) continue;

    if (/assert|==/.test(afterMult)) {
      const lineNum = lineByIndex[match.index] ?? 1;
      issues.push({
        type: "potential_overflow",
        line: lineNum,
        message: `Multiplication '${match[1] ?? ""} * ${match[2] ?? ""}' may overflow Uint bounds`,
        suggestion: `Cast operands to Field for safe arithmetic: '(${match[1] ?? ""} as Field) * (${match[2] ?? ""} as Field)'`,
        severity: "warning",
      });
      break;
    }
  }
}

/** 9. Detect witness/private values used in conditionals without disclose() */
function checkUndisclosedWitnessConditionals(
  code: string,
  lineByIndex: number[],
  witnesses: ParsedContract["witnesses"],
  issues: PotentialIssue[],
): void {
  const witnessNames = witnesses.map((w) => w.name);
  const ifPattern = /if\s*\(([^)]+)\)/g;
  let match;
  while ((match = ifPattern.exec(code)) !== null) {
    const condition = match[1] ?? "";
    for (const witnessName of witnessNames) {
      if (
        condition.includes(witnessName) &&
        !condition.includes(`disclose(${witnessName}`) &&
        !condition.includes("disclose(")
      ) {
        const lineNum = lineByIndex[match.index] ?? 1;
        issues.push({
          type: "undisclosed_witness_conditional",
          line: lineNum,
          message: `Witness value '${witnessName}' used in conditional without disclose()`,
          suggestion: `Wrap witness comparisons in disclose(): 'if (disclose(${witnessName} == expected))'`,
          severity: "warning",
        });
        break;
      }
    }
  }
}

/** 10. Detect constructor parameters assigned to ledger without disclose() */
function checkUndisclosedConstructorParams(
  code: string,
  ledgerItems: ParsedContract["ledgerItems"],
  issues: PotentialIssue[],
): void {
  const constructorMatch = code.match(
    /constructor\s*\(([^)]*)\)\s*\{([\s\S]*?)(?=\n\s*(?:export|circuit|witness|ledger|constructor|\}|$))/,
  );
  if (!constructorMatch) return;

  const paramsStr = constructorMatch[1] ?? "";
  const constructorBody = constructorMatch[2] ?? "";

  const paramPattern = /(\w+)\s*:\s*[^,)]+/g;
  const constructorParams: string[] = [];
  let paramMatch;
  while ((paramMatch = paramPattern.exec(paramsStr)) !== null) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    constructorParams.push(paramMatch[1]!);
  }

  for (const param of constructorParams) {
    const escapedParam = escapeRegex(param);
    const assignmentPattern = new RegExp(
      `(\\w+)\\s*=\\s*(?!disclose\\s*\\()${escapedParam}\\b`,
      "g",
    );
    let assignMatch;
    while ((assignMatch = assignmentPattern.exec(constructorBody)) !== null) {
      const fieldName = assignMatch[1] ?? "";
      const isLedgerField = ledgerItems.some((l) => l.name === fieldName);
      if (isLedgerField) {
        const beforeAssign = code.substring(
          0,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          constructorMatch.index! + constructorMatch[0].indexOf(assignMatch[0]),
        );
        const lineNum = (beforeAssign.match(/\n/g) || []).length + 1;
        issues.push({
          type: "undisclosed_constructor_param",
          line: lineNum,
          message: `Constructor parameter '${param}' assigned to ledger field '${fieldName}' without disclose()`,
          suggestion: `Wrap in disclose(): '${fieldName} = disclose(${param});'`,
          severity: "error",
        });
      }
    }
  }
}

/** 11. Detect "if" expression used in assignment context */
function checkIfExpressionAssignment(
  code: string,
  lineByIndex: number[],
  issues: PotentialIssue[],
): void {
  const ifAssignmentPattern = /(?:const|let)\s+\w+\s*=\s*if\s*\(/g;
  let match;
  while ((match = ifAssignmentPattern.exec(code)) !== null) {
    const lineNum = lineByIndex[match.index] || 1;
    issues.push({
      type: "invalid_if_expression",
      line: lineNum,
      message: `'if' cannot be used as an expression in assignments`,
      suggestion: `Use ternary operator instead: 'const x = condition ? valueIfTrue : valueIfFalse;'`,
      severity: "error",
    });
  }
}
