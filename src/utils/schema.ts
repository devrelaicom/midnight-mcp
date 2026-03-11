/**
 * Utility to convert Zod schemas to JSON Schema for MCP tool inputSchema.
 * Eliminates manual duplication of schema definitions in tools.ts files.
 */

import { z } from "zod";
import type { ZodType } from "zod";

/**
 * Convert a Zod object schema to an MCP-compatible JSON Schema input definition.
 *
 * Handles:
 * - Stripping $schema and additionalProperties (not used by MCP)
 * - Computing `required` based on Zod optionality (not Zod's default-aware required)
 * - Works with `.refine()` / `.transform()` wrappers
 */
export function zodInputSchema(schema: ZodType): {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
} {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;

  // Strip JSON Schema meta-properties not used by MCP
  const rest = Object.fromEntries(
    Object.entries(jsonSchema).filter(
      ([key]) => key !== "$schema" && key !== "additionalProperties",
    ),
  );

  // Recompute `required` based on Zod optionality — fields with .optional()
  // or .default() should NOT be required from the caller's perspective.
  // We safe-parse `undefined` to determine optionality (recommended over deprecated isOptional).
  const properties = rest.properties as Record<string, unknown> | undefined;
  if (properties && "shape" in schema && typeof schema.shape === "object") {
    const shape = schema.shape as Record<string, ZodType>;
    const required: string[] = [];
    for (const key of Object.keys(properties)) {
      if (key in shape) {
        const isOptional = shape[key]?.safeParse(undefined).success ?? false;
        if (!isOptional) {
          required.push(key);
        }
      }
    }
    return {
      ...(rest as { type: "object"; properties: Record<string, unknown> }),
      ...(required.length > 0 ? { required } : {}),
    };
  }

  // Fallback: use whatever toJSONSchema produced (minus stripped fields)
  return rest as { type: "object"; properties: Record<string, unknown>; required?: string[] };
}
