# Compact Syntax Maintenance Guide

This guide explains how to update midnight-mcp when the Compact language syntax changes or a new compiler version is released.

## When to Update

Update the syntax reference when:

1. ✅ New Compact compiler version is released
2. ✅ Syntax changes (new keywords, deprecated patterns)
3. ✅ New language features are added
4. ✅ Existing patterns become deprecated

## Files to Update

### 1. Version Constants (`src/config/compact-version.ts`)

Update the centralized Compact version config:

```typescript
// Find and update:
export const COMPACT_VERSION = {
  min: "0.21",
  max: "0.21",
};

export const RECOMMENDED_PRAGMA = `pragma language_version 0.21;`;

// Also update commonMistakes array if patterns change
export const DEPRECATED_PATTERNS = {
  // Add new deprecated patterns here
};
```

### 3. Static Analysis (`src/tools/repository/validation.ts`)

Add new checks for deprecated patterns:

```typescript
// Find the section: "CRITICAL SYNTAX CHECKS (P0)"
// Add new patterns like:

// P0-X. Detect <new deprecated pattern>
const newPattern = /<regex>/g;
let match;
while ((match = newPattern.exec(code)) !== null) {
  potentialIssues.push({
    type: "new_issue_type",
    line: lineByIndex[match.index] || 1,
    message: `Description of the problem`,
    suggestion: `How to fix it`,
    severity: "error",
  });
}
```

### 4. CI Tests (`tests/syntax-drift.test.ts`)

Update tests to validate new patterns:

```typescript
// Add test for new deprecated pattern:
it("should detect <new deprecated pattern>", async () => {
  const badCode = `...`;
  const result = await analyzeContract({ code: badCode });
  expect(result.securityFindings?.some((i) => i.message.includes("new_issue_type"))).toBe(
    true
  );
});

// Add test for new correct pattern:
it("should accept <new correct pattern>", async () => {
  const goodCode = `...`;
  const result = await analyzeContract({ code: goodCode });
  expect(
    result.securityFindings?.find((i) => i.message.includes("new_issue_type"))
  ).toBeUndefined();
});
```

## Verification Process

After making updates:

```bash
# 1. Run tests - CI drift tests will catch syntax mismatches
npm test

# 2. Build to check TypeScript
npm run build

# 3. Manual test with a real contract
echo 'pragma language_version 0.21;
import CompactStandardLibrary;
export ledger counter: Counter;
export circuit inc(): [] { counter.increment(1); }' > /tmp/test.compact

# Use the MCP to analyze the contract
# Check that no security findings are reported for valid code
```

## Version History

| Compact Version | midnight-mcp Version | Key Changes                                         |
| --------------- | -------------------- | --------------------------------------------------- |
| 0.21            | current              | Exact version pragma, current docs/examples         |
| 0.16 - 0.18     | 0.1.33+              | Individual ledger decls, `[]` return, bounded pragma |
| 0.14 - 0.15     | 0.1.0 - 0.1.32       | `ledger {}` block, `Cell<T>` wrapper                |

## Finding Syntax Changes

1. **Midnight Docs**: https://docs.midnight.network
2. **Compiler Release Notes**: Check GitHub releases
3. **Example Repos** (known-good reference):
   - `midnightntwrk/example-hello-world`
   - `midnightntwrk/example-counter`
   - `midnightntwrk/example-bboard`
   - `midnightntwrk/midnight-docs`

## Future Improvements

To reduce manual maintenance burden, consider:

1. **Automated Syntax Fetching**: Fetch syntax spec from compiler or docs API
2. **Version Detection**: Auto-detect installed `compactc` version
3. **Multi-Version Support**: Store syntax for multiple versions, return based on user's pragma
4. **Compiler Integration**: Use compiler's error output to validate patterns

## Questions?

If you're unsure whether a syntax change affects midnight-mcp:

1. Write a minimal contract using the new/changed syntax
2. Run `midnight-analyze-contract` on it
3. If security findings are incorrectly reported → update syntax-validator.ts
4. If the quick start template breaks → update docs-content.ts
