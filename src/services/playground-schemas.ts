/**
 * Zod schemas for compact-playground API responses.
 *
 * Each schema validates the critical fields the code depends on.
 * `.loose()` allows the API to return extra fields without breaking validation.
 */

import { z } from "zod";

// ---- Base ----

const ErrorEntry = z.object({ message: z.string() }).loose();

// ---- Compile ----

export const CompileResultSchema = z
  .object({
    success: z.boolean(),
    output: z.string().optional(),
    errors: z.array(ErrorEntry).optional(),
    cacheKey: z.string().optional(),
  })
  .loose();

export const MultiVersionCompileResultSchema = z
  .object({
    success: z.boolean(),
    results: z.array(z.object({ version: z.string(), success: z.boolean() }).loose()),
  })
  .loose();

/** Discriminator: if `results` array is present → multi-version. */
export const CompileResponseSchema = z.union([
  MultiVersionCompileResultSchema,
  CompileResultSchema,
]);

// ---- Format ----

export const FormatResultSchema = z
  .object({
    success: z.boolean(),
    formatted: z.string(),
    changed: z.boolean(),
  })
  .loose();

// ---- Analyze ----

export const AnalyzeResultSchema = z
  .object({
    success: z.boolean(),
    mode: z.enum(["fast", "deep"]),
  })
  .loose();

// ---- Diff ----

export const DiffResultSchema = z
  .object({
    success: z.boolean(),
    hasChanges: z.boolean(),
  })
  .loose();

// ---- Visualize ----

export const VisualizeResultSchema = z.object({ success: z.boolean() }).loose();

// ---- Prove ----

export const ProveResultSchema = z.object({ success: z.boolean() }).loose();

// ---- Simulate ----
// Simulation has moved to src/services/simulator.ts (local execution).
// Schemas removed — the playground no longer hosts /simulate/* endpoints.

// ---- Versions ----

export const VersionsResultSchema = z
  .object({
    default: z.string(),
    installed: z.array(z.object({ version: z.string(), languageVersion: z.string() })),
  })
  .loose();

// ---- Libraries ----

export const LibrariesResultSchema = z
  .object({
    libraries: z.array(z.object({ name: z.string(), domain: z.string(), path: z.string() })),
  })
  .loose();

// ---- Health ----

export const PlaygroundHealthSchema = z
  .object({
    status: z.string(),
    compactCli: z.object({ installed: z.boolean(), version: z.string().optional() }).optional(),
  })
  .loose();
