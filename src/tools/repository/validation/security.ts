/**
 * Security and validation helpers for contract analysis.
 * Path validation, regex escaping, and binary content detection.
 */

import { isAbsolute, resolve } from "path";
import { platform } from "process";

/**
 * Escape special regex characters in a string to prevent regex injection
 * @param str - The string to escape
 * @returns The escaped string safe for use in RegExp
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Validate file path for security - prevent path traversal attacks
 */
export function validateFilePath(filePath: string): {
  valid: boolean;
  error?: string;
  normalizedPath?: string;
} {
  // Must be absolute path
  if (!isAbsolute(filePath)) {
    return {
      valid: false,
      error: "File path must be absolute (e.g., /Users/you/contract.compact)",
    };
  }

  // Resolve to catch ../ traversal
  const normalized = resolve(filePath);

  // Check for path traversal attempts
  // Simply check for ".." in the path - this is always suspicious in absolute paths
  if (filePath.includes("..")) {
    return {
      valid: false,
      error: "Path traversal detected - use absolute paths without ../",
    };
  }

  // Must end with .compact
  if (!normalized.endsWith(".compact")) {
    return {
      valid: false,
      error: "File must have .compact extension",
    };
  }

  // Block sensitive paths (Unix and Windows)
  const blockedPathsUnix = ["/etc", "/var", "/usr", "/bin", "/sbin", "/root"];
  const blockedPathsWindows = [
    "C:\\Windows",
    "C:\\Program Files",
    "C:\\Program Files (x86)",
    "C:\\System32",
    "C:\\ProgramData",
  ];
  const blockedPaths = platform === "win32" ? blockedPathsWindows : blockedPathsUnix;

  const normalizedLower = normalized.toLowerCase();
  if (blockedPaths.some((blocked) => normalizedLower.startsWith(blocked.toLowerCase()))) {
    return {
      valid: false,
      error: "Cannot access system directories",
    };
  }

  return { valid: true, normalizedPath: normalized };
}

/**
 * Check if content is valid UTF-8 text (not binary)
 */
export function isValidUtf8Text(content: string): boolean {
  // Check for null bytes (common in binary files)
  if (content.includes("\x00")) {
    return false;
  }

  // Check for excessive non-printable characters
  const nonPrintable = content.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g);
  if (nonPrintable && nonPrintable.length > content.length * 0.01) {
    return false;
  }

  return true;
}
