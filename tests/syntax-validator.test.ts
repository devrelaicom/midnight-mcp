/**
 * Syntax Validator Service Tests
 *
 * Tests the hybrid syntax validation service that validates static data
 * against indexed documentation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  scanForDeprecatedPatterns,
  DEPRECATED_SYNTAX_PATTERNS,
  validateADTOperations,
  searchADTInfo,
  searchCompactSyntax,
  enrichSyntaxReference,
  verifyClaimAgainstDocs,
  validateBuiltinFunctions,
  validateTypeCompatibility,
  validateCommonErrors,
  validateAllStaticData,
  CRITICAL_DOC_TOPICS,
} from "../src/services/syntax-validator.js";

// Mock the hosted-api module
vi.mock("../src/utils/hosted-api.js", () => ({
  searchDocsHosted: vi.fn(),
  searchCompactHosted: vi.fn(),
}));

import {
  searchDocsHosted,
  searchCompactHosted,
} from "../src/utils/hosted-api.js";

const mockSearchDocsHosted = searchDocsHosted as ReturnType<typeof vi.fn>;
const mockSearchCompactHosted = searchCompactHosted as ReturnType<typeof vi.fn>;

describe("Syntax Validator Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("DEPRECATED_SYNTAX_PATTERNS", () => {
    it("should have all required pattern definitions", () => {
      expect(DEPRECATED_SYNTAX_PATTERNS).toBeDefined();
      expect(DEPRECATED_SYNTAX_PATTERNS.length).toBeGreaterThan(5);

      // Check each pattern has required fields
      for (const pattern of DEPRECATED_SYNTAX_PATTERNS) {
        expect(pattern.pattern).toBeInstanceOf(RegExp);
        expect(pattern.name).toBeDefined();
        expect(pattern.name.length).toBeGreaterThan(0);
        expect(pattern.message).toBeDefined();
        expect(pattern.message.length).toBeGreaterThan(10);
        expect(pattern.since).toBeDefined();
      }
    });

    it("should include critical deprecated patterns", () => {
      const patternNames = DEPRECATED_SYNTAX_PATTERNS.map((p) => p.name);
      expect(patternNames).toContain("ledger-block");
      expect(patternNames).toContain("cell-wrapper");
      expect(patternNames).toContain("void-type");
      expect(patternNames).toContain("counter-value");
      expect(patternNames).toContain("witness-with-body");
    });
  });

  describe("scanForDeprecatedPatterns", () => {
    it("should detect deprecated ledger block syntax", () => {
      const code = `pragma language_version >= 0.16;

ledger {
  counter: Counter;
}`;

      const issues = scanForDeprecatedPatterns(code);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some((i) => i.pattern === "ledger-block")).toBe(true);
    });

    it("should detect deprecated Cell wrapper", () => {
      const code = `export ledger value: Cell<Field>;`;

      const issues = scanForDeprecatedPatterns(code);

      expect(issues.some((i) => i.pattern === "cell-wrapper")).toBe(true);
    });

    it("should detect Void return type", () => {
      const code = `export circuit doSomething(): Void {
  counter.increment(1);
}`;

      const issues = scanForDeprecatedPatterns(code);

      expect(issues.some((i) => i.pattern === "void-type")).toBe(true);
    });

    it("should detect .value() on Counter", () => {
      const code = `export circuit getValue(): Uint<64> {
  return counter.value();
}`;

      const issues = scanForDeprecatedPatterns(code);

      expect(issues.some((i) => i.pattern === "counter-value")).toBe(true);
    });

    it("should detect Rust-style enum syntax", () => {
      const code = `const choice = Choice::rock;`;

      const issues = scanForDeprecatedPatterns(code);

      expect(issues.some((i) => i.pattern === "rust-enum-syntax")).toBe(true);
    });

    it("should detect pure function instead of pure circuit", () => {
      const code = `pure function helper(): Field {
  return 42;
}`;

      const issues = scanForDeprecatedPatterns(code);

      expect(issues.some((i) => i.pattern === "pure-function")).toBe(true);
    });

    it("should detect witness with body", () => {
      const code = `witness getSecret(): Field {
  return ledger.secret;
}`;

      const issues = scanForDeprecatedPatterns(code);

      expect(issues.some((i) => i.pattern === "witness-with-body")).toBe(true);
    });

    it("should include line numbers in issues", () => {
      const code = `pragma language_version >= 0.16;
import CompactStandardLibrary;

ledger {
  counter: Counter;
}`;

      const issues = scanForDeprecatedPatterns(code);

      const ledgerIssue = issues.find((i) => i.pattern === "ledger-block");
      expect(ledgerIssue).toBeDefined();
      expect(ledgerIssue?.lineNumber).toBe(4);
    });

    it("should return empty array for valid code", () => {
      const code = `pragma language_version >= 0.16 && <= 0.18;

import CompactStandardLibrary;

export ledger counter: Counter;

export circuit increment(): [] {
  counter.increment(1n);
}

witness getSecret(): Field;
`;

      const issues = scanForDeprecatedPatterns(code);

      expect(issues.length).toBe(0);
    });

    it("should detect multiple issues in same code", () => {
      const code = `ledger {
  counter: Counter;
}

export circuit getValue(): Void {
  return counter.value();
}`;

      const issues = scanForDeprecatedPatterns(code);

      expect(issues.length).toBeGreaterThanOrEqual(3);
      expect(issues.some((i) => i.pattern === "ledger-block")).toBe(true);
      expect(issues.some((i) => i.pattern === "void-type")).toBe(true);
      expect(issues.some((i) => i.pattern === "counter-value")).toBe(true);
    });
  });

  describe("searchADTInfo", () => {
    it("should return null when no results found", async () => {
      mockSearchDocsHosted.mockResolvedValue({
        results: [],
        totalResults: 0,
        query: "Counter",
      });

      const result = await searchADTInfo("Counter");

      expect(result).toBeNull();
    });

    it("should parse ADT operations from search results", async () => {
      mockSearchDocsHosted.mockResolvedValue({
        results: [
          {
            content:
              "| `increment` | `(amount: Uint<64>): []` | Increases counter |\n| `read` | `(): Uint<64>` | Returns value |",
            source: { filePath: "docs/ledger-adt.md" },
          },
        ],
        totalResults: 1,
        query: "Counter",
      });

      const result = await searchADTInfo("Counter");

      expect(result).toBeDefined();
      expect(result?.name).toBe("Counter");
      expect(result?.operations.length).toBeGreaterThan(0);
    });

    it("should handle search errors gracefully", async () => {
      mockSearchDocsHosted.mockRejectedValue(new Error("Network error"));

      const result = await searchADTInfo("Counter");

      expect(result).toBeNull();
    });

    it("should include source document path when found", async () => {
      mockSearchDocsHosted.mockResolvedValue({
        results: [
          {
            content: "| `read` | `(): Uint<64>` | Returns value |",
            source: { filePath: "reference/ledger-adt.md" },
          },
        ],
        totalResults: 1,
        query: "Counter",
      });

      const result = await searchADTInfo("Counter");

      expect(result?.sourceDocPath).toBe("reference/ledger-adt.md");
    });
  });

  describe("searchCompactSyntax", () => {
    it("should merge docs and code results", async () => {
      mockSearchDocsHosted.mockResolvedValue({
        results: [{ content: "docs result", source: { filePath: "docs.md" } }],
        totalResults: 1,
      });
      mockSearchCompactHosted.mockResolvedValue({
        results: [
          { code: "code result", source: { filePath: "example.compact" } },
        ],
        totalResults: 1,
      });

      const result = await searchCompactSyntax("circuit");

      expect(result).toBeDefined();
      expect(result?.results?.length).toBe(2);
    });

    it("should return null on error", async () => {
      mockSearchDocsHosted.mockRejectedValue(new Error("Search failed"));

      const result = await searchCompactSyntax("circuit");

      expect(result).toBeNull();
    });

    it("should limit results to maximum", async () => {
      const manyResults = Array(20)
        .fill(null)
        .map((_, i) => ({
          content: `result ${i}`,
          source: { filePath: `file${i}.md` },
        }));

      mockSearchDocsHosted.mockResolvedValue({
        results: manyResults,
        totalResults: 20,
      });
      mockSearchCompactHosted.mockResolvedValue({
        results: manyResults,
        totalResults: 20,
      });

      const result = await searchCompactSyntax("circuit");

      expect(result?.results?.length).toBeLessThanOrEqual(10);
    });
  });

  describe("validateADTOperations", () => {
    it("should return fallback when indexed docs unavailable", async () => {
      mockSearchDocsHosted.mockResolvedValue({
        results: [],
        totalResults: 0,
      });

      const staticOps = [
        { method: ".increment()", works: true, note: "Increments counter" },
      ];

      const result = await validateADTOperations("Counter", staticOps);

      expect(result.validated).toBe(false);
      expect(result.operations[0].source).toBe("static-fallback");
      expect(result.discrepancies.length).toBeGreaterThan(0);
    });

    it("should detect discrepancies between static and indexed", async () => {
      mockSearchDocsHosted.mockResolvedValue({
        results: [
          {
            content:
              "| `increment` | `(amount: Uint<64>): []` | Increases counter |",
            source: { filePath: "docs/ledger-adt/counter.md" },
          },
        ],
        totalResults: 1,
      });

      const staticOps = [
        { method: ".increment()", works: false, note: "Doesn't work" },
      ];

      const result = await validateADTOperations("Counter", staticOps);

      expect(result.validated).toBe(true);
      expect(result.discrepancies.length).toBeGreaterThan(0);
    });

    it("should report enrichments for new methods found", async () => {
      mockSearchDocsHosted.mockResolvedValue({
        results: [
          {
            content:
              "| `increment` | `(amount): []` | Inc |\n| `decrement` | `(amount): []` | Dec |",
            source: { filePath: "docs/ledger-adt/counter.md" },
          },
        ],
        totalResults: 1,
      });

      const staticOps = [
        { method: ".increment()", works: true, note: "Increments" },
      ];

      const result = await validateADTOperations("Counter", staticOps);

      expect(result.enrichments.some((e) => e.includes("decrement"))).toBe(
        true
      );
    });
  });

  describe("verifyClaimAgainstDocs", () => {
    it("should return verified=true when docs found", async () => {
      mockSearchDocsHosted.mockResolvedValue({
        results: [
          {
            content: "Counter.read() returns the current value",
            source: { filePath: "docs/counter.md" },
          },
        ],
        totalResults: 1,
      });

      const result = await verifyClaimAgainstDocs("Counter read method");

      expect(result.verified).toBe(true);
      expect(result.evidence.length).toBeGreaterThan(0);
    });

    it("should return verified=false when no docs found", async () => {
      mockSearchDocsHosted.mockResolvedValue({
        results: [],
        totalResults: 0,
      });

      const result = await verifyClaimAgainstDocs("nonexistent feature");

      expect(result.verified).toBe(false);
      expect(result.evidence).toContain("No matching documentation found");
    });

    it("should handle search errors", async () => {
      mockSearchDocsHosted.mockRejectedValue(new Error("API unavailable"));

      const result = await verifyClaimAgainstDocs("any claim");

      expect(result.verified).toBe(false);
      expect(result.evidence[0]).toContain("Search failed");
    });
  });

  describe("validateBuiltinFunctions", () => {
    it("should validate builtins against indexed docs", async () => {
      mockSearchCompactHosted.mockResolvedValue({
        results: [{ content: "persistentHash function", source: {} }],
        totalResults: 1,
      });

      const builtins = [
        {
          name: "persistentHash",
          signature: "(data: Field): Bytes<32>",
          description: "Hashes data",
        },
      ];

      const result = await validateBuiltinFunctions(builtins);

      expect(result.dataType).toBe("BUILTIN_FUNCTIONS");
      expect(result.lastValidated).toBeDefined();
    });

    it("should report discrepancies for missing builtins", async () => {
      mockSearchCompactHosted.mockResolvedValue({
        results: [],
        totalResults: 0,
      });

      const builtins = [
        {
          name: "nonExistentFunction",
          signature: "(): void",
          description: "Does not exist",
        },
      ];

      const result = await validateBuiltinFunctions(builtins);

      expect(result.discrepancies.length).toBeGreaterThan(0);
      expect(result.discrepancies[0]).toContain("nonExistentFunction");
    });
  });

  describe("validateTypeCompatibility", () => {
    it("should validate type rules against indexed docs", async () => {
      mockSearchCompactHosted.mockResolvedValue({
        results: [
          {
            content: "Field and Uint are compatible for arithmetic",
            source: {},
          },
        ],
        totalResults: 1,
      });

      const rules = [
        {
          types: "Field + Uint",
          works: true,
          note: "Arithmetic compatible",
        },
      ];

      const result = await validateTypeCompatibility(rules);

      expect(result.dataType).toBe("TYPE_COMPATIBILITY");
      expect(result.lastValidated).toBeDefined();
    });
  });

  describe("validateCommonErrors", () => {
    it("should validate error messages against indexed docs", async () => {
      mockSearchDocsHosted.mockResolvedValue({
        results: [
          {
            content: 'Error: "Expected type annotation"',
            source: { filePath: "errors.md" },
          },
        ],
        totalResults: 1,
      });

      const errors = [
        {
          error: "Expected type annotation",
          cause: "Missing type",
          fix: "Add type",
        },
      ];

      const result = await validateCommonErrors(errors);

      expect(result.dataType).toBe("COMMON_ERRORS");
      expect(result.validated).toBe(true);
    });
  });

  describe("validateAllStaticData", () => {
    it("should run all validations in parallel", async () => {
      mockSearchDocsHosted.mockResolvedValue({
        results: [],
        totalResults: 0,
      });
      mockSearchCompactHosted.mockResolvedValue({
        results: [],
        totalResults: 0,
      });

      const staticData = {
        builtinFunctions: [
          { name: "hash", signature: "(): Bytes<32>", description: "Hash" },
        ],
        typeCompatibility: [{ types: "Field + Field", works: true }],
        commonErrors: [{ error: "Type error", cause: "Bad type", fix: "Fix" }],
        ledgerTypeLimits: {
          Counter: {
            circuitOperations: [
              { method: ".read()", works: true, note: "Read" },
            ],
          },
        },
      };

      const result = await validateAllStaticData(staticData);

      expect(result.overall).toBeDefined();
      expect(result.results).toBeDefined();
      expect(result.lastValidated).toBeDefined();
      expect(result.overall.totalDiscrepancies).toBeGreaterThanOrEqual(0);
      expect(result.overall.totalEnrichments).toBeGreaterThanOrEqual(0);
    });

    it("should handle empty static data", async () => {
      const result = await validateAllStaticData({});

      expect(result.overall.validated).toBe(true);
      expect(result.results).toEqual({});
    });

    it("should aggregate discrepancies from all validators", async () => {
      mockSearchDocsHosted.mockResolvedValue({
        results: [],
        totalResults: 0,
      });
      mockSearchCompactHosted.mockResolvedValue({
        results: [],
        totalResults: 0,
      });

      const staticData = {
        builtinFunctions: [
          { name: "fake1", signature: "(): void", description: "Fake" },
          { name: "fake2", signature: "(): void", description: "Fake" },
        ],
        ledgerTypeLimits: {
          FakeADT: {
            circuitOperations: [
              { method: ".fakeMethod()", works: true, note: "Fake" },
            ],
          },
        },
      };

      const result = await validateAllStaticData(staticData);

      expect(result.overall.totalDiscrepancies).toBeGreaterThan(0);
    });
  });

  describe("enrichSyntaxReference", () => {
    it("should fetch ADT info for all ADT types", async () => {
      mockSearchDocsHosted.mockResolvedValue({
        results: [
          {
            content: "| `read` | `(): Uint<64>` | Returns value |",
            source: { filePath: "docs/adt.md" },
          },
        ],
        totalResults: 1,
      });
      mockSearchCompactHosted.mockResolvedValue({
        results: [],
        totalResults: 0,
      });

      const result = await enrichSyntaxReference();

      expect(result.adtInfo).toBeDefined();
      expect(result.syntaxPatterns).toBeDefined();
      expect(result.lastEnriched).toBeDefined();
      // Should have entries for all ADT types
      expect(Object.keys(result.adtInfo).length).toBeGreaterThan(0);
    });

    it("should fetch syntax patterns for all critical topics", async () => {
      mockSearchDocsHosted.mockResolvedValue({
        results: [{ content: "syntax info", source: {} }],
        totalResults: 1,
      });
      mockSearchCompactHosted.mockResolvedValue({
        results: [{ code: "example code", source: {} }],
        totalResults: 1,
      });

      const result = await enrichSyntaxReference();

      expect(Object.keys(result.syntaxPatterns).length).toBe(
        CRITICAL_DOC_TOPICS.length
      );
    });
  });

  describe("CRITICAL_DOC_TOPICS", () => {
    it("should have all critical documentation topics", () => {
      expect(CRITICAL_DOC_TOPICS.length).toBeGreaterThan(5);

      const topics = CRITICAL_DOC_TOPICS.map((t) => t.topic);
      expect(topics).toContain("Counter ADT");
      expect(topics).toContain("Map ADT");
      expect(topics).toContain("Set ADT");
      expect(topics).toContain("Circuit syntax");
      expect(topics).toContain("Pragma version");
    });

    it("should have meaningful queries for each topic", () => {
      for (const { topic, query } of CRITICAL_DOC_TOPICS) {
        expect(topic.length).toBeGreaterThan(3);
        expect(query.length).toBeGreaterThan(5);
        expect(query.split(" ").length).toBeGreaterThanOrEqual(2);
      }
    });
  });
});
