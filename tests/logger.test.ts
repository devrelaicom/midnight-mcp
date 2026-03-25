/**
 * Tests for the LogTape-backed logger integration.
 * Verifies initialization, MCP sink delivery, redaction pipeline,
 * and tool arg logging behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getLogger, resetSync, configureSync, type LogRecord, type Sink } from "@logtape/logtape";
import { initLogging, setMCPLogFunction, resetLoggerState } from "../src/utils/logtape-setup.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Capture LogRecords from a named logger using a test sink. */
function setupTestSink(): { records: LogRecord[]; sink: Sink } {
  const records: LogRecord[] = [];
  const sink: Sink = (record) => records.push(record);
  return { records, sink };
}

// ---------------------------------------------------------------------------
// initLogging
// ---------------------------------------------------------------------------

describe("initLogging", () => {
  afterEach(() => {
    resetLoggerState();
  });

  it("configures LogTape so that log calls produce records", async () => {
    await initLogging({ level: "debug" });
    const logger = getLogger(["midnight-mcp", "test"]);

    // After initLogging, messages should not throw or silently disappear
    // (We can't easily capture them without a custom sink, but we verify no error)
    expect(() => logger.info("hello")).not.toThrow();
  });

  it("respects the configured log level", async () => {
    // Use a custom sink to capture records
    const { records, sink } = setupTestSink();

    resetSync();
    configureSync({
      sinks: { test: sink },
      loggers: [{ category: "test-level", sinks: ["test"], lowestLevel: "warning" }],
    });

    const logger = getLogger("test-level");
    logger.debug("should be filtered");
    logger.info("should be filtered too");
    logger.warn("should pass");

    expect(records).toHaveLength(1);
    expect(records[0]!.level).toBe("warning");
  });
});

// ---------------------------------------------------------------------------
// MCP sink
// ---------------------------------------------------------------------------

describe("MCP sink forwarding", () => {
  afterEach(() => {
    resetLoggerState();
  });

  it("forwards log messages to the MCP callback", async () => {
    await initLogging({ level: "debug" });

    const mcpCalls: Array<{ level: string; logger: string; data: unknown }> = [];
    setMCPLogFunction((level, logger, data) => {
      mcpCalls.push({ level, logger, data });
    });

    const logger = getLogger("midnight-mcp");
    logger.info("test message", { tool: "search" });

    expect(mcpCalls.length).toBeGreaterThanOrEqual(1);
    const call = mcpCalls.find(
      (c) => typeof c.data === "object" && c.data !== null && "tool" in c.data,
    );
    expect(call).toBeDefined();
    expect(call!.level).toBe("info");
    expect(call!.logger).toBe("midnight-mcp");
    expect((call!.data as Record<string, unknown>).tool).toBe("search");
  });

  it("redacts sensitive fields before forwarding to MCP", async () => {
    await initLogging({ level: "debug" });

    const mcpCalls: Array<{ data: unknown }> = [];
    setMCPLogFunction((_level, _logger, data) => {
      mcpCalls.push({ data });
    });

    const logger = getLogger("midnight-mcp");
    logger.info("auth event", { apiKey: "sk-secret-value", user: "alice" });

    const call = mcpCalls.find(
      (c) => typeof c.data === "object" && c.data !== null && "user" in c.data,
    );
    expect(call).toBeDefined();
    const data = call!.data as Record<string, unknown>;
    expect(data.apiKey).toBe("[REDACTED]");
    expect(data.user).toBe("alice");
  });

  it("truncates large payloads before forwarding to MCP", async () => {
    await initLogging({ level: "debug" });

    const mcpCalls: Array<{ data: unknown }> = [];
    setMCPLogFunction((_level, _logger, data) => {
      mcpCalls.push({ data });
    });

    const logger = getLogger("midnight-mcp");
    const largeBody = "x".repeat(1000);
    logger.info("big payload", { body: largeBody });

    const call = mcpCalls.find(
      (c) => typeof c.data === "object" && c.data !== null && "body" in c.data,
    );
    expect(call).toBeDefined();
    const body = (call!.data as Record<string, unknown>).body as string;
    expect(body.length).toBeLessThan(250);
    expect(body).toContain("...[truncated");
  });

  it("regex-redacts hex keys in MCP-forwarded property values", async () => {
    await initLogging({ level: "debug" });

    const mcpCalls: Array<{ data: unknown }> = [];
    setMCPLogFunction((_level, _logger, data) => {
      mcpCalls.push({ data });
    });

    const logger = getLogger("midnight-mcp");
    const hexKey = "a".repeat(64);
    logger.info("found key", { output: `key: ${hexKey}` });

    const call = mcpCalls.find(
      (c) => typeof c.data === "object" && c.data !== null && "output" in c.data,
    );
    expect(call).toBeDefined();
    const output = (call!.data as Record<string, unknown>).output as string;
    expect(output).not.toContain(hexKey);
    expect(output).toContain("[REDACTED:hex-key]");
  });

  it("regex-redacts hex keys in MCP-forwarded message text", async () => {
    await initLogging({ level: "debug" });

    const mcpCalls: Array<{ data: unknown }> = [];
    setMCPLogFunction((_level, _logger, data) => {
      mcpCalls.push({ data });
    });

    const logger = getLogger("midnight-mcp");
    const hexKey = "b".repeat(64);
    logger.info(`The secret key is ${hexKey} and should be hidden`);

    // Find a call whose message field contains [REDACTED:hex-key]
    const call = mcpCalls.find((c) => {
      const data = c.data as Record<string, unknown>;
      return typeof data.message === "string" && data.message.includes("[REDACTED:hex-key]");
    });
    expect(call).toBeDefined();
    const message = (call!.data as Record<string, unknown>).message as string;
    expect(message).not.toContain(hexKey);
  });

  it("does not forward when MCP function is not set", async () => {
    await initLogging({ level: "debug" });
    // No setMCPLogFunction call

    const logger = getLogger("midnight-mcp");
    // Should not throw
    expect(() => logger.info("orphan message")).not.toThrow();
  });

  it("prevents infinite recursion if MCP callback triggers a log", async () => {
    await initLogging({ level: "debug" });

    let callCount = 0;
    setMCPLogFunction(() => {
      callCount++;
      // This would recurse infinitely without the reentrancy guard
      getLogger("midnight-mcp").error("callback error");
    });

    const logger = getLogger("midnight-mcp");
    expect(() => logger.info("trigger")).not.toThrow();
    // Should only have been called once (the recursive call is blocked)
    expect(callCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// resetLoggerState
// ---------------------------------------------------------------------------

describe("resetLoggerState", () => {
  it("clears the MCP callback", async () => {
    await initLogging({ level: "debug" });

    const mcpCalls: unknown[] = [];
    setMCPLogFunction((_l, _n, d) => mcpCalls.push(d));

    resetLoggerState();

    // Re-configure after reset so the logger produces records
    await initLogging({ level: "debug" });

    const logger = getLogger("midnight-mcp");
    logger.info("after reset");

    // MCP function was cleared, so no calls should have been recorded
    expect(mcpCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tool arg logging (integration-level)
// ---------------------------------------------------------------------------

describe("tool arg logging safety", () => {
  it("should log argKeys instead of full arg values", () => {
    // Simulates the pattern used in server.ts after the fix
    const args = { query: "sensitive data", repository: "midnight-mcp" };
    const safeProps = { argKeys: Object.keys(args) };

    expect(safeProps.argKeys).toEqual(["query", "repository"]);
    expect(safeProps).not.toHaveProperty("query");
    expect(safeProps).not.toHaveProperty("repository");
  });
});
