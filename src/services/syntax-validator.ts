/**
 * Hybrid Syntax Validator Service
 *
 * This service validates and enriches static syntax information by searching
 * the indexed Midnight documentation. The indexed docs are the source of truth
 * for correctness - static references are just a cache/fallback.
 *
 * Key principle: ALWAYS search indexed docs to validate and enrich responses.
 * Static data exists for speed, but indexed data ensures correctness.
 */

import {
  searchDocsHosted,
  searchCompactHosted,
  HostedSearchResponse,
} from "../utils/hosted-api.js";
import { logger } from "../utils/index.js";

// ============================================================================
// Types
// ============================================================================

export interface ADTOperation {
  method: string;
  signature?: string;
  description: string;
  worksInCircuits: boolean;
  source?: string; // Where this info came from (indexed docs or static)
}

export interface ADTInfo {
  name: string;
  operations: ADTOperation[];
  notes?: string[];
  sourceDocPath?: string;
  lastVerified?: string;
}

export interface SyntaxValidationResult {
  validated: boolean;
  staticData: unknown;
  indexedData?: unknown;
  discrepancies?: string[];
  enrichments?: string[];
  searchResults?: HostedSearchResponse;
}

// ============================================================================
// ADT Validation - Search indexed docs for ADT operations
// ============================================================================

/**
 * Search indexed documentation for ADT (Abstract Data Type) information
 * This queries the actual indexed midnight-docs for current/correct info
 */
export async function searchADTInfo(adtName: string): Promise<ADTInfo | null> {
  try {
    // Search docs for the ADT reference
    const docsResult = await searchDocsHosted(
      `${adtName} ADT operations methods ledger`,
      10,
      "reference"
    );

    if (!docsResult.results || docsResult.results.length === 0) {
      logger.debug(`No indexed docs found for ADT: ${adtName}`);
      return null;
    }

    // Parse operations from search results
    const operations: ADTOperation[] = [];
    const notes: string[] = [];
    let sourceDocPath: string | undefined;

    for (const result of docsResult.results) {
      const content = result.content || result.code || "";

      // Track source document
      if (!sourceDocPath && result.source.filePath.includes("ledger-adt")) {
        sourceDocPath = result.source.filePath;
      }

      // Extract method signatures from content
      // Look for patterns like: | `method` | `signature` | description |
      const methodPattern =
        /\|\s*`?(\w+)`?\s*\|\s*`?\(([^)]*)\)\s*(?::\s*([^|`]+))?`?\s*\|\s*([^|]+)\|/g;
      let match;
      while ((match = methodPattern.exec(content)) !== null) {
        const [, methodName, params, returnType, description] = match;
        if (methodName && !operations.some((op) => op.method === methodName)) {
          operations.push({
            method: methodName,
            signature: `(${params})${returnType ? `: ${returnType.trim()}` : ""}`,
            description: description?.trim() || "",
            worksInCircuits: true, // Documented methods work in circuits
            source: "indexed-docs",
          });
        }
      }

      // Also look for inline method mentions
      const inlinePattern =
        /(?:method|operation|function)\s+`?(\w+)`?\s*\(([^)]*)\)/gi;
      while ((match = inlinePattern.exec(content)) !== null) {
        const [, methodName, params] = match;
        if (methodName && !operations.some((op) => op.method === methodName)) {
          operations.push({
            method: methodName,
            signature: `(${params})`,
            description: "Extracted from documentation",
            worksInCircuits: true,
            source: "indexed-docs",
          });
        }
      }

      // Capture notes about the ADT
      if (
        content.toLowerCase().includes(adtName.toLowerCase()) &&
        content.length < 500
      ) {
        const cleanNote = content.replace(/\s+/g, " ").trim();
        if (cleanNote.length > 20 && cleanNote.length < 300) {
          notes.push(cleanNote);
        }
      }
    }

    if (operations.length === 0) {
      logger.debug(`Could not parse operations for ADT: ${adtName}`);
      return null;
    }

    return {
      name: adtName,
      operations,
      notes: notes.slice(0, 3), // Keep top 3 notes
      sourceDocPath,
      lastVerified: new Date().toISOString(),
    };
  } catch (error) {
    logger.warn(`Failed to search indexed docs for ADT ${adtName}:`, error);
    return null;
  }
}

// ============================================================================
// Compact Syntax Validation
// ============================================================================

/**
 * Search indexed docs for Compact language syntax patterns
 */
export async function searchCompactSyntax(
  topic: string
): Promise<HostedSearchResponse | null> {
  try {
    // Search both docs and code examples
    const [docsResult, codeResult] = await Promise.all([
      searchDocsHosted(`Compact ${topic} syntax`, 5, "reference"),
      searchCompactHosted(`${topic}`, 5),
    ]);

    // Merge results, preferring docs for correctness
    const mergedResults = [
      ...(docsResult.results || []),
      ...(codeResult.results || []),
    ];

    return {
      results: mergedResults.slice(0, 10),
      totalResults: mergedResults.length,
      query: topic,
      lastIndexed: docsResult.lastIndexed || codeResult.lastIndexed,
    };
  } catch (error) {
    logger.warn(`Failed to search Compact syntax for topic ${topic}:`, error);
    return null;
  }
}

// ============================================================================
// Hybrid Validation - Merge static + indexed data
// ============================================================================

/**
 * Validate static ADT info against indexed documentation
 * Returns enriched data with discrepancies noted
 */
export async function validateADTOperations(
  adtName: string,
  staticOperations: Array<{
    method: string;
    works: boolean;
    note: string;
  }>
): Promise<{
  validated: boolean;
  operations: ADTOperation[];
  discrepancies: string[];
  enrichments: string[];
}> {
  const discrepancies: string[] = [];
  const enrichments: string[] = [];

  // Search indexed docs for current info
  const indexedInfo = await searchADTInfo(adtName);

  if (!indexedInfo) {
    // Fallback to static data if search fails
    return {
      validated: false,
      operations: staticOperations.map((op) => ({
        method: op.method,
        description: op.note,
        worksInCircuits: op.works,
        source: "static-fallback",
      })),
      discrepancies: [
        "Could not validate against indexed docs - using static data",
      ],
      enrichments: [],
    };
  }

  // Build merged operation list
  const operations: ADTOperation[] = [];
  const indexedMethodNames = new Set(
    indexedInfo.operations.map((op) => op.method.toLowerCase())
  );
  const staticMethodNames = new Set(
    staticOperations.map((op) =>
      op.method.replace(/^\./, "").replace(/\(.*$/, "").toLowerCase()
    )
  );

  // Add indexed operations (source of truth)
  for (const indexedOp of indexedInfo.operations) {
    operations.push(indexedOp);

    // Check if static had different info
    const staticOp = staticOperations.find(
      (s) =>
        s.method.toLowerCase().includes(indexedOp.method.toLowerCase()) ||
        indexedOp.method
          .toLowerCase()
          .includes(
            s.method.replace(/^\./, "").replace(/\(.*$/, "").toLowerCase()
          )
    );

    if (staticOp && !staticOp.works && indexedOp.worksInCircuits) {
      discrepancies.push(
        `Static said ${staticOp.method} doesn't work, but indexed docs show it does`
      );
    }
  }

  // Check for static methods not in indexed docs
  for (const staticOp of staticOperations) {
    const methodName = staticOp.method
      .replace(/^\./, "")
      .replace(/\(.*$/, "")
      .toLowerCase();

    if (!indexedMethodNames.has(methodName)) {
      // Method in static but not indexed - might be wrong!
      discrepancies.push(
        `Static references ${staticOp.method} but not found in indexed docs - may not exist`
      );
    }
  }

  // Check for indexed methods not in static
  for (const indexedOp of indexedInfo.operations) {
    const methodName = indexedOp.method.toLowerCase();
    if (!staticMethodNames.has(methodName)) {
      enrichments.push(
        `Indexed docs show ${indexedOp.method} exists but was missing from static reference`
      );
    }
  }

  return {
    validated: true,
    operations,
    discrepancies,
    enrichments,
  };
}

// ============================================================================
// Full Syntax Reference Enrichment
// ============================================================================

/**
 * Key documentation URLs that should be searched for comprehensive info
 */
export const CRITICAL_DOC_TOPICS = [
  { topic: "Counter ADT", query: "Counter increment decrement read lessThan" },
  { topic: "Map ADT", query: "Map insert remove lookup member" },
  { topic: "Set ADT", query: "Set insert remove member contains" },
  { topic: "MerkleTree ADT", query: "MerkleTree insert root proof" },
  { topic: "Cell operations", query: "Cell read write state ledger" },
  { topic: "Circuit syntax", query: "circuit export witness assert" },
  { topic: "Pragma version", query: "pragma language_version" },
  { topic: "Type casting", query: "cast Uint Field Bytes conversion" },
  { topic: "Disclosure", query: "disclose witness disclosure" },
  { topic: "Built-in functions", query: "persistentHash pad hash builtin" },
];

/**
 * Search indexed docs for all critical topics to build comprehensive reference
 */
export async function enrichSyntaxReference(): Promise<{
  adtInfo: Record<string, ADTInfo | null>;
  syntaxPatterns: Record<string, HostedSearchResponse | null>;
  lastEnriched: string;
}> {
  const adtInfo: Record<string, ADTInfo | null> = {};
  const syntaxPatterns: Record<string, HostedSearchResponse | null> = {};

  // Search for ADT info
  const adtTypes = ["Counter", "Map", "Set", "MerkleTree", "Cell"];
  for (const adt of adtTypes) {
    adtInfo[adt] = await searchADTInfo(adt);
  }

  // Search for syntax patterns
  for (const { topic, query } of CRITICAL_DOC_TOPICS) {
    syntaxPatterns[topic] = await searchCompactSyntax(query);
  }

  return {
    adtInfo,
    syntaxPatterns,
    lastEnriched: new Date().toISOString(),
  };
}

/**
 * Quick validation check - search docs to verify a specific claim
 */
export async function verifyClaimAgainstDocs(claim: string): Promise<{
  verified: boolean;
  evidence: string[];
  searchResults: HostedSearchResponse | null;
}> {
  try {
    const results = await searchDocsHosted(claim, 5, "all");

    if (!results.results || results.results.length === 0) {
      return {
        verified: false,
        evidence: ["No matching documentation found"],
        searchResults: results,
      };
    }

    const evidence: string[] = [];
    for (const result of results.results.slice(0, 3)) {
      const snippet =
        (result.content || result.code || "").slice(0, 200) + "...";
      evidence.push(`[${result.source.filePath}]: ${snippet}`);
    }

    return {
      verified: true,
      evidence,
      searchResults: results,
    };
  } catch (error) {
    return {
      verified: false,
      evidence: [`Search failed: ${error}`],
      searchResults: null,
    };
  }
}
