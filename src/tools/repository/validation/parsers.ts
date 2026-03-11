/**
 * Contract parsing logic.
 * Extracts pragma, imports, circuits, witnesses, ledger items,
 * types, structs, and enums from Compact contract source code.
 */

// ============================================================================
// Types
// ============================================================================

export interface CircuitInfo {
  name: string;
  params: string[];
  returnType: string;
  isExport: boolean;
  line: number;
}

export interface WitnessInfo {
  name: string;
  type: string;
  isExport: boolean;
  line: number;
}

export interface LedgerItemInfo {
  name: string;
  type: string;
  isExport: boolean;
  line: number;
}

export interface TypeInfo {
  name: string;
  definition: string;
  line: number;
}

export interface StructInfo {
  name: string;
  fields: string[];
  line: number;
}

export interface EnumInfo {
  name: string;
  variants: string[];
  line: number;
}

export interface ParsedContract {
  languageVersion: string | null;
  imports: string[];
  circuits: CircuitInfo[];
  witnesses: WitnessInfo[];
  ledgerItems: LedgerItemInfo[];
  types: TypeInfo[];
  structs: StructInfo[];
  enums: EnumInfo[];
  lines: string[];
  lineByIndex: number[];
  code: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build a mapping from character index to 1-based line number.
 * Avoids repeatedly scanning from the start of the string for each match.
 */
export function buildLineByIndex(code: string): number[] {
  const lineByIndex: number[] = new Array<number>(code.length).fill(0);
  let currentLine = 1;
  for (let i = 0; i < code.length; i++) {
    lineByIndex[i] = currentLine;
    if (code[i] === "\n") {
      currentLine++;
    }
  }
  return lineByIndex;
}

/**
 * Split parameters handling nested angle brackets, square brackets, parentheses,
 * and string literals (e.g., Map<A, B>, [Field, Boolean], (x: Field) => Boolean, Opaque<"a, b">)
 */
export function splitParams(paramsStr: string): string[] {
  const result: string[] = [];
  let current = "";
  let angleDepth = 0;
  let squareDepth = 0;
  let parenDepth = 0;
  let inString = false;
  let stringChar = "";

  for (let i = 0; i < paramsStr.length; i++) {
    const ch = paramsStr[i] ?? "";

    // Handle string literals
    if ((ch === '"' || ch === "'") && (i === 0 || paramsStr[i - 1] !== "\\")) {
      if (!inString) {
        inString = true;
        stringChar = ch;
      } else if (ch === stringChar) {
        inString = false;
        stringChar = "";
      }
    }

    // Only track depth when not inside a string
    if (!inString) {
      if (ch === "<") angleDepth++;
      else if (ch === ">") angleDepth = Math.max(0, angleDepth - 1);
      else if (ch === "[") squareDepth++;
      else if (ch === "]") squareDepth = Math.max(0, squareDepth - 1);
      else if (ch === "(") parenDepth++;
      else if (ch === ")") parenDepth = Math.max(0, parenDepth - 1);
    }

    if (ch === "," && !inString && angleDepth === 0 && squareDepth === 0 && parenDepth === 0) {
      if (current.trim()) result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

/**
 * Extract the contents of a balanced brace block starting at `startIndex`,
 * handling nested braces and skipping over comments and string literals.
 */
export function extractBalancedBlock(
  source: string,
  startIndex: number,
): { body: string; endIndex: number } | null {
  const length = source.length;
  let i = startIndex;

  if (source[i] !== "{") {
    return null;
  }

  let depth = 1;
  i++;
  const bodyStart = i;

  while (i < length && depth > 0) {
    const ch = source[i];
    const next = i + 1 < length ? source[i + 1] : "";

    // Handle string literals and template literals
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i++;
      while (i < length) {
        const c = source[i];
        if (c === "\\" && i + 1 < length) {
          // Skip escaped character
          i += 2;
          continue;
        }
        if (c === quote) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    // Handle line comments
    if (ch === "/" && next === "/") {
      i += 2;
      while (i < length && source[i] !== "\n") {
        i++;
      }
      continue;
    }

    // Handle block comments
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < length && !(source[i] === "*" && i + 1 < length && source[i + 1] === "/")) {
        i++;
      }
      if (i < length) {
        i += 2; // Skip closing */
      }
      continue;
    }

    if (ch === "{") {
      depth++;
      i++;
      continue;
    }

    if (ch === "}") {
      depth--;
      i++;
      if (depth === 0) {
        const body = source.slice(bodyStart, i - 1);
        return { body, endIndex: i - 1 };
      }
      continue;
    }

    i++;
  }

  return null;
}

// ============================================================================
// Main Parser
// ============================================================================

/**
 * Parse a Compact contract and extract all structural information.
 */
export function parseContract(code: string): ParsedContract {
  const lineByIndex = buildLineByIndex(code);
  const lines = code.split("\n");

  // Extract pragma version
  const pragmaMatch = code.match(/pragma\s+language_version\s*(?:>=?|<=?|==|~)\s*([\d.]+)/);
  const languageVersion = pragmaMatch?.[1] ?? null;

  // Extract imports
  const imports: string[] = [];
  const importMatches = code.matchAll(/import\s+(\w+)|include\s+"([^"]+)"/g);
  for (const match of importMatches) {
    const importName = match[1] ?? match[2] ?? "";
    imports.push(importName);
  }

  // Extract circuits
  const circuits: CircuitInfo[] = [];
  const circuitStartPattern = /(?:(export)\s+)?circuit\s+(\w+)\s*\(/g;

  let circuitMatch;
  while ((circuitMatch = circuitStartPattern.exec(code)) !== null) {
    const lineNum = lineByIndex[circuitMatch.index] ?? 0;
    const isExport = circuitMatch[1] === "export";
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const name = circuitMatch[2]!;

    // Manually extract params by finding matching closing parenthesis
    const startIdx = circuitMatch.index + circuitMatch[0].length;
    let depth = 1;
    let endIdx = startIdx;
    while (endIdx < code.length && depth > 0) {
      if (code[endIdx] === "(") depth++;
      else if (code[endIdx] === ")") depth--;
      endIdx++;
    }
    const paramsStr = code.substring(startIdx, endIdx - 1);
    const params = splitParams(paramsStr);

    // Extract return type after ): until { or newline or ;
    const afterParams = code.substring(endIdx);
    const returnTypeMatch = afterParams.match(/^\s*:\s*([^{\n;]+)/);
    const returnType = returnTypeMatch?.[1]?.trim() ?? "[]";

    circuits.push({ name, params, returnType, isExport, line: lineNum });
  }

  // Extract witnesses
  const witnesses: WitnessInfo[] = [];
  const witnessPattern = /(?:(export)\s+)?witness\s+(\w+)\s*:\s*([^;]+)/g;

  let witnessMatch;
  while ((witnessMatch = witnessPattern.exec(code)) !== null) {
    const lineNum = lineByIndex[witnessMatch.index] ?? 0;
    witnesses.push({
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      name: witnessMatch[2]!,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      type: witnessMatch[3]!.trim(),
      isExport: witnessMatch[1] === "export",
      line: lineNum,
    });
  }

  // Extract ledger items
  const ledgerItems: LedgerItemInfo[] = [];
  const ledgerPattern = /(?:(export)\s+)?ledger\s+(\w+)\s*:\s*([^;]+)/g;

  let ledgerMatch;
  while ((ledgerMatch = ledgerPattern.exec(code)) !== null) {
    const lineNum = lineByIndex[ledgerMatch.index] ?? 0;
    ledgerItems.push({
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      name: ledgerMatch[2]!,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      type: ledgerMatch[3]!.trim(),
      isExport: ledgerMatch[1] === "export",
      line: lineNum,
    });
  }

  // Extract type definitions
  const types: TypeInfo[] = [];
  const typePattern = /type\s+(\w+)\s*=\s*([^;]+)/g;

  let typeMatch;
  while ((typeMatch = typePattern.exec(code)) !== null) {
    const lineNum = lineByIndex[typeMatch.index] ?? 0;
    types.push({
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      name: typeMatch[1]!,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      definition: typeMatch[2]!.trim(),
      line: lineNum,
    });
  }

  // Extract struct definitions
  const structs: StructInfo[] = [];
  const structPattern = /struct\s+(\w+)\s*\{/g;

  let structMatch;
  while ((structMatch = structPattern.exec(code)) !== null) {
    const lineNum = lineByIndex[structMatch.index] ?? 0;
    const openingBraceIndex = code.indexOf("{", structMatch.index);
    if (openingBraceIndex === -1) {
      continue;
    }

    const block = extractBalancedBlock(code, openingBraceIndex);
    if (!block) {
      continue;
    }

    const fields = block.body
      .split(",")
      .map((f) => f.trim())
      .filter((f) => f);
    structs.push({
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      name: structMatch[1]!,
      fields,
      line: lineNum,
    });
  }

  // Extract enum definitions
  const enums: EnumInfo[] = [];
  const enumStartPattern = /enum\s+(\w+)\s*\{/g;

  let enumMatch;
  while ((enumMatch = enumStartPattern.exec(code)) !== null) {
    const lineNum = lineByIndex[enumMatch.index] ?? 0;
    const openingBraceIndex = code.indexOf("{", enumMatch.index);
    if (openingBraceIndex === -1) {
      continue;
    }

    const block = extractBalancedBlock(code, openingBraceIndex);
    if (!block) {
      continue;
    }

    const variants = block.body
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v);
    enums.push({
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      name: enumMatch[1]!,
      variants,
      line: lineNum,
    });
  }

  return {
    languageVersion,
    imports,
    circuits,
    witnesses,
    ledgerItems,
    types,
    structs,
    enums,
    lines,
    lineByIndex,
    code,
  };
}
