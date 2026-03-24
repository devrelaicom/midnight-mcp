/**
 * Redaction module — field-name, regex, and truncation-based sanitization
 * for log records. Used by logtape-setup.ts to wrap sinks and formatters.
 */

import type { Sink, LogRecord } from "@logtape/logtape";
import { DEFAULT_REDACT_FIELDS, redactByField } from "@logtape/redaction";
import { JWT_PATTERN } from "@logtape/redaction";
import type { FieldPatterns, RedactionPatterns } from "@logtape/redaction";

// ---------------------------------------------------------------------------
// Field-name patterns — extends LogTape defaults with blockchain/crypto fields
// ---------------------------------------------------------------------------
export const SENSITIVE_FIELD_PATTERNS: FieldPatterns = [
  ...DEFAULT_REDACT_FIELDS,
  "privateKey",
  "mnemonic",
  "seed",
  "secret",
  "apiKey",
  /token/i,
  "passphrase",
  "password",
  "authorization",
  "secretKey",
  "signingKey",
  "encryptionKey",
];

// ---------------------------------------------------------------------------
// Regex patterns for wallet material and secrets in formatted text output
// ---------------------------------------------------------------------------
export const CRYPTO_REDACTION_PATTERNS: RedactionPatterns = [
  JWT_PATTERN,
  // Hex-encoded secret keys (64 hex chars = 32 bytes, e.g. ed25519 keys)
  {
    pattern: /\b[0-9a-fA-F]{64}\b/g,
    replacement: "[REDACTED:hex-key]",
  },
  // Cardano/Midnight Bech32 secret key prefixes
  {
    pattern: /\b(?:addr_sk|stake_sk|ed25519_sk)[0-9a-z]{50,}/gi,
    replacement: "[REDACTED:secret-key]",
  },
  // BIP-39 mnemonic phrases: 12–24 consecutive lowercase words of 3–8 chars
  {
    pattern: /\b(?:[a-z]{3,8}\s+){11,23}[a-z]{3,8}\b/g,
    replacement: "[REDACTED:mnemonic]",
  },
];

// ---------------------------------------------------------------------------
// Payload truncation — prevents large strings from bloating log output
// ---------------------------------------------------------------------------
const MAX_STRING_LENGTH = 500;
const PREVIEW_LENGTH = 100;
const MAX_DEPTH = 5;

function truncateValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[nested too deep]";
  if (typeof value === "string" && value.length > MAX_STRING_LENGTH) {
    return `${value.slice(0, PREVIEW_LENGTH)}...[truncated ${value.length - PREVIEW_LENGTH} chars]`;
  }
  if (Array.isArray(value)) {
    return value.map((v) => truncateValue(v, depth + 1));
  }
  if (typeof value === "object" && value !== null) {
    return truncatePropertiesInner(value as Record<string, unknown>, depth + 1);
  }
  return value;
}

function truncatePropertiesInner(
  properties: Record<string, unknown>,
  depth: number,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    result[key] = truncateValue(value, depth);
  }
  return result;
}

/** Recursively truncate string values longer than {@link MAX_STRING_LENGTH}. */
export function truncateProperties(properties: Record<string, unknown>): Record<string, unknown> {
  return truncatePropertiesInner(properties, 0);
}

// ---------------------------------------------------------------------------
// Regex redaction on property values
// ---------------------------------------------------------------------------

/** Apply CRYPTO_REDACTION_PATTERNS to a single string. */
export function redactString(value: string): string {
  let redacted = value;
  for (const { pattern, replacement } of CRYPTO_REDACTION_PATTERNS) {
    pattern.lastIndex = 0;
    redacted = redacted.replaceAll(pattern, replacement as string);
  }
  return redacted;
}

/** Apply CRYPTO_REDACTION_PATTERNS to every string value in a properties bag. */
function redactPatternValues(properties: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    result[key] = redactPatternValue(value);
  }
  return result;
}

function redactPatternValue(value: unknown): unknown {
  if (typeof value === "string") {
    return redactString(value);
  }
  if (Array.isArray(value)) {
    return value.map(redactPatternValue);
  }
  if (typeof value === "object" && value !== null) {
    return redactPatternValues(value as Record<string, unknown>);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Composable redacted sink
// ---------------------------------------------------------------------------

/**
 * Wraps a sink with truncation, regex-pattern redaction on property values,
 * and field-name redaction.
 *
 * Processing order:
 *   truncate long strings → regex-redact property values → field-name redact → inner sink.
 *
 * This ensures both the console sink AND the MCP sink receive fully sanitized data.
 */
export function createRedactedSink(innerSink: Sink): Sink {
  const fieldRedacted = redactByField(innerSink, {
    fieldPatterns: SENSITIVE_FIELD_PATTERNS,
    action: () => "[REDACTED]",
  }) as Sink;

  return (record: LogRecord) => {
    const truncated = truncateProperties(record.properties);
    const patternRedacted = redactPatternValues(truncated);
    fieldRedacted({
      ...record,
      properties: patternRedacted,
    });
  };
}
