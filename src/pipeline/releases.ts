import { Octokit } from "octokit";
import { config, logger } from "../utils/index.js";

export interface Release {
  tag: string;
  name: string;
  body: string;
  publishedAt: string;
  url: string;
  isPrerelease: boolean;
  assets: Array<{ name: string; downloadUrl: string }>;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: {
    breaking: string[];
    features: string[];
    fixes: string[];
    deprecations: string[];
  };
  rawBody: string;
}

export interface VersionInfo {
  repository: string;
  latestRelease: Release | null;
  latestStableRelease: Release | null;
  recentReleases: Release[];
  changelog: ChangelogEntry[];
  lastChecked: string;
}

/**
 * Fetches and tracks releases from GitHub repositories
 */
export class ReleaseTracker {
  private octokit: Octokit;
  private cache: Map<string, VersionInfo> = new Map();
  private cacheMaxAge = 1000 * 60 * 15; // 15 minutes

  constructor(token?: string) {
    this.octokit = new Octokit({
      auth: token || config.githubToken,
    });
  }

  /**
   * Get all releases for a repository
   */
  async getReleases(
    owner: string,
    repo: string,
    limit = 20
  ): Promise<Release[]> {
    try {
      const { data } = await this.octokit.rest.repos.listReleases({
        owner,
        repo,
        per_page: limit,
      });

      return data.map((release) => ({
        tag: release.tag_name,
        name: release.name || release.tag_name,
        body: release.body || "",
        publishedAt: release.published_at || release.created_at,
        url: release.html_url,
        isPrerelease: release.prerelease,
        assets: release.assets.map((asset) => ({
          name: asset.name,
          downloadUrl: asset.browser_download_url,
        })),
      }));
    } catch (error: unknown) {
      logger.warn(`Failed to fetch releases for ${owner}/${repo}`, {
        error: String(error),
      });
      return [];
    }
  }

  /**
   * Parse a release body to extract structured changelog info
   */
  parseChangelog(
    releaseBody: string,
    version: string,
    date: string
  ): ChangelogEntry {
    const changes: ChangelogEntry["changes"] = {
      breaking: [],
      features: [],
      fixes: [],
      deprecations: [],
    };

    const lines = releaseBody.split("\n");
    let currentSection: keyof typeof changes | null = null;

    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();

      // Detect section headers
      if (trimmed.includes("breaking") || trimmed.includes("⚠️")) {
        currentSection = "breaking";
        continue;
      }
      if (
        trimmed.includes("feature") ||
        trimmed.includes("added") ||
        trimmed.includes("✨") ||
        trimmed.includes("🚀")
      ) {
        currentSection = "features";
        continue;
      }
      if (
        trimmed.includes("fix") ||
        trimmed.includes("bug") ||
        trimmed.includes("🐛") ||
        trimmed.includes("🔧")
      ) {
        currentSection = "fixes";
        continue;
      }
      if (trimmed.includes("deprecat") || trimmed.includes("⚠")) {
        currentSection = "deprecations";
        continue;
      }

      // Extract list items
      if (
        currentSection &&
        (line.startsWith("-") || line.startsWith("*") || line.match(/^\d+\./))
      ) {
        const content = line.replace(/^[-*]\s*|\d+\.\s*/, "").trim();
        if (content) {
          changes[currentSection].push(content);
        }
      }
    }

    return {
      version,
      date,
      changes,
      rawBody: releaseBody,
    };
  }

  /**
   * Get version info for a repository with caching
   */
  async getVersionInfo(owner: string, repo: string): Promise<VersionInfo> {
    const repoKey = `${owner}/${repo}`;
    const cached = this.cache.get(repoKey);

    if (cached) {
      const age = Date.now() - new Date(cached.lastChecked).getTime();
      if (age < this.cacheMaxAge) {
        return cached;
      }
    }

    const releases = await this.getReleases(owner, repo);
    const latestRelease = releases[0] || null;
    const latestStableRelease = releases.find((r) => !r.isPrerelease) || null;

    const changelog = releases.map((r) =>
      this.parseChangelog(r.body, r.tag, r.publishedAt)
    );

    const info: VersionInfo = {
      repository: repoKey,
      latestRelease,
      latestStableRelease,
      recentReleases: releases.slice(0, 10),
      changelog,
      lastChecked: new Date().toISOString(),
    };

    this.cache.set(repoKey, info);
    return info;
  }

  /**
   * Get breaking changes since a specific version
   */
  async getBreakingChangesSince(
    owner: string,
    repo: string,
    sinceVersion: string
  ): Promise<string[]> {
    const info = await this.getVersionInfo(owner, repo);
    const breakingChanges: string[] = [];

    for (const entry of info.changelog) {
      // Stop if we've reached the version they're using
      if (entry.version === sinceVersion) break;
      breakingChanges.push(...entry.changes.breaking);
    }

    return breakingChanges;
  }

  /**
   * Check if a version is outdated
   */
  async isOutdated(
    owner: string,
    repo: string,
    currentVersion: string
  ): Promise<{
    isOutdated: boolean;
    latestVersion: string | null;
    versionsBehind: number;
    hasBreakingChanges: boolean;
  }> {
    const info = await this.getVersionInfo(owner, repo);
    const latestVersion =
      info.latestStableRelease?.tag || info.latestRelease?.tag || null;

    if (!latestVersion) {
      return {
        isOutdated: false,
        latestVersion: null,
        versionsBehind: 0,
        hasBreakingChanges: false,
      };
    }

    const releaseIndex = info.recentReleases.findIndex(
      (r) => r.tag === currentVersion
    );
    const versionsBehind =
      releaseIndex === -1 ? info.recentReleases.length : releaseIndex;

    const breakingChanges = await this.getBreakingChangesSince(
      owner,
      repo,
      currentVersion
    );

    return {
      isOutdated: currentVersion !== latestVersion,
      latestVersion,
      versionsBehind,
      hasBreakingChanges: breakingChanges.length > 0,
    };
  }

  /**
   * Get migration guide between two versions
   */
  async getMigrationGuide(
    owner: string,
    repo: string,
    fromVersion: string,
    toVersion?: string
  ): Promise<{
    from: string;
    to: string;
    breakingChanges: string[];
    deprecations: string[];
    newFeatures: string[];
    migrationSteps: string[];
  }> {
    const info = await this.getVersionInfo(owner, repo);
    const to =
      toVersion ||
      info.latestStableRelease?.tag ||
      info.latestRelease?.tag ||
      fromVersion;

    const result = {
      from: fromVersion,
      to,
      breakingChanges: [] as string[],
      deprecations: [] as string[],
      newFeatures: [] as string[],
      migrationSteps: [] as string[],
    };

    let inRange = false;
    for (const entry of [...info.changelog].reverse()) {
      if (entry.version === fromVersion) {
        inRange = true;
        continue;
      }
      if (entry.version === to) {
        result.breakingChanges.push(...entry.changes.breaking);
        result.deprecations.push(...entry.changes.deprecations);
        result.newFeatures.push(...entry.changes.features);
        break;
      }
      if (inRange) {
        result.breakingChanges.push(...entry.changes.breaking);
        result.deprecations.push(...entry.changes.deprecations);
        result.newFeatures.push(...entry.changes.features);
      }
    }

    // Generate migration steps from breaking changes
    result.migrationSteps = result.breakingChanges.map(
      (change) => `Review and update: ${change}`
    );

    return result;
  }

  /**
   * Get version-specific documentation hints
   */
  getVersionContext(versionInfo: VersionInfo): string {
    const parts: string[] = [];

    if (versionInfo.latestRelease) {
      parts.push(
        `Latest version: ${versionInfo.latestRelease.tag} (${versionInfo.latestRelease.publishedAt.split("T")[0]})`
      );
    }

    if (
      versionInfo.latestStableRelease &&
      versionInfo.latestStableRelease !== versionInfo.latestRelease
    ) {
      parts.push(`Latest stable: ${versionInfo.latestStableRelease.tag}`);
    }

    const recentBreaking = versionInfo.changelog
      .slice(0, 3)
      .flatMap((c) => c.changes.breaking);

    if (recentBreaking.length > 0) {
      parts.push(
        `Recent breaking changes:\n${recentBreaking.map((b) => `  - ${b}`).join("\n")}`
      );
    }

    return parts.join("\n");
  }

  /**
   * Fetch a file at a specific version/tag
   * This is critical for ensuring code recommendations match the user's version
   */
  async getFileAtVersion(
    owner: string,
    repo: string,
    filePath: string,
    version: string
  ): Promise<{ content: string; version: string } | null> {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref: version, // Can be a tag like "v1.0.0" or branch
      });

      if (Array.isArray(data) || data.type !== "file") {
        return null;
      }

      const content =
        data.encoding === "base64"
          ? Buffer.from(data.content, "base64").toString("utf-8")
          : data.content;

      return { content, version };
    } catch (error: unknown) {
      logger.warn(
        `Failed to fetch ${filePath} at ${version} from ${owner}/${repo}`,
        {
          error: String(error),
        }
      );
      return null;
    }
  }

  /**
   * Compare syntax between two versions of a file
   * Useful for showing what changed in API/syntax
   */
  async compareSyntax(
    owner: string,
    repo: string,
    filePath: string,
    oldVersion: string,
    newVersion: string
  ): Promise<{
    oldVersion: string;
    newVersion: string;
    oldContent: string | null;
    newContent: string | null;
    hasDifferences: boolean;
  }> {
    const [oldFile, newFile] = await Promise.all([
      this.getFileAtVersion(owner, repo, filePath, oldVersion),
      this.getFileAtVersion(owner, repo, filePath, newVersion),
    ]);

    return {
      oldVersion,
      newVersion,
      oldContent: oldFile?.content || null,
      newContent: newFile?.content || null,
      hasDifferences: oldFile?.content !== newFile?.content,
    };
  }

  /**
   * Get the grammar/syntax reference files at the latest version
   * These are the source of truth for valid Compact syntax
   */
  async getLatestSyntaxReference(
    owner: string,
    repo: string
  ): Promise<{
    version: string;
    syntaxFiles: Array<{ path: string; content: string }>;
  } | null> {
    const versionInfo = await this.getVersionInfo(owner, repo);
    const version =
      versionInfo.latestStableRelease?.tag ||
      versionInfo.latestRelease?.tag ||
      "main";

    // Key files that define Compact syntax
    const syntaxFilePaths = [
      "docs/grammar.md",
      "docs/syntax.md",
      "docs/reference.md",
      "src/grammar.ts",
      "grammar/compact.grammar",
      "README.md",
    ];

    const syntaxFiles: Array<{ path: string; content: string }> = [];

    for (const path of syntaxFilePaths) {
      const file = await this.getFileAtVersion(owner, repo, path, version);
      if (file) {
        syntaxFiles.push({ path, content: file.content });
      }
    }

    if (syntaxFiles.length === 0) {
      return null;
    }

    return { version, syntaxFiles };
  }
}

export const releaseTracker = new ReleaseTracker();
