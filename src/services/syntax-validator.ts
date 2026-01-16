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
// Constants
// ============================================================================

/** Maximum results to fetch from indexed docs for ADT info */
const ADT_SEARCH_LIMIT = 10;

/** Maximum results to merge for syntax patterns */
const SYNTAX_RESULTS_LIMIT = 10;

/** Maximum results for each sub-query (docs/code) */
const SYNTAX_SUBQUERY_LIMIT = 5;

/** Maximum content length to consider for notes extraction */
const MAX_NOTE_SOURCE_LENGTH = 500;

/** Valid note length range */
const NOTE_MIN_LENGTH = 20;
const NOTE_MAX_LENGTH = 300;

/** Maximum notes to keep per ADT */
const MAX_NOTES_PER_ADT = 3;

/** Evidence snippet length for claim verification */
const EVIDENCE_SNIPPET_LENGTH = 200;

/** Maximum evidence items to return */
const MAX_EVIDENCE_ITEMS = 3;

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
      ADT_SEARCH_LIMIT,
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
        content.length < MAX_NOTE_SOURCE_LENGTH
      ) {
        const cleanNote = content.replace(/\s+/g, " ").trim();
        if (
          cleanNote.length > NOTE_MIN_LENGTH &&
          cleanNote.length < NOTE_MAX_LENGTH
        ) {
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
      notes: notes.slice(0, MAX_NOTES_PER_ADT),
      sourceDocPath,
      lastVerified: new Date().toISOString(),
    };
  } catch (error: unknown) {
    logger.warn(`Failed to search indexed docs for ADT ${adtName}`, {
      error: error instanceof Error ? error.message : String(error),
    });
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
      searchDocsHosted(
        `Compact ${topic} syntax`,
        SYNTAX_SUBQUERY_LIMIT,
        "reference"
      ),
      searchCompactHosted(`${topic}`, SYNTAX_SUBQUERY_LIMIT),
    ]);

    // Merge results, preferring docs for correctness
    const mergedResults = [
      ...(docsResult.results || []),
      ...(codeResult.results || []),
    ];

    return {
      results: mergedResults.slice(0, SYNTAX_RESULTS_LIMIT),
      totalResults: mergedResults.length,
      query: topic,
      lastIndexed: docsResult.lastIndexed || codeResult.lastIndexed,
    };
  } catch (error: unknown) {
    logger.warn(`Failed to search Compact syntax for topic ${topic}`, {
      error: error instanceof Error ? error.message : String(error),
    });
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
 * ADT types that have dedicated documentation
 */
const ADT_TYPES = ["Counter", "Map", "Set", "MerkleTree", "Cell"] as const;

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
] as const;

/**
 * Search indexed docs for all critical topics to build comprehensive reference
 * Uses parallel requests for better performance
 */
export async function enrichSyntaxReference(): Promise<{
  adtInfo: Record<string, ADTInfo | null>;
  syntaxPatterns: Record<string, HostedSearchResponse | null>;
  lastEnriched: string;
}> {
  // Fetch all ADT info in parallel
  const adtResults = await Promise.all(
    ADT_TYPES.map(async (adt) => ({
      type: adt,
      info: await searchADTInfo(adt),
    }))
  );

  const adtInfo: Record<string, ADTInfo | null> = {};
  for (const { type, info } of adtResults) {
    adtInfo[type] = info;
  }

  // Fetch all syntax patterns in parallel
  const syntaxResults = await Promise.all(
    CRITICAL_DOC_TOPICS.map(async ({ topic, query }) => ({
      topic,
      result: await searchCompactSyntax(query),
    }))
  );

  const syntaxPatterns: Record<string, HostedSearchResponse | null> = {};
  for (const { topic, result } of syntaxResults) {
    syntaxPatterns[topic] = result;
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
    const results = await searchDocsHosted(claim, SYNTAX_SUBQUERY_LIMIT, "all");

    if (!results.results || results.results.length === 0) {
      return {
        verified: false,
        evidence: ["No matching documentation found"],
        searchResults: results,
      };
    }

    const evidence: string[] = [];
    for (const result of results.results.slice(0, MAX_EVIDENCE_ITEMS)) {
      const snippet =
        (result.content || result.code || "").slice(
          0,
          EVIDENCE_SNIPPET_LENGTH
        ) + "...";
      evidence.push(`[${result.source.filePath}]: ${snippet}`);
    }

    return {
      verified: true,
      evidence,
      searchResults: results,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      verified: false,
      evidence: [`Search failed: ${errorMessage}`],
      searchResults: null,
    };
  }
}
