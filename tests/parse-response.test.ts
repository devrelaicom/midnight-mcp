/**
 * Tests for the parseJsonResponse helper and Zod boundary validation patterns.
 * Covers valid responses, missing fields, empty arrays, and wrong types.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { parseJsonResponse, validateJson } from "../src/utils/parse-response.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// parseJsonResponse
// ---------------------------------------------------------------------------

describe("parseJsonResponse", () => {
  const schema = z.object({ version: z.string() });

  it("returns validated data for a valid response", async () => {
    const response = mockResponse({ version: "1.0.0" });
    const result = await parseJsonResponse(response, schema, "npm");
    expect(result).toEqual({ version: "1.0.0" });
  });

  it("throws MCPError for missing required fields", async () => {
    const response = mockResponse({});
    await expect(parseJsonResponse(response, schema, "npm")).rejects.toThrow(
      /Invalid response from npm/,
    );
  });

  it("throws MCPError for wrong types", async () => {
    const response = mockResponse({ version: 123 });
    await expect(parseJsonResponse(response, schema, "npm")).rejects.toThrow(
      /Invalid response from npm/,
    );
  });

  it("includes field path in error message", async () => {
    const nestedSchema = z.object({
      data: z.object({ id: z.number() }),
    });
    const response = mockResponse({ data: { id: "not-a-number" } });
    await expect(parseJsonResponse(response, nestedSchema, "api")).rejects.toThrow("data.id");
  });
});

// ---------------------------------------------------------------------------
// validateJson
// ---------------------------------------------------------------------------

describe("validateJson", () => {
  it("returns validated data for valid input", () => {
    const schema = z.object({ name: z.string() });
    expect(validateJson({ name: "test" }, schema, "test")).toEqual({ name: "test" });
  });

  it("throws MCPError for invalid input", () => {
    const schema = z.object({ name: z.string() });
    expect(() => validateJson({}, schema, "test")).toThrow(/Invalid response from test/);
  });
});

// ---------------------------------------------------------------------------
// OpenAI embeddings schema pattern
// ---------------------------------------------------------------------------

describe("OpenAI embeddings validation", () => {
  const EmbeddingResponseSchema = z.object({
    data: z.array(z.object({ embedding: z.array(z.number()) })).min(1),
  });

  it("accepts valid embedding response", () => {
    const response = { data: [{ embedding: [0.1, 0.2, 0.3] }] };
    const result = EmbeddingResponseSchema.parse(response);
    expect(result.data[0]!.embedding).toEqual([0.1, 0.2, 0.3]);
  });

  it("rejects empty data array", () => {
    const response = { data: [] };
    expect(() => EmbeddingResponseSchema.parse(response)).toThrow();
  });

  it("rejects missing embedding field", () => {
    const response = { data: [{}] };
    expect(() => EmbeddingResponseSchema.parse(response)).toThrow();
  });

  it("rejects non-numeric embedding values", () => {
    const response = { data: [{ embedding: ["not", "numbers"] }] };
    expect(() => EmbeddingResponseSchema.parse(response)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// GitHub OAuth schema patterns
// ---------------------------------------------------------------------------

describe("GitHub OAuth validation", () => {
  const GitHubUserSchema = z.object({
    id: z.number(),
    login: z.string(),
    email: z.string().nullable(),
  });

  it("accepts valid user profile", () => {
    const user = { id: 123, login: "octocat", email: "cat@github.com" };
    expect(GitHubUserSchema.parse(user)).toEqual(user);
  });

  it("accepts null email", () => {
    const user = { id: 123, login: "octocat", email: null };
    expect(GitHubUserSchema.parse(user)).toEqual(user);
  });

  it("rejects missing login field", () => {
    const user = { id: 123, email: null };
    expect(() => GitHubUserSchema.parse(user)).toThrow();
  });

  it("rejects non-numeric id", () => {
    const user = { id: "abc", login: "octocat", email: null };
    expect(() => GitHubUserSchema.parse(user)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// npm version check schema pattern
// ---------------------------------------------------------------------------

describe("npm version check validation", () => {
  const NpmVersionSchema = z.object({ version: z.string() });

  it("accepts valid version response", () => {
    expect(NpmVersionSchema.parse({ version: "1.0.0" })).toEqual({ version: "1.0.0" });
  });

  it("rejects missing version", () => {
    expect(() => NpmVersionSchema.parse({})).toThrow();
  });

  it("rejects non-string version", () => {
    expect(() => NpmVersionSchema.parse({ version: 100 })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Playground response schema patterns
// ---------------------------------------------------------------------------

describe("Playground response validation", () => {
  it("validates compile result with loose mode", () => {
    const CompileResultSchema = z
      .object({ success: z.boolean() })
      .loose();

    const response = { success: true, output: "compiled", extraField: 42 };
    const result = CompileResultSchema.parse(response);
    expect(result.success).toBe(true);
    expect(result.extraField).toBe(42); // Extra fields preserved
  });

  it("rejects compile result without success field", () => {
    const CompileResultSchema = z.object({ success: z.boolean() }).loose();
    expect(() => CompileResultSchema.parse({ output: "compiled" })).toThrow();
  });
});
