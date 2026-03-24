/**
 * Tests for the redaction module.
 * Verifies field-name redaction, regex pattern redaction,
 * payload truncation, and composable sink behavior.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LogRecord, Sink } from "@logtape/logtape";
import {
  SENSITIVE_FIELD_PATTERNS,
  CRYPTO_REDACTION_PATTERNS,
  truncateProperties,
  createRedactedSink,
} from "../src/utils/redaction.js";

/** Helper to build a minimal LogRecord. */
function makeRecord(properties: Record<string, unknown> = {}): LogRecord {
  return {
    category: ["test"],
    level: "info",
    message: ["test message"],
    rawMessage: "test message",
    timestamp: Date.now(),
    properties,
  };
}

// ---------------------------------------------------------------------------
// Field-name redaction
// ---------------------------------------------------------------------------

describe("SENSITIVE_FIELD_PATTERNS", () => {
  it("includes standard fields from DEFAULT_REDACT_FIELDS", () => {
    expect(SENSITIVE_FIELD_PATTERNS).toEqual(
      expect.arrayContaining(["password"]),
    );
  });

  it("includes blockchain-specific field names", () => {
    const stringPatterns = SENSITIVE_FIELD_PATTERNS.filter(
      (p) => typeof p === "string",
    );
    expect(stringPatterns).toEqual(
      expect.arrayContaining([
        "privateKey",
        "mnemonic",
        "seed",
        "secret",
        "apiKey",
        "passphrase",
        "secretKey",
        "signingKey",
        "encryptionKey",
      ]),
    );
  });

  it("includes a case-insensitive regex for token-like fields", () => {
    const regexPatterns = SENSITIVE_FIELD_PATTERNS.filter(
      (p) => p instanceof RegExp,
    );
    const tokenRegex = regexPatterns.find((r) => r.test("token"));
    expect(tokenRegex).toBeDefined();
    expect(tokenRegex!.test("accessToken")).toBe(true);
    expect(tokenRegex!.test("TOKEN")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Crypto regex patterns
// ---------------------------------------------------------------------------

describe("CRYPTO_REDACTION_PATTERNS", () => {
  it("has patterns for hex keys, secret keys, and mnemonics", () => {
    expect(CRYPTO_REDACTION_PATTERNS.length).toBeGreaterThanOrEqual(3);
  });

  it("matches 64-char hex strings", () => {
    const hexPattern = CRYPTO_REDACTION_PATTERNS.find(
      (p) => p.replacement === "[REDACTED:hex-key]",
    );
    expect(hexPattern).toBeDefined();
    const hexKey = "a".repeat(64);
    expect(hexPattern!.pattern.test(hexKey)).toBe(true);
    // Reset lastIndex for global regex
    hexPattern!.pattern.lastIndex = 0;
  });

  it("matches Bech32 secret key prefixes", () => {
    const bech32Pattern = CRYPTO_REDACTION_PATTERNS.find(
      (p) => p.replacement === "[REDACTED:secret-key]",
    );
    expect(bech32Pattern).toBeDefined();
    const secretKey = "ed25519_sk" + "a".repeat(60);
    expect(bech32Pattern!.pattern.test(secretKey)).toBe(true);
    bech32Pattern!.pattern.lastIndex = 0;
  });

  it("matches 12-word mnemonic phrases", () => {
    const mnemonicPattern = CRYPTO_REDACTION_PATTERNS.find(
      (p) => p.replacement === "[REDACTED:mnemonic]",
    );
    expect(mnemonicPattern).toBeDefined();
    const mnemonic =
      "abandon ability able about above absent absorb abstract absurd abuse access accident";
    expect(mnemonicPattern!.pattern.test(mnemonic)).toBe(true);
    mnemonicPattern!.pattern.lastIndex = 0;
  });

  it("matches 24-word mnemonic phrases", () => {
    const mnemonicPattern = CRYPTO_REDACTION_PATTERNS.find(
      (p) => p.replacement === "[REDACTED:mnemonic]",
    );
    expect(mnemonicPattern).toBeDefined();
    const mnemonic = Array.from({ length: 24 }, () => "word").join(" ");
    expect(mnemonicPattern!.pattern.test(mnemonic)).toBe(true);
    mnemonicPattern!.pattern.lastIndex = 0;
  });

  it("does not match short word sequences (< 12 words)", () => {
    const mnemonicPattern = CRYPTO_REDACTION_PATTERNS.find(
      (p) => p.replacement === "[REDACTED:mnemonic]",
    );
    expect(mnemonicPattern).toBeDefined();
    const shortPhrase = "abandon ability able about above absent";
    expect(mnemonicPattern!.pattern.test(shortPhrase)).toBe(false);
    mnemonicPattern!.pattern.lastIndex = 0;
  });
});

// ---------------------------------------------------------------------------
// Payload truncation
// ---------------------------------------------------------------------------

describe("truncateProperties", () => {
  it("truncates strings longer than 500 characters", () => {
    const longStr = "x".repeat(1000);
    const result = truncateProperties({ body: longStr });
    expect(typeof result.body).toBe("string");
    expect((result.body as string).length).toBeLessThan(250);
    expect(result.body).toContain("...[truncated");
    expect(result.body).toContain("900 chars]");
  });

  it("preserves strings within the limit", () => {
    const shortStr = "hello";
    const result = truncateProperties({ body: shortStr });
    expect(result.body).toBe("hello");
  });

  it("preserves non-string values", () => {
    const result = truncateProperties({ count: 42, flag: true });
    expect(result.count).toBe(42);
    expect(result.flag).toBe(true);
  });

  it("recursively truncates nested objects", () => {
    const nested = { inner: { code: "x".repeat(1000) } };
    const result = truncateProperties(nested);
    const innerResult = result.inner as Record<string, unknown>;
    expect((innerResult.code as string).length).toBeLessThan(250);
  });

  it("truncates strings inside arrays", () => {
    const result = truncateProperties({ items: ["x".repeat(1000)] });
    const arr = result.items as string[];
    expect(arr[0]!.length).toBeLessThan(250);
  });

  it("stops recursion at depth limit instead of overflowing", () => {
    // Build a deeply nested object (> MAX_DEPTH levels)
    let obj: Record<string, unknown> = { value: "deep" };
    for (let i = 0; i < 10; i++) {
      obj = { nested: obj };
    }
    const result = truncateProperties(obj);
    // Traverse until we hit the depth limit
    let current: unknown = result;
    let depth = 0;
    while (typeof current === "object" && current !== null && "nested" in current) {
      current = (current as Record<string, unknown>).nested;
      depth++;
    }
    // Should have stopped before reaching full depth (10 levels input)
    expect(current).toBe("[nested too deep]");
    expect(depth).toBeLessThan(10);
  });
});

// ---------------------------------------------------------------------------
// createRedactedSink
// ---------------------------------------------------------------------------

describe("createRedactedSink", () => {
  let innerSink: Sink;
  let receivedRecords: LogRecord[];

  beforeEach(() => {
    receivedRecords = [];
    innerSink = vi.fn((record: LogRecord) => {
      receivedRecords.push(record);
    });
  });

  it("redacts sensitive field names with [REDACTED]", () => {
    const sink = createRedactedSink(innerSink);
    sink(makeRecord({ apiKey: "sk-secret-123", name: "test" }));

    expect(receivedRecords).toHaveLength(1);
    expect(receivedRecords[0]!.properties.apiKey).toBe("[REDACTED]");
    expect(receivedRecords[0]!.properties.name).toBe("test");
  });

  it("redacts privateKey field", () => {
    const sink = createRedactedSink(innerSink);
    sink(makeRecord({ privateKey: "ed25519_sk_secret_material" }));

    expect(receivedRecords[0]!.properties.privateKey).toBe("[REDACTED]");
  });

  it("redacts mnemonic field", () => {
    const sink = createRedactedSink(innerSink);
    sink(makeRecord({ mnemonic: "abandon ability able about" }));

    expect(receivedRecords[0]!.properties.mnemonic).toBe("[REDACTED]");
  });

  it("redacts token-like fields (case insensitive)", () => {
    const sink = createRedactedSink(innerSink);
    sink(makeRecord({ accessToken: "abc123", refreshToken: "xyz789" }));

    expect(receivedRecords[0]!.properties.accessToken).toBe("[REDACTED]");
    expect(receivedRecords[0]!.properties.refreshToken).toBe("[REDACTED]");
  });

  it("truncates long string values before reaching the inner sink", () => {
    const sink = createRedactedSink(innerSink);
    const longBody = "a".repeat(1000);
    sink(makeRecord({ body: longBody }));

    const body = receivedRecords[0]!.properties.body as string;
    expect(body.length).toBeLessThan(250);
    expect(body).toContain("...[truncated");
  });

  it("preserves non-sensitive metadata", () => {
    const sink = createRedactedSink(innerSink);
    sink(
      makeRecord({
        tool: "midnight-search-compact",
        duration: 42,
        success: true,
      }),
    );

    const props = receivedRecords[0]!.properties;
    expect(props.tool).toBe("midnight-search-compact");
    expect(props.duration).toBe(42);
    expect(props.success).toBe(true);
  });

  it("regex-redacts hex keys embedded in non-sensitive field values", () => {
    const sink = createRedactedSink(innerSink);
    const hexKey = "a".repeat(64);
    sink(makeRecord({ description: `key is ${hexKey} here` }));

    const desc = receivedRecords[0]!.properties.description as string;
    expect(desc).not.toContain(hexKey);
    expect(desc).toContain("[REDACTED:hex-key]");
  });

  it("regex-redacts Bech32 secret keys in non-sensitive field values", () => {
    const sink = createRedactedSink(innerSink);
    const secretKey = "ed25519_sk" + "a".repeat(60);
    sink(makeRecord({ output: `found key: ${secretKey}` }));

    const output = receivedRecords[0]!.properties.output as string;
    expect(output).not.toContain(secretKey);
    expect(output).toContain("[REDACTED:secret-key]");
  });

  it("regex-redacts mnemonic phrases in non-sensitive field values", () => {
    const sink = createRedactedSink(innerSink);
    const mnemonic =
      "abandon ability able about above absent absorb abstract absurd abuse access accident";
    sink(makeRecord({ result: `wallet seed: ${mnemonic}` }));

    const result = receivedRecords[0]!.properties.result as string;
    expect(result).not.toContain(mnemonic);
    expect(result).toContain("[REDACTED:mnemonic]");
  });
});
