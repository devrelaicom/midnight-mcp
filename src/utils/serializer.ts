/**
 * Output serialization utilities
 *
 * Provides YAML (default) and JSON output formats for tool responses.
 * YAML is more token-efficient for LLM consumption (~20-30% fewer tokens).
 */

import yaml from "js-yaml";

// Global output format configuration
let useJsonOutput = false;

/**
 * Reset all module-level mutable state to initial values.
 * Used for test isolation.
 */
export function resetSerializerState(): void {
  useJsonOutput = false;
}

/**
 * Set the output format for tool responses
 * @param json - If true, use JSON output. If false, use YAML (default).
 */
export function setOutputFormat(json: boolean): void {
  useJsonOutput = json;
}

/**
 * Get the current output format
 */
export function isJsonOutput(): boolean {
  return useJsonOutput;
}

/**
 * Serialize data for tool response output
 *
 * @param data - The data to serialize
 * @returns Formatted string (YAML by default, JSON if --json flag was used)
 */
export function serialize(data: unknown): string {
  if (useJsonOutput) {
    return JSON.stringify(data, null, 2);
  }

  // YAML output (default) - more token-efficient for LLMs
  try {
    return yaml.dump(data, {
      indent: 2,
      lineWidth: 120,
      noRefs: true, // Avoid YAML anchors/aliases for cleaner output
      quotingType: '"',
      forceQuotes: false,
      sortKeys: false, // Preserve object key order
    });
  } catch {
    // Fallback to JSON if YAML serialization fails
    return JSON.stringify(data, null, 2);
  }
}

/**
 * Get the MIME type for the current output format
 */
export function getOutputMimeType(): string {
  return useJsonOutput ? "application/json" : "text/yaml";
}
