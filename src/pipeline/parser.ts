import { logger } from "../utils/index.js";

// ============================================================================
// Language Constants
// ============================================================================

/**
 * Supported file languages
 */
export const LANGUAGES = {
  COMPACT: "compact",
  TYPESCRIPT: "typescript",
  MARKDOWN: "markdown",
} as const;

export type Language = (typeof LANGUAGES)[keyof typeof LANGUAGES];

/**
 * File extensions mapped to languages
 */
export const EXTENSION_LANGUAGE_MAP: Record<string, Language> = {
  compact: LANGUAGES.COMPACT,
  ts: LANGUAGES.TYPESCRIPT,
  tsx: LANGUAGES.TYPESCRIPT,
  js: LANGUAGES.TYPESCRIPT,
  jsx: LANGUAGES.TYPESCRIPT,
  md: LANGUAGES.MARKDOWN,
  mdx: LANGUAGES.MARKDOWN,
} as const;

// ============================================================================
// Type Definitions
// ============================================================================

export interface CodeUnit {
  type:
    | "ledger"
    | "circuit"
    | "witness"
    | "function"
    | "type"
    | "import"
    | "export"
    | "class"
    | "interface";
  name: string;
  code: string;
  startLine: number;
  endLine: number;
  isPublic: boolean;
  isPrivate: boolean;
  documentation?: string;
  parameters?: Array<{ name: string; type: string }>;
  returnType?: string;
}

export interface ParsedFile {
  path: string;
  language: Language;
  content: string;
  codeUnits: CodeUnit[];
  imports: string[];
  exports: string[];
  metadata: {
    hasLedger: boolean;
    hasCircuits: boolean;
    hasWitnesses: boolean;
    lineCount: number;
  };
}

// ============================================================================
// Parser Functions
// ============================================================================

/**
 * Parse Compact smart contract files
 */
export function parseCompactFile(path: string, content: string): ParsedFile {
  const lines = content.split("\n");
  const codeUnits: CodeUnit[] = [];
  const imports: string[] = [];
  const exports: string[] = [];

  let hasLedger = false;
  let hasCircuits = false;
  let hasWitnesses = false;

  // Extract imports
  const importRegex = /^include\s+["']([^"']+)["'];?/gm;
  let importMatch;
  while ((importMatch = importRegex.exec(content)) !== null) {
    imports.push(importMatch[1]);
  }

  // Parse ledger block
  const ledgerRegex = /ledger\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/gs;
  let ledgerMatch;
  while ((ledgerMatch = ledgerRegex.exec(content)) !== null) {
    hasLedger = true;
    const ledgerContent = ledgerMatch[1];
    const startLine = content
      .substring(0, ledgerMatch.index)
      .split("\n").length;
    const endLine = startLine + ledgerMatch[0].split("\n").length - 1;

    codeUnits.push({
      type: "ledger",
      name: "ledger",
      code: ledgerMatch[0],
      startLine,
      endLine,
      isPublic: true,
      isPrivate: false,
    });

    // Parse individual ledger fields
    const fieldRegex = /(@private\s+)?(\w+)\s*:\s*([^;]+);/g;
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(ledgerContent)) !== null) {
      const isPrivate = !!fieldMatch[1];
      codeUnits.push({
        type: "ledger",
        name: fieldMatch[2],
        code: fieldMatch[0].trim(),
        startLine: startLine,
        endLine: startLine,
        isPublic: !isPrivate,
        isPrivate,
        returnType: fieldMatch[3].trim(),
      });
    }
  }

  // Parse circuit definitions
  const circuitRegex =
    /(export\s+)?circuit\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*(\w+))?\s*\{/g;
  let circuitMatch;
  while ((circuitMatch = circuitRegex.exec(content)) !== null) {
    hasCircuits = true;
    const isExport = !!circuitMatch[1];
    const name = circuitMatch[2];
    const params = circuitMatch[3];
    const returnType = circuitMatch[4] || "Void";

    // Find the matching closing brace
    const startIndex = circuitMatch.index;
    let braceCount = 1;
    let endIndex = content.indexOf("{", startIndex) + 1;
    while (braceCount > 0 && endIndex < content.length) {
      if (content[endIndex] === "{") braceCount++;
      if (content[endIndex] === "}") braceCount--;
      endIndex++;
    }

    const circuitCode = content.substring(startIndex, endIndex);
    const startLine = content.substring(0, startIndex).split("\n").length;
    const endLine = startLine + circuitCode.split("\n").length - 1;

    // Parse parameters
    const parameters = params
      .split(",")
      .filter((p) => p.trim())
      .map((p) => {
        const parts = p.trim().split(":");
        return {
          name: parts[0]?.trim() || "",
          type: parts[1]?.trim() || "unknown",
        };
      });

    if (isExport) {
      exports.push(name);
    }

    codeUnits.push({
      type: "circuit",
      name,
      code: circuitCode,
      startLine,
      endLine,
      isPublic: isExport,
      isPrivate: false,
      parameters,
      returnType,
    });
  }

  // Parse witness functions
  const witnessRegex = /witness\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*([^{]+))?\s*\{/g;
  let witnessMatch;
  while ((witnessMatch = witnessRegex.exec(content)) !== null) {
    hasWitnesses = true;
    const name = witnessMatch[1];
    const params = witnessMatch[2];
    const returnType = witnessMatch[3]?.trim() || "unknown";

    // Find the matching closing brace
    const startIndex = witnessMatch.index;
    let braceCount = 1;
    let endIndex = content.indexOf("{", startIndex) + 1;
    while (braceCount > 0 && endIndex < content.length) {
      if (content[endIndex] === "{") braceCount++;
      if (content[endIndex] === "}") braceCount--;
      endIndex++;
    }

    const witnessCode = content.substring(startIndex, endIndex);
    const startLine = content.substring(0, startIndex).split("\n").length;
    const endLine = startLine + witnessCode.split("\n").length - 1;

    // Parse parameters
    const parameters = params
      .split(",")
      .filter((p) => p.trim())
      .map((p) => {
        const parts = p.trim().split(":");
        return {
          name: parts[0]?.trim() || "",
          type: parts[1]?.trim() || "unknown",
        };
      });

    codeUnits.push({
      type: "witness",
      name,
      code: witnessCode,
      startLine,
      endLine,
      isPublic: false,
      isPrivate: true,
      parameters,
      returnType,
    });
  }

  // Parse type definitions
  const typeRegex = /(export\s+)?type\s+(\w+)\s*=\s*([^;]+);/g;
  let typeMatch;
  while ((typeMatch = typeRegex.exec(content)) !== null) {
    const isExport = !!typeMatch[1];
    const name = typeMatch[2];
    const startLine = content.substring(0, typeMatch.index).split("\n").length;

    if (isExport) {
      exports.push(name);
    }

    codeUnits.push({
      type: "type",
      name,
      code: typeMatch[0],
      startLine,
      endLine: startLine,
      isPublic: isExport,
      isPrivate: false,
      returnType: typeMatch[3].trim(),
    });
  }

  return {
    path,
    language: LANGUAGES.COMPACT,
    content,
    codeUnits,
    imports,
    exports,
    metadata: {
      hasLedger,
      hasCircuits,
      hasWitnesses,
      lineCount: lines.length,
    },
  };
}

/**
 * Parse TypeScript files
 */
export function parseTypeScriptFile(path: string, content: string): ParsedFile {
  const lines = content.split("\n");
  const codeUnits: CodeUnit[] = [];
  const imports: string[] = [];
  const exports: string[] = [];

  // Extract imports
  const importRegex =
    /import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+["']([^"']+)["']/g;
  let importMatch;
  while ((importMatch = importRegex.exec(content)) !== null) {
    imports.push(importMatch[1]);
  }

  // Parse function declarations
  const functionRegex =
    /(export\s+)?(async\s+)?function\s+(\w+)\s*(?:<[^>]+>)?\s*\(([^)]*)\)\s*(?::\s*([^{]+))?\s*\{/g;
  let funcMatch;
  while ((funcMatch = functionRegex.exec(content)) !== null) {
    const isExport = !!funcMatch[1];
    const isAsync = !!funcMatch[2];
    const name = funcMatch[3];
    const params = funcMatch[4];
    const returnType =
      funcMatch[5]?.trim() || (isAsync ? "Promise<void>" : "void");

    // Find the matching closing brace
    const startIndex = funcMatch.index;
    let braceCount = 1;
    let endIndex = content.indexOf("{", startIndex) + 1;
    while (braceCount > 0 && endIndex < content.length) {
      if (content[endIndex] === "{") braceCount++;
      if (content[endIndex] === "}") braceCount--;
      endIndex++;
    }

    const funcCode = content.substring(startIndex, endIndex);
    const startLine = content.substring(0, startIndex).split("\n").length;
    const endLine = startLine + funcCode.split("\n").length - 1;

    // Parse parameters
    const parameters = params
      .split(",")
      .filter((p) => p.trim())
      .map((p) => {
        const parts = p.trim().split(":");
        return {
          name: parts[0]?.trim().replace(/\?$/, "") || "",
          type: parts[1]?.trim() || "any",
        };
      });

    if (isExport) {
      exports.push(name);
    }

    codeUnits.push({
      type: "function",
      name,
      code: funcCode,
      startLine,
      endLine,
      isPublic: isExport,
      isPrivate: false,
      parameters,
      returnType,
    });
  }

  // Parse class declarations
  const classRegex =
    /(export\s+)?(abstract\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[^{]+)?\s*\{/g;
  let classMatch;
  while ((classMatch = classRegex.exec(content)) !== null) {
    const isExport = !!classMatch[1];
    const isAbstract = !!classMatch[2];
    const name = classMatch[3];

    // Find the matching closing brace
    const startIndex = classMatch.index;
    let braceCount = 1;
    let endIndex = content.indexOf("{", startIndex) + 1;
    while (braceCount > 0 && endIndex < content.length) {
      if (content[endIndex] === "{") braceCount++;
      if (content[endIndex] === "}") braceCount--;
      endIndex++;
    }

    const classCode = content.substring(startIndex, endIndex);
    const startLine = content.substring(0, startIndex).split("\n").length;
    const endLine = startLine + classCode.split("\n").length - 1;

    if (isExport) {
      exports.push(name);
    }

    codeUnits.push({
      type: "class",
      name,
      code: classCode,
      startLine,
      endLine,
      isPublic: isExport,
      isPrivate: false,
      documentation: isAbstract ? "abstract class" : undefined,
    });
  }

  // Parse interface declarations
  const interfaceRegex =
    /(export\s+)?interface\s+(\w+)(?:\s+extends\s+[^{]+)?\s*\{/g;
  let ifaceMatch;
  while ((ifaceMatch = interfaceRegex.exec(content)) !== null) {
    const isExport = !!ifaceMatch[1];
    const name = ifaceMatch[2];

    // Find the matching closing brace
    const startIndex = ifaceMatch.index;
    let braceCount = 1;
    let endIndex = content.indexOf("{", startIndex) + 1;
    while (braceCount > 0 && endIndex < content.length) {
      if (content[endIndex] === "{") braceCount++;
      if (content[endIndex] === "}") braceCount--;
      endIndex++;
    }

    const ifaceCode = content.substring(startIndex, endIndex);
    const startLine = content.substring(0, startIndex).split("\n").length;
    const endLine = startLine + ifaceCode.split("\n").length - 1;

    if (isExport) {
      exports.push(name);
    }

    codeUnits.push({
      type: "interface",
      name,
      code: ifaceCode,
      startLine,
      endLine,
      isPublic: isExport,
      isPrivate: false,
    });
  }

  // Parse type definitions
  const typeRegex = /(export\s+)?type\s+(\w+)(?:<[^>]+>)?\s*=\s*([^;]+);/g;
  let typeMatch;
  while ((typeMatch = typeRegex.exec(content)) !== null) {
    const isExport = !!typeMatch[1];
    const name = typeMatch[2];
    const startLine = content.substring(0, typeMatch.index).split("\n").length;

    if (isExport) {
      exports.push(name);
    }

    codeUnits.push({
      type: "type",
      name,
      code: typeMatch[0],
      startLine,
      endLine: startLine,
      isPublic: isExport,
      isPrivate: false,
      returnType: typeMatch[3].trim(),
    });
  }

  return {
    path,
    language: LANGUAGES.TYPESCRIPT,
    content,
    codeUnits,
    imports,
    exports,
    metadata: {
      hasLedger: false,
      hasCircuits: false,
      hasWitnesses: false,
      lineCount: lines.length,
    },
  };
}

/**
 * Parse Markdown documentation files
 */
export function parseMarkdownFile(path: string, content: string): ParsedFile {
  const lines = content.split("\n");
  const codeUnits: CodeUnit[] = [];

  // Parse headings as sections
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  let headingMatch;
  const headings: Array<{ level: number; title: string; index: number }> = [];

  while ((headingMatch = headingRegex.exec(content)) !== null) {
    headings.push({
      level: headingMatch[1].length,
      title: headingMatch[2],
      index: headingMatch.index,
    });
  }

  // Create sections between headings
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    const nextHeading = headings[i + 1];
    const startIndex = heading.index;
    const endIndex = nextHeading ? nextHeading.index : content.length;
    const sectionContent = content.substring(startIndex, endIndex).trim();

    const startLine = content.substring(0, startIndex).split("\n").length;
    const endLine = startLine + sectionContent.split("\n").length - 1;

    codeUnits.push({
      type: "function", // Using function type for documentation sections
      name: heading.title.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase(),
      code: sectionContent,
      startLine,
      endLine,
      isPublic: true,
      isPrivate: false,
      documentation: heading.title,
    });
  }

  return {
    path,
    language: LANGUAGES.MARKDOWN,
    content,
    codeUnits,
    imports: [],
    exports: [],
    metadata: {
      hasLedger: false,
      hasCircuits: false,
      hasWitnesses: false,
      lineCount: lines.length,
    },
  };
}

/**
 * Parse a file based on its extension
 */
export function parseFile(path: string, content: string): ParsedFile {
  const extension = path.split(".").pop()?.toLowerCase() || "";
  const language = EXTENSION_LANGUAGE_MAP[extension];

  switch (language) {
    case LANGUAGES.COMPACT:
      return parseCompactFile(path, content);
    case LANGUAGES.TYPESCRIPT:
      return parseTypeScriptFile(path, content);
    case LANGUAGES.MARKDOWN:
      return parseMarkdownFile(path, content);
    default:
      logger.warn(`Unknown file extension: ${extension} for ${path}`);
      return {
        path,
        language: LANGUAGES.TYPESCRIPT,
        content,
        codeUnits: [],
        imports: [],
        exports: [],
        metadata: {
          hasLedger: false,
          hasCircuits: false,
          hasWitnesses: false,
          lineCount: content.split("\n").length,
        },
      };
  }
}
