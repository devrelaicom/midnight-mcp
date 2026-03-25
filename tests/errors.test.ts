/**
 * Tests for user-facing error messages and self-correction hints.
 *
 * Ensures hints never reference tools that have been removed from the server.
 */

import { describe, it, expect } from "vitest";
import { SelfCorrectionHints } from "../src/utils/errors.js";

/**
 * Tool names that were removed from the server (see CHANGELOG.md [Unreleased] → Removed).
 * If a new tool is deleted, add its MCP name here so the hint sweep catches stale references.
 */
const DELETED_TOOL_NAMES = [
  "midnight-get-version-info",
  "midnight-get-migration-guide",
  "midnight-get-latest-syntax",
  "midnight-explain-circuit",
  "midnight-extract-contract-structure",
  "midnight-generate-contract",
  "midnight-review-contract",
  "midnight-document-contract",
  "midnight-validate-contract",
];

describe("SelfCorrectionHints", () => {
  it("INVALID_VERSION does not reference deleted tools", () => {
    const hint = SelfCorrectionHints.INVALID_VERSION("bad", "v1.0.0");
    for (const deletedTool of DELETED_TOOL_NAMES) {
      expect(hint.suggestion).not.toContain(deletedTool);
    }
  });

  it("INVALID_VERSION references only currently registered tools", () => {
    const hint = SelfCorrectionHints.INVALID_VERSION("bad", "v1.0.0");
    expect(hint.suggestion).toContain("midnight-check-breaking-changes");
    expect(hint.suggestion).toContain("midnight-upgrade-check");
  });

  it("no self-correction hint references a deleted tool", () => {
    // Exercise every hint factory with representative arguments
    const allHints = [
      SelfCorrectionHints.INVALID_VERSION("0.0.0", "v1.0.0"),
      SelfCorrectionHints.UNKNOWN_REPO("fake-repo", ["compact", "midnight-js"]),
      SelfCorrectionHints.MISSING_REQUIRED_PARAM("repo", "midnight-test"),
      SelfCorrectionHints.FILE_NOT_FOUND("missing.ts", "compact"),
      SelfCorrectionHints.FILE_NOT_FOUND("missing.ts", "compact", ["found.ts"]),
      SelfCorrectionHints.RATE_LIMIT(),
      SelfCorrectionHints.RATE_LIMIT(30),
    ];

    for (const hint of allHints) {
      const text = JSON.stringify(hint);
      for (const deletedTool of DELETED_TOOL_NAMES) {
        expect(text, `Hint contains deleted tool "${deletedTool}": ${text}`).not.toContain(
          deletedTool,
        );
      }
    }
  });
});
