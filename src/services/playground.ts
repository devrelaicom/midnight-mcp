/**
 * Playground API client.
 * All compact-playground interactions go through the API layer's /pg/* routes.
 */

import { config } from "../utils/config.js";
import { MCPError, ErrorCodes } from "../utils/index.js";

const TIMEOUT = 30000;
const MAX_CODE_SIZE = 100 * 1024;

function apiUrl(path: string): string {
  return `${config.hostedApiUrl}/pg${path}`;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, TIMEOUT);

  try {
    const response = await fetch(apiUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

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

    return (await response.json()) as T;
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

// ---- Compile ----

export interface CompileOptions {
  wrapWithDefaults?: boolean;
  skipZk?: boolean;
  version?: string;
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
    },
  };

  if (options.versions) {
    body.versions = options.versions;
  }

  return post("/compile", body);
}

// ---- Format ----

export interface FormatResult {
  success: boolean;
  formatted: string;
  changed: boolean;
  diff?: string;
}

export async function format(
  code: string,
  options: { version?: string } = {},
): Promise<FormatResult> {
  return post("/format", { code, options });
}

// ---- Analyze ----

export interface AnalyzeResult {
  success: boolean;
  mode: "fast" | "deep";
  pragma: string | null;
  imports: string[];
  circuits: Array<{
    name: string;
    exported: boolean;
    pure: boolean;
    params: Array<{ name: string; type: string }>;
    returnType: string;
    line: number;
  }>;
  ledger: Array<{
    name: string;
    type: string;
    exported: boolean;
  }>;
  compilation?: CompileResult;
}

export async function analyze(
  code: string,
  mode: "fast" | "deep" = "fast",
): Promise<AnalyzeResult> {
  return post("/analyze", { code, mode });
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
}

export async function diff(before: string, after: string): Promise<DiffResult> {
  return post("/diff", { before, after });
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
    return (await response.json()) as {
      status: string;
      compactCli?: { installed: boolean; version?: string };
    };
  } catch {
    return { status: "unavailable" };
  } finally {
    clearTimeout(timeoutId);
  }
}
