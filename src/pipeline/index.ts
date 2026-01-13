export { GitHubClient, githubClient } from "./github.js";
export type { GitHubFile, GitHubCommit, RepositoryInfo } from "./github.js";

export {
  parseFile,
  parseCompactFile,
  parseTypeScriptFile,
  parseMarkdownFile,
  LANGUAGES,
  EXTENSION_LANGUAGE_MAP,
} from "./parser.js";
export type { ParsedFile, CodeUnit, Language } from "./parser.js";

export { EmbeddingGenerator, embeddingGenerator } from "./embeddings.js";
export type { EmbeddingResult } from "./embeddings.js";

export {
  indexRepository,
  indexAllRepositories,
  incrementalUpdate,
} from "./indexer.js";
export type { IndexStats } from "./indexer.js";

export { ReleaseTracker, releaseTracker } from "./releases.js";
export type { Release, ChangelogEntry, VersionInfo } from "./releases.js";
