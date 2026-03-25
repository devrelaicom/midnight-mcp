/**
 * Validated JSON response parser.
 *
 * Convention: every external JSON boundary must be parsed through a Zod schema
 * before returning typed data. Use this helper at service boundaries.
 */

import { z } from "zod";
import { MCPError, ErrorCodes } from "./errors.js";

/**
 * Parse a fetch Response as JSON and validate against a Zod schema.
 *
 * @throws {MCPError} if the response body does not match the schema.
 */
export async function parseJsonResponse<T>(
  response: Response,
  schema: z.ZodType<T>,
  context: string,
): Promise<T> {
  const raw: unknown = await response.json();
  const result = schema.safeParse(raw);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const detail = firstIssue
      ? `${firstIssue.path.join(".")}: ${firstIssue.message}`
      : "unknown validation error";
    throw new MCPError(`Invalid response from ${context}: ${detail}`, ErrorCodes.INTERNAL_ERROR);
  }
  return result.data;
}

/**
 * Validate an already-parsed JSON value against a Zod schema.
 *
 * @throws {MCPError} if the value does not match the schema.
 */
export function validateJson<T>(raw: unknown, schema: z.ZodType<T>, context: string): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const detail = firstIssue
      ? `${firstIssue.path.join(".")}: ${firstIssue.message}`
      : "unknown validation error";
    throw new MCPError(`Invalid response from ${context}: ${detail}`, ErrorCodes.INTERNAL_ERROR);
  }
  return result.data;
}
