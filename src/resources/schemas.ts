export interface ResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

// Schema resources
// Embedded schemas have been migrated to midnight-expert skills.
export const schemaResources: ResourceDefinition[] = [];

/**
 * Get schema content by URI
 */
export function getSchema(_uri: string): object | null {
  return null;
}

/**
 * List all available schema resources
 */
export function listSchemaResources(): ResourceDefinition[] {
  return schemaResources;
}
