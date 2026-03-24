/**
 * LogTape configuration — console sink, MCP sink, redaction, and level filtering.
 *
 * Call {@link initLogging} once at startup (before any log calls).
 * Call {@link setMCPLogFunction} after the MCP server is created.
 */

import {
  configure,
  getConsoleSink,
  getTextFormatter,
  getJsonLinesFormatter,
  resetSync,
  withFilter,
  type LogLevel,
  type LogRecord,
  type Sink,
} from "@logtape/logtape";
import { redactByPattern } from "@logtape/redaction";
import { CRYPTO_REDACTION_PATTERNS, createRedactedSink, redactString } from "./redaction.js";

// ---------------------------------------------------------------------------
// MCP log forwarding
// ---------------------------------------------------------------------------

type MCPLogFunction = (
  level: "debug" | "info" | "notice" | "warning" | "error" | "critical" | "alert" | "emergency",
  logger: string,
  data: unknown,
) => void;

let mcpLogFunction: MCPLogFunction | null = null;

// Reentrancy guard — prevents infinite recursion when notification
// failure logging triggers the MCP sink back into itself.
let sendingMCPLog = false;

/** Map LogTape levels to MCP logging levels. */
const LOGTAPE_TO_MCP: Record<
  LogLevel,
  MCPLogFunction extends (l: infer L, ...a: never[]) => void ? L : never
> = {
  trace: "debug",
  debug: "debug",
  info: "info",
  warning: "warning",
  error: "error",
  fatal: "emergency",
};

/**
 * All console output goes to stderr via console.error.
 * This is critical for MCP servers — stdout carries JSON-RPC traffic.
 */
const STDERR_LEVEL_MAP: Record<LogLevel, "error"> = {
  trace: "error",
  debug: "error",
  info: "error",
  warning: "error",
  error: "error",
  fatal: "error",
};

/** Custom MCP sink — routes sanitized log records to the MCP client. */
function mcpSink(record: LogRecord): void {
  if (!mcpLogFunction || sendingMCPLog) return;

  sendingMCPLog = true;
  try {
    const mcpLevel = LOGTAPE_TO_MCP[record.level];
    const loggerName = record.category.join(".");
    const message = redactString(record.message.join(""));

    mcpLogFunction(mcpLevel, loggerName, { message, ...record.properties });
  } finally {
    sendingMCPLog = false;
  }
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Map config log level names to LogTape level names. */
function toLogTapeLevel(level: string): LogLevel {
  if (level === "warn") return "warning";
  if (
    level === "trace" ||
    level === "debug" ||
    level === "info" ||
    level === "warning" ||
    level === "error" ||
    level === "fatal"
  ) {
    return level;
  }
  return "info";
}

/**
 * Initialize the LogTape logging system.
 *
 * Must be called once before any log calls (typically at the start of
 * {@link initializeSharedResources}).
 */
export async function initLogging(options?: { level?: string; format?: string }): Promise<void> {
  const level = toLogTapeLevel(options?.level ?? process.env.LOG_LEVEL ?? "info");
  const format = options?.format ?? process.env.LOG_FORMAT ?? "text";

  // Build a formatter with regex-based redaction for crypto material
  const baseFormatter =
    format === "json" ? getJsonLinesFormatter() : getTextFormatter({ timestamp: "date-time-tz" });
  const formatter = redactByPattern(baseFormatter, CRYPTO_REDACTION_PATTERNS);

  // Console sink: stderr-only, with regex-redacted formatter
  const consoleSink = getConsoleSink({ formatter, levelMap: STDERR_LEVEL_MAP });

  // Wrap both sinks with truncation + field-name redaction
  const redactedConsoleSink = createRedactedSink(consoleSink as Sink);
  const redactedMCPSink = createRedactedSink(mcpSink);

  await configure({
    sinks: {
      // Console sink filtered at the configured level
      console: withFilter(redactedConsoleSink, level),
      // MCP sink receives all messages; per-session filtering happens
      // downstream in sendLogToClient.
      mcp: redactedMCPSink,
    },
    loggers: [
      {
        category: "midnight-mcp",
        sinks: ["console", "mcp"],
        lowestLevel: "debug",
      },
      // Suppress LogTape's internal meta logger unless errors occur
      {
        category: "logtape",
        sinks: ["console"],
        lowestLevel: "error",
      },
    ],
    reset: true,
  });
}

/**
 * Set the MCP log forwarding function.
 * Called after the MCP server is created to route logs to the client.
 */
export function setMCPLogFunction(fn: MCPLogFunction | null): void {
  mcpLogFunction = fn;
}

/**
 * Reset all logging state to initial values. Used for test isolation.
 */
export function resetLoggerState(): void {
  mcpLogFunction = null;
  sendingMCPLog = false;
  resetSync();
}
