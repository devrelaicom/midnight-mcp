/**
 * Playground API client.
 * All compact-playground interactions go through the API layer's /pg/* routes.
 */

import { z } from "zod";
import { config } from "../utils/config.js";
import { MCPError, ErrorCodes } from "../utils/index.js";
import {
  CompileResponseSchema,
  FormatResultSchema,
  AnalyzeResultSchema,
  DiffResultSchema,
  VisualizeResultSchema,
  ProveResultSchema,
  SimulateDeployResultSchema,
  SimulateCallResultSchema,
  SimulateStateResultSchema,
  SimulateDeleteResultSchema,
  VersionsResultSchema,
  LibrariesResultSchema,
  PlaygroundHealthSchema,
} from "./playground-schemas.js";

const TIMEOUT = 30000;
const MAX_CODE_SIZE = 100 * 1024;

function apiUrl(path: string): string {
  return `${config.hostedApiUrl}/pg${path}`;
}

export function buildCacheUrl(cacheKey: string): string {
  return `${config.hostedApiUrl}/pg/cached-response/${cacheKey}`;
}

// ---- HTTP helpers ----

async function request<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body: unknown,
  schema: z.ZodType,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, TIMEOUT);

  try {
    const options: RequestInit = { method, signal: controller.signal };

    if (body !== undefined) {
      options.headers = { "Content-Type": "application/json" };
      options.body = JSON.stringify(body);
    }

    const response = await fetch(apiUrl(path), options);

    if (response.status === 503) {
      throw new MCPError(
        "Compilation service unavailable — try again later",
        ErrorCodes.INTERNAL_ERROR,
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "Unknown error");
      throw new MCPError(`API error (${response.status}): ${text}`, ErrorCodes.INTERNAL_ERROR);
    }

    const raw: unknown = await response.json();
    const result = schema.safeParse(raw);
    if (!result.success) {
      const detail = result.error.issues[0]?.message ?? "unexpected shape";
      throw new MCPError(
        `Invalid response from playground${path}: ${detail}`,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
    return result.data as T;
  } catch (error) {
    if (error instanceof MCPError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new MCPError("Request timed out", ErrorCodes.INTERNAL_ERROR);
    }
    throw new MCPError(
      `Failed to connect to API: ${error instanceof Error ? error.message : "Unknown error"}`,
      ErrorCodes.INTERNAL_ERROR,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

function post<T>(path: string, body: unknown, schema: z.ZodType): Promise<T> {
  return request<T>("POST", path, body, schema);
}

function get<T>(path: string, schema: z.ZodType): Promise<T> {
  return request<T>("GET", path, undefined, schema);
}

function del<T>(path: string, schema: z.ZodType): Promise<T> {
  return request<T>("DELETE", path, undefined, schema);
}

// ---- Compile ----

export interface CompileOptions {
  wrapWithDefaults?: boolean;
  skipZk?: boolean;
  version?: string;
  includeBindings?: boolean;
  libraries?: string[];
}

export interface CompileResult {
  success: boolean;
  output?: string;
  errors?: Array<{
    file?: string;
    line?: number;
    column?: number;
    severity?: string;
    message: string;
  }>;
  executionTime?: number;
  compiledAt?: string;
  originalCode?: string;
  wrappedCode?: string;
  cacheKey?: string;
}

export interface MultiVersionCompileResult {
  success: boolean;
  results: Array<{
    version: string;
    requestedVersion: string;
    success: boolean;
    output?: string;
    errors?: Array<{
      message: string;
      line?: number;
      column?: number;
      severity?: string;
    }>;
    executionTime?: number;
  }>;
}

export async function compile(
  code: string,
  options: CompileOptions & { versions?: string[] } = {},
): Promise<CompileResult | MultiVersionCompileResult> {
  if (code.length > MAX_CODE_SIZE) {
    throw new MCPError(
      `Code exceeds maximum size of ${MAX_CODE_SIZE / 1024}KB`,
      ErrorCodes.INVALID_INPUT,
    );
  }

  const body: Record<string, unknown> = {
    code,
    options: {
      wrapWithDefaults: options.wrapWithDefaults ?? true,
      skipZk: options.skipZk ?? true,
      ...(options.version && { version: options.version }),
      ...(options.includeBindings && { includeBindings: true }),
      ...(options.libraries?.length && { libraries: options.libraries }),
    },
  };

  if (options.versions) {
    body.versions = options.versions;
  }

  return post("/compile", body, CompileResponseSchema);
}

// ---- Format ----

export interface FormatResult {
  success: boolean;
  formatted: string;
  changed: boolean;
  diff?: string;
  cacheKey?: string;
}

export async function format(
  code: string,
  options: { version?: string; versions?: string[] } = {},
): Promise<FormatResult> {
  const body: Record<string, unknown> = { code, options };
  if (options.versions) {
    body.versions = options.versions;
  }
  return post("/format", body, FormatResultSchema);
}

// ---- Analyze ----

export interface AnalyzeOptions {
  mode?: "fast" | "deep";
  include?: string[];
  circuit?: string;
  version?: string;
  versions?: string[];
}

export interface AnalyzeResult {
  success: boolean;
  mode: "fast" | "deep";
  summary?: {
    hasLedger?: boolean;
    hasCircuits?: boolean;
    hasWitnesses?: boolean;
    totalLines?: number;
    publicCircuits?: number;
    privateCircuits?: number;
    publicState?: number;
    privateState?: number;
  };
  structure?: {
    imports?: unknown[];
    exports?: unknown[];
    ledger?: unknown[];
    circuits?: unknown[];
    witnesses?: unknown[];
    types?: unknown[];
  };
  facts?: Record<string, unknown>;
  findings?: Array<{
    code?: string;
    severity?: string;
    message?: string;
    suggestion?: string;
  }>;
  recommendations?: Array<{
    message?: string;
    priority?: string;
    relatedFindings?: string[];
  }>;
  circuits?: unknown[];
  compilation?: Record<string, unknown>;
  cacheKey?: string;
  [key: string]: unknown;
}

export async function analyze(code: string, options: AnalyzeOptions = {}): Promise<AnalyzeResult> {
  const body: Record<string, unknown> = {
    code,
    mode: options.mode ?? "fast",
  };
  if (options.include) body.include = options.include;
  if (options.circuit) body.circuit = options.circuit;
  if (options.version) body.version = options.version;
  if (options.versions) body.versions = options.versions;

  return post("/analyze", body, AnalyzeResultSchema);
}

// ---- Diff ----

export interface DiffResult {
  success: boolean;
  hasChanges: boolean;
  circuits: {
    added: Array<{ name: string }>;
    removed: Array<{ name: string }>;
    modified: Array<{ name: string; changes: string[] }>;
  };
  ledger: {
    added: Array<{ name: string }>;
    removed: Array<{ name: string }>;
    modified: Array<{ name: string; changes: string[] }>;
  };
  pragma: { before: string | null; after: string | null; changed: boolean };
  imports: { added: string[]; removed: string[] };
  cacheKey?: string;
}

export async function diff(before: string, after: string): Promise<DiffResult> {
  return post("/diff", { before, after }, DiffResultSchema);
}

// ---- Visualize ----

export interface VisualizeResult {
  success: boolean;
  graph?: { nodes: unknown[]; edges: unknown[] };
  mermaid?: string;
  cacheKey?: string;
}

export async function visualize(
  code: string,
  options: { version?: string } = {},
): Promise<VisualizeResult> {
  return post("/visualize", { code, ...options }, VisualizeResultSchema);
}

// ---- Prove ----

export interface ProveResult {
  success: boolean;
  circuits?: unknown[];
  cacheKey?: string;
}

export async function prove(
  code: string,
  options: { version?: string } = {},
): Promise<ProveResult> {
  return post("/prove", { code, ...options }, ProveResultSchema);
}

// ---- Compile Archive ----

export interface ArchiveCompileOptions {
  version?: string;
  versions?: string[];
  skipZk?: boolean;
  includeBindings?: boolean;
  libraries?: string[];
}

export async function compileArchive(
  archive: string,
  options: ArchiveCompileOptions = {},
): Promise<CompileResult | MultiVersionCompileResult> {
  if (archive.length > MAX_CODE_SIZE * 2) {
    throw new MCPError(
      `Archive exceeds maximum size of ${(MAX_CODE_SIZE * 2) / 1024}KB`,
      ErrorCodes.INVALID_INPUT,
    );
  }

  const body: Record<string, unknown> = {
    archive,
    options: {
      skipZk: options.skipZk ?? true,
      ...(options.includeBindings && { includeBindings: true }),
      ...(options.libraries?.length && { libraries: options.libraries }),
    },
  };
  if (options.version) body.version = options.version;
  if (options.versions) body.versions = options.versions;

  return post("/compile/archive", body, CompileResponseSchema);
}

// ---- Simulate ----

export interface SimulateDeployResult {
  success: boolean;
  sessionId: string;
  circuits?: unknown[];
  ledger?: unknown;
}

export async function simulateDeploy(
  code: string,
  options: { version?: string } = {},
): Promise<SimulateDeployResult> {
  return post("/simulate/deploy", { code, ...options }, SimulateDeployResultSchema);
}

export interface SimulateCallResult {
  success: boolean;
  result?: unknown;
  stateChanges?: unknown[];
  updatedLedger?: unknown;
}

export async function simulateCall(
  sessionId: string,
  circuit: string,
  args?: Record<string, string>,
): Promise<SimulateCallResult> {
  return post(
    `/simulate/${sessionId}/call`,
    { circuit, ...(args && { parameters: args }) },
    SimulateCallResultSchema,
  );
}

export interface SimulateStateResult {
  success: boolean;
  ledger?: unknown;
  circuits?: unknown[];
  callHistory?: unknown[];
}

export async function simulateState(sessionId: string): Promise<SimulateStateResult> {
  return get(`/simulate/${sessionId}/state`, SimulateStateResultSchema);
}

export interface SimulateDeleteResult {
  success: boolean;
}

export async function simulateDelete(sessionId: string): Promise<SimulateDeleteResult> {
  return del(`/simulate/${sessionId}`, SimulateDeleteResultSchema);
}

// ---- Versions ----

export interface VersionsResult {
  default: string;
  installed: Array<{ version: string; languageVersion: string }>;
}

export async function listVersions(): Promise<VersionsResult> {
  return get("/versions", VersionsResultSchema);
}

// ---- Libraries ----

export interface LibrariesResult {
  libraries: Array<{ name: string; domain: string; path: string }>;
}

export async function listLibraries(): Promise<LibrariesResult> {
  return get("/libraries", LibrariesResultSchema);
}

// ---- Health ----

export async function healthCheck(): Promise<{
  status: string;
  compactCli?: { installed: boolean; version?: string };
}> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 5000);
  try {
    const response = await fetch(apiUrl("/health"), {
      signal: controller.signal,
    });
    if (!response.ok) {
      return { status: "unavailable" };
    }
    const raw: unknown = await response.json();
    const parsed = PlaygroundHealthSchema.safeParse(raw);
    if (!parsed.success) {
      return { status: "unavailable" };
    }
    return parsed.data;
  } catch {
    return { status: "unavailable" };
  } finally {
    clearTimeout(timeoutId);
  }
}
