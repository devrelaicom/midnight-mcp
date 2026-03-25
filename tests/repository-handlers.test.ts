/**
 * Repository handler behavioral tests.
 * Verifies resolveRepo alias resolution, getFile truncation/line-range,
 * listExamples category filtering, and error self-correction hints.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetFileContent,
  mockGetRecentCommits,
  mockGetVersionInfo,
  mockIsOutdated,
  mockGetBreakingChangesSince,
  mockGetFileAtVersion,
  mockCompareSyntax,
  mockCheckBreakingChanges,
  mockGetMigrationGuide,
} = vi.hoisted(() => ({
  mockGetFileContent: vi.fn(),
  mockGetRecentCommits: vi.fn(),
  mockGetVersionInfo: vi.fn(),
  mockIsOutdated: vi.fn(),
  mockGetBreakingChangesSince: vi.fn(),
  mockGetFileAtVersion: vi.fn(),
  mockCompareSyntax: vi.fn(),
  mockCheckBreakingChanges: vi.fn(),
  mockGetMigrationGuide: vi.fn(),
}));

vi.mock("../src/utils/config.js", () => ({
  config: { hostedApiUrl: "https://api.test", mode: "hosted", embeddingModel: "text-embedding-3-small" },
  clientId: "test-client-id",
  isHostedMode: () => true,
  isLocalMode: () => false,
  DEFAULT_REPOSITORIES: [
    { owner: "midnightntwrk", repo: "compact", branch: "main", patterns: [], exclude: [] },
  ],
}));

vi.mock("../src/utils/index.js", () => ({
  config: { hostedApiUrl: "https://api.test" },
  isHostedMode: () => true,
  isLocalMode: () => false,
  DEFAULT_REPOSITORIES: [
    { owner: "midnightntwrk", repo: "compact", branch: "main", patterns: [], exclude: [] },
  ],
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  MCPError: class extends Error {
    code: string;
    suggestion?: string;
    constructor(m: string, c: string, s?: string) {
      super(m);
      this.code = c;
      this.suggestion = s;
    }
  },
  ErrorCodes: { INVALID_INPUT: "INVALID_INPUT", NOT_FOUND: "RESOURCE_NOT_FOUND", UNKNOWN_REPO: "UNKNOWN_REPOSITORY" },
  SelfCorrectionHints: {
    UNKNOWN_REPO: (repo: string, validRepos: string[]) => ({
      error: `Unknown repository: '${repo}'`,
      code: "UNKNOWN_REPOSITORY",
      suggestion: `Try one of these instead: ${validRepos.slice(0, 8).join(", ")}`,
    }),
    FILE_NOT_FOUND: (path: string, repo: string) => ({
      error: `File not found: '${path}' in ${repo}`,
      code: "RESOURCE_NOT_FOUND",
      suggestion: "Check the file path.",
    }),
    INVALID_VERSION: (version: string, example: string) => ({
      error: `Invalid version format: '${version}'`,
      code: "INVALID_VERSION",
      suggestion: `Version should be like '${example}'.`,
    }),
  },
  validateQuery: (q: string) => ({
    isValid: q.length >= 2,
    errors: q.length < 2 ? ["too short"] : [],
    warnings: [],
    sanitized: q.trim(),
  }),
  validateNumber: (_v: unknown, opts: { defaultValue: number }) => ({ value: opts.defaultValue, warnings: [] }),
  searchCache: { get: () => null, set: vi.fn() },
  createCacheKey: (...args: unknown[]) => args.join(":"),
  searchCompactHosted: vi.fn(),
  searchTypeScriptHosted: vi.fn(),
  searchDocsHosted: vi.fn(),
  extractContentFromHtml: vi.fn(),
}));

vi.mock("../src/pipeline/index.js", () => ({
  githubClient: {
    getFileContent: mockGetFileContent,
    getRecentCommits: mockGetRecentCommits,
  },
}));

vi.mock("../src/pipeline/releases.js", () => ({
  releaseTracker: {
    getVersionInfo: mockGetVersionInfo,
    isOutdated: mockIsOutdated,
    getBreakingChangesSince: mockGetBreakingChangesSince,
    getFileAtVersion: mockGetFileAtVersion,
    compareSyntax: mockCompareSyntax,
    checkBreakingChanges: mockCheckBreakingChanges,
    getMigrationGuide: mockGetMigrationGuide,
  },
}));

vi.mock("../src/pipeline/embeddings.js", () => ({
  embeddingGenerator: { isDummyMode: false },
}));

vi.mock("../src/db/index.js", () => ({
  vectorStore: { search: vi.fn(async () => []) },
}));

vi.mock("../src/utils/version.js", () => ({
  CURRENT_VERSION: "0.0.0-test",
}));

vi.mock("../src/server.js", () => ({
  sendProgressNotification: vi.fn(),
}));

import {
  resolveRepo,
  getFile,
  listExamples,
  getLatestUpdates,
  checkBreakingChanges,
  getFileAtVersion,
  compareSyntax,
} from "../src/tools/repository/handlers.js";

describe("resolveRepo — alias resolution", () => {
  it("resolves 'compact' to midnightntwrk/compact", () => {
    const result = resolveRepo("compact");
    expect(result).toEqual({ owner: "midnightntwrk", repo: "compact" });
  });

  it("resolves short alias 'js' to midnight-js", () => {
    const result = resolveRepo("js");
    expect(result).toEqual({ owner: "midnightntwrk", repo: "midnight-js" });
  });

  it("resolves 'sdk' to midnight-js", () => {
    const result = resolveRepo("sdk");
    expect(result).toEqual({ owner: "midnightntwrk", repo: "midnight-js" });
  });

  it("resolves 'counter' to example-counter", () => {
    const result = resolveRepo("counter");
    expect(result).toEqual({ owner: "midnightntwrk", repo: "example-counter" });
  });

  it("resolves 'docs' to midnight-docs", () => {
    const result = resolveRepo("docs");
    expect(result).toEqual({ owner: "midnightntwrk", repo: "midnight-docs" });
  });

  it("strips midnightntwrk/ prefix", () => {
    const result = resolveRepo("midnightntwrk/compact");
    expect(result).toEqual({ owner: "midnightntwrk", repo: "compact" });
  });

  it("handles org/repo format for unknown repos", () => {
    const result = resolveRepo("someorg/somerepo");
    expect(result).toEqual({ owner: "someorg", repo: "somerepo" });
  });

  it("returns null for unknown single-word repo", () => {
    const result = resolveRepo("nonexistent-repo-xyz");
    expect(result).toBeNull();
  });

  it("defaults to compact when no repo provided", () => {
    const result = resolveRepo();
    expect(result).toEqual({ owner: "midnightntwrk", repo: "compact" });
  });

  it("is case-insensitive", () => {
    const result = resolveRepo("COMPACT");
    expect(result).toEqual({ owner: "midnightntwrk", repo: "compact" });
  });
});

describe("getFile — happy path and truncation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns file content for a valid repo and path", async () => {
    mockGetFileContent.mockResolvedValueOnce({
      content: "export circuit main() {}",
      path: "src/main.compact",
      sha: "abc123",
      size: 24,
    });

    const result = await getFile({ repo: "compact", path: "src/main.compact" });

    expect(result.content).toBe("export circuit main() {}");
    expect(result.repository).toBe("midnightntwrk/compact");
    expect(result.path).toBe("src/main.compact");
    expect(result.truncated).toBe(false);
  });

  it("extracts line range when startLine and endLine are provided", async () => {
    mockGetFileContent.mockResolvedValueOnce({
      content: "line1\nline2\nline3\nline4\nline5",
      path: "src/test.ts",
      sha: "abc123",
      size: 29,
    });

    const result = await getFile({
      repo: "compact",
      path: "src/test.ts",
      startLine: 2,
      endLine: 4,
    });

    expect(result.content).toBe("line2\nline3\nline4");
    expect(result.lineRange).toEqual({ start: 2, end: 4 });
  });

  it("throws MCPError when startLine > endLine", async () => {
    mockGetFileContent.mockResolvedValueOnce({
      content: "line1\nline2\nline3",
      path: "src/test.ts",
      sha: "abc123",
      size: 17,
    });

    await expect(
      getFile({ repo: "compact", path: "src/test.ts", startLine: 5, endLine: 2 }),
    ).rejects.toThrow("Invalid line range");
  });

  it("truncates large files and includes agent guidance", async () => {
    const largeContent = "x".repeat(60000);
    mockGetFileContent.mockResolvedValueOnce({
      content: largeContent,
      path: "src/big.compact",
      sha: "abc123",
      size: 60000,
    });

    const result = await getFile({ repo: "compact", path: "src/big.compact" });

    expect(result.truncated).toBe(true);
    expect(result.truncationInfo).toBeDefined();
    expect(result.agentGuidance).toBeDefined();
    expect(result.agentGuidance?.howToGetMore).toBeDefined();
    expect(result.content).toContain("CONTENT TRUNCATED");
  });

  it("uses language-aware truncation ratios for .compact files", async () => {
    const largeContent = "x".repeat(60000);
    mockGetFileContent.mockResolvedValueOnce({
      content: largeContent,
      path: "src/contract.compact",
      sha: "abc123",
      size: 60000,
    });

    const result = await getFile({ repo: "compact", path: "src/contract.compact" });

    expect(result.truncationInfo?.language).toBe("compact");
    expect(result.truncationInfo?.ratioUsed).toEqual({ top: 0.8, bottom: 0.2 });
  });

  it("uses balanced truncation ratios for .ts files", async () => {
    const largeContent = "x".repeat(60000);
    mockGetFileContent.mockResolvedValueOnce({
      content: largeContent,
      path: "src/api.ts",
      sha: "abc123",
      size: 60000,
    });

    const result = await getFile({ repo: "compact", path: "src/api.ts" });

    expect(result.truncationInfo?.language).toBe("typescript");
    expect(result.truncationInfo?.ratioUsed).toEqual({ top: 0.5, bottom: 0.5 });
  });
});

describe("getFile — error handling and self-correction hints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws with UNKNOWN_REPO hint for unresolvable repo", async () => {
    await expect(
      getFile({ repo: "nonexistent-repo-xyz", path: "README.md" }),
    ).rejects.toThrow("Unknown repository");
  });

  it("throws with FILE_NOT_FOUND hint when file doesn't exist", async () => {
    mockGetFileContent.mockResolvedValueOnce(null);

    await expect(
      getFile({ repo: "compact", path: "nonexistent/path.ts" }),
    ).rejects.toThrow("File not found");
  });
});

describe("listExamples — category filtering", () => {
  it("returns all examples when category is 'all'", async () => {
    const result = await listExamples({ category: "all" });

    expect(result.examples.length).toBeGreaterThan(0);
    expect(result.totalCount).toBe(result.examples.length);
    expect(result.categories.length).toBeGreaterThan(0);
  });

  it("filters by specific category", async () => {
    const result = await listExamples({ category: "counter" });

    expect(result.totalCount).toBeGreaterThan(0);
    for (const example of result.examples) {
      expect(example).toHaveProperty("name");
      expect(example).toHaveProperty("repository");
      expect(example).toHaveProperty("githubUrl");
    }
  });

  it("returns empty for category with no matches", async () => {
    const result = await listExamples({ category: "voting" });

    // May or may not have voting examples, but should return a valid structure
    expect(result).toHaveProperty("examples");
    expect(result).toHaveProperty("totalCount");
    expect(result).toHaveProperty("categories");
  });

  it("includes githubUrl for all examples", async () => {
    const result = await listExamples({ category: "all" });

    for (const example of result.examples) {
      expect(example.githubUrl).toMatch(/^https:\/\/github\.com\//);
    }
  });
});

describe("getLatestUpdates — recent changes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns updates sorted by most recent commit", async () => {
    mockGetRecentCommits.mockImplementation(async (_o: string, repo: string) => {
      if (repo === "compact") {
        return [
          { sha: "abc1234", message: "feat: add new circuit\ndetail line", date: "2026-03-20T00:00:00Z", author: "dev1", url: "https://github.com/..." },
        ];
      }
      return [];
    });

    const result = await getLatestUpdates({});

    expect(result.summary).toBeDefined();
    expect(result.summary.totalCommits).toBeGreaterThanOrEqual(1);
    expect(result.updates).toBeDefined();
    // Commit message should be truncated to first line
    const compactUpdate = result.updates.find((u: { repository: string }) => u.repository.includes("compact"));
    if (compactUpdate?.latestCommit) {
      expect(compactUpdate.latestCommit.message).toBe("feat: add new circuit");
      expect(compactUpdate.latestCommit.message).not.toContain("\n");
    }
  });

  it("returns empty updates when no repos have recent commits", async () => {
    mockGetRecentCommits.mockResolvedValue([]);

    const result = await getLatestUpdates({});

    expect(result.summary.totalCommits).toBe(0);
    expect(result.summary.activeRepositories).toBe(0);
    expect(result.updates).toEqual([]);
  });
});

describe("checkBreakingChanges — version comparison", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns breaking changes info for a valid repo", async () => {
    mockIsOutdated.mockResolvedValueOnce({
      isOutdated: true,
      latestVersion: "v2.0.0",
      versionsBehind: 3,
      hasBreakingChanges: true,
    });
    mockGetBreakingChangesSince.mockResolvedValueOnce([
      { version: "v2.0.0", description: "API changed" },
    ]);

    const result = await checkBreakingChanges({ repo: "compact", currentVersion: "v1.0.0" });

    expect(result.repository).toBe("midnightntwrk/compact");
    expect(result.isOutdated).toBe(true);
    expect(result.hasBreakingChanges).toBe(true);
    expect(result.breakingChanges).toHaveLength(1);
    expect(result.recommendation).toContain("Breaking changes detected");
  });

  it("returns safe-to-upgrade when no breaking changes", async () => {
    mockIsOutdated.mockResolvedValueOnce({
      isOutdated: true,
      latestVersion: "v1.1.0",
      versionsBehind: 1,
      hasBreakingChanges: false,
    });
    mockGetBreakingChangesSince.mockResolvedValueOnce([]);

    const result = await checkBreakingChanges({ repo: "compact", currentVersion: "v1.0.0" });

    expect(result.hasBreakingChanges).toBe(false);
    expect(result.recommendation).toContain("Safe to upgrade");
  });

  it("returns already-latest when not outdated", async () => {
    mockIsOutdated.mockResolvedValueOnce({
      isOutdated: false,
      latestVersion: "v1.0.0",
      versionsBehind: 0,
      hasBreakingChanges: false,
    });
    mockGetBreakingChangesSince.mockResolvedValueOnce([]);

    const result = await checkBreakingChanges({ repo: "compact", currentVersion: "v1.0.0" });

    expect(result.recommendation).toContain("latest version");
  });

  it("throws for unknown repo", async () => {
    await expect(
      checkBreakingChanges({ repo: "nonexistent-xyz", currentVersion: "v1.0.0" }),
    ).rejects.toThrow("Unknown repository");
  });
});

describe("getFileAtVersion — versioned file retrieval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns file content at a specific version", async () => {
    mockGetFileAtVersion.mockResolvedValueOnce({
      content: "pragma language_version >= 0.30;",
      version: "v0.30.0",
    });

    const result = await getFileAtVersion({ repo: "compact", path: "src/main.compact", version: "v0.30.0" });

    expect(result.repository).toBe("midnightntwrk/compact");
    expect(result.content).toBe("pragma language_version >= 0.30;");
    expect(result.version).toBe("v0.30.0");
    expect(result.truncated).toBe(false);
    expect(result.note).toContain("v0.30.0");
  });

  it("throws when file not found at version", async () => {
    mockGetFileAtVersion.mockResolvedValueOnce(null);

    await expect(
      getFileAtVersion({ repo: "compact", path: "missing.ts", version: "v1.0.0" }),
    ).rejects.toThrow("File not found");
  });

  it("throws for unknown repo", async () => {
    await expect(
      getFileAtVersion({ repo: "nonexistent-xyz", path: "file.ts", version: "v1.0.0" }),
    ).rejects.toThrow("Unknown repository");
  });

  it("truncates large versioned files", async () => {
    mockGetFileAtVersion.mockResolvedValueOnce({
      content: "x".repeat(60000),
      version: "v1.0.0",
    });

    const result = await getFileAtVersion({ repo: "compact", path: "src/big.compact", version: "v1.0.0" });

    expect(result.truncated).toBe(true);
    expect(result.truncationInfo).toBeDefined();
  });
});

describe("compareSyntax — version comparison", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("compares file content between two versions", async () => {
    mockCompareSyntax.mockResolvedValueOnce({
      oldVersion: "v0.29.0",
      newVersion: "v0.30.0",
      oldContent: "old code",
      newContent: "new code",
      hasDifferences: true,
    });

    const result = await compareSyntax({
      repo: "compact",
      path: "src/main.compact",
      oldVersion: "v0.29.0",
      newVersion: "v0.30.0",
    });

    expect(result.repository).toBe("midnightntwrk/compact");
    expect(result.hasDifferences).toBe(true);
    expect(result.oldContent).toBe("old code");
    expect(result.newContent).toBe("new code");
    expect(result.recommendation).toContain("has changed");
  });

  it("reports no differences when content is the same", async () => {
    mockCompareSyntax.mockResolvedValueOnce({
      oldVersion: "v0.29.0",
      newVersion: "v0.30.0",
      oldContent: "same code",
      newContent: "same code",
      hasDifferences: false,
    });

    const result = await compareSyntax({
      repo: "compact",
      path: "src/main.compact",
      oldVersion: "v0.29.0",
      newVersion: "v0.30.0",
    });

    expect(result.hasDifferences).toBe(false);
    expect(result.recommendation).toContain("No changes");
  });

  it("defaults newVersion to latest when not provided", async () => {
    mockGetVersionInfo.mockResolvedValueOnce({
      latestStableRelease: { tag: "v0.31.0" },
      latestRelease: { tag: "v0.31.0" },
    });
    mockCompareSyntax.mockResolvedValueOnce({
      oldVersion: "v0.29.0",
      newVersion: "v0.31.0",
      oldContent: "old",
      newContent: "new",
      hasDifferences: true,
    });

    const result = await compareSyntax({
      repo: "compact",
      path: "src/main.compact",
      oldVersion: "v0.29.0",
    });

    expect(result.newVersion).toBe("v0.31.0");
  });

  it("throws for unknown repo", async () => {
    await expect(
      compareSyntax({ repo: "nonexistent-xyz", path: "file.ts", oldVersion: "v1.0.0" }),
    ).rejects.toThrow("Unknown repository");
  });
});
