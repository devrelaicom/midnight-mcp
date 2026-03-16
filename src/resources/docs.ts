/**
 * Documentation resources
 * Provides access to Midnight documentation via MCP resources
 */

import { githubClient } from "../pipeline/index.js";
import { logger } from "../utils/index.js";
import type { ResourceDefinition } from "./schemas.js";

// Documentation resource URIs
// Embedded docs have been migrated to midnight-expert skills.
// Use search_docs tool which queries the Vector DB for the full midnight-docs repo.
export const documentationResources: ResourceDefinition[] = [];

/**
 * Get documentation content by URI
 */
export async function getDocumentation(uri: string): Promise<string | null> {
  // Try to fetch from GitHub if it's a doc path
  if (uri.startsWith("midnight://docs/")) {
    const docPath = uri.replace("midnight://docs/", "");
    try {
      const file = await githubClient.getFileContent(
        "midnightntwrk",
        "midnight-docs",
        `docs/${docPath}.md`,
      );
      if (file) {
        return file.content;
      }
    } catch (_error: unknown) {
      logger.warn(`Could not fetch doc from GitHub: ${uri}`);
    }
  }

  return null;
}

/**
 * List all available documentation resources
 */
export function listDocumentationResources(): ResourceDefinition[] {
  return documentationResources;
}
