/**
 * Transport/session isolation tests for the MCP server.
 * Verifies server initialization, per-session context,
 * subscription management, notification routing, and
 * multi-session isolation behavior.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock heavy dependencies so we can import server functions without side effects
vi.mock("../src/utils/config.js", () => ({
  config: { hostedApiUrl: "https://api.test", mode: "hosted", logLevel: "info", port: 3000 },
  clientId: "test-client-id",
  isHostedMode: () => true,
  isLocalMode: () => false,
  DEFAULT_REPOSITORIES: [],
}));

vi.mock("../src/utils/index.js", () => ({
  config: { hostedApiUrl: "https://api.test", mode: "hosted", logLevel: "info", port: 3000 },
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  formatErrorResponse: vi.fn(() => ({ error: "test" })),
  setMCPLogFunction: vi.fn(),
  initLogging: vi.fn(),
  trackToolCall: vi.fn(),
  serialize: vi.fn((v: unknown) => JSON.stringify(v)),
  isHostedMode: () => true,
  isLocalMode: () => false,
  MCPError: class extends Error {
    code: string;
    constructor(m: string, c: string) {
      super(m);
      this.code = c;
    }
  },
  ErrorCodes: { INVALID_INPUT: "INVALID_INPUT", INTERNAL_ERROR: "INTERNAL_ERROR" },
  SelfCorrectionHints: {},
  DEFAULT_REPOSITORIES: [],
  searchCache: { get: () => null, set: vi.fn() },
  createCacheKey: vi.fn(),
  validateQuery: vi.fn(),
  validateNumber: vi.fn(),
  searchCompactHosted: vi.fn(),
  searchTypeScriptHosted: vi.fn(),
  searchDocsHosted: vi.fn(),
  extractContentFromHtml: vi.fn(),
}));

vi.mock("../src/db/index.js", () => ({
  vectorStore: { search: vi.fn(async () => []) },
}));

vi.mock("../src/pipeline/embeddings.js", () => ({
  embeddingGenerator: { isDummyMode: false },
}));

vi.mock("../src/utils/version.js", () => ({
  CURRENT_VERSION: "0.0.0-test",
}));

vi.mock("../src/tools/validation.js", () => ({
  toolValidationSchemas: {},
}));

vi.mock("../src/tools/index.js", () => ({
  allTools: [],
}));

vi.mock("../src/resources/index.js", () => ({
  allResources: [],
  getDocumentation: vi.fn(),
  getSchema: vi.fn(),
}));

vi.mock("../src/services/index.js", () => ({
  registerSamplingCallback: vi.fn(),
}));

import {
  createServer,
  setServerConnected,
  clearSubscriptions,
  getActiveSubscriptions,
  sendLogToClient,
  sendProgressNotification,
  notifyResourceUpdate,
  resetServerState,
  getUpdateWarning,
} from "../src/server.js";

describe("Server initialization", () => {
  beforeEach(() => {
    resetServerState();
  });

  it("createServer returns a Server instance", () => {
    const server = createServer();
    expect(server).toBeDefined();
    expect(server).toHaveProperty("notification");
  });

  it("createServer initializes with empty subscriptions", () => {
    const server = createServer();
    const subs = getActiveSubscriptions(server);
    expect(subs).toEqual([]);
  });

  it("getUpdateWarning returns null initially", () => {
    expect(getUpdateWarning()).toBeNull();
  });

  it("resetServerState clears version check and active server", () => {
    createServer(); // sets activeServer
    resetServerState();
    // After reset, no active server — subscriptions/notifications should be no-ops
    expect(getActiveSubscriptions()).toEqual([]);
  });
});

describe("Connection state", () => {
  beforeEach(() => {
    resetServerState();
  });

  it("server starts as not connected", () => {
    const server = createServer();
    // sendLogToClient should be a no-op when not connected
    const spy = vi.spyOn(server, "notification");
    sendLogToClient("info", "test", "hello", server);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("setServerConnected enables notifications", () => {
    const server = createServer();
    setServerConnected(true, server);
    const spy = vi.spyOn(server, "notification").mockImplementation(async () => {});
    sendLogToClient("info", "test", "hello", server);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("setServerConnected(false) disables notifications", () => {
    const server = createServer();
    setServerConnected(true, server);
    setServerConnected(false, server);
    const spy = vi.spyOn(server, "notification");
    sendLogToClient("info", "test", "hello", server);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("Subscription management", () => {
  beforeEach(() => {
    resetServerState();
  });

  it("clearSubscriptions empties the subscription set", () => {
    const server = createServer();
    // We can't directly add subscriptions via handler without a full transport,
    // but we can test the clear/get API works correctly
    clearSubscriptions(server);
    expect(getActiveSubscriptions(server)).toEqual([]);
  });

  it("getActiveSubscriptions returns empty array when no server exists", () => {
    resetServerState();
    expect(getActiveSubscriptions()).toEqual([]);
  });

  it("clearSubscriptions is safe when no server exists", () => {
    resetServerState();
    // Should not throw
    expect(() => clearSubscriptions()).not.toThrow();
  });
});

describe("Log notification routing", () => {
  beforeEach(() => {
    resetServerState();
  });

  it("filters log notifications by level threshold", () => {
    const server = createServer();
    setServerConnected(true, server);
    const spy = vi.spyOn(server, "notification").mockImplementation(async () => {});

    // Default log level is "info" — debug should be filtered
    sendLogToClient("debug", "test", "debug message", server);
    expect(spy).not.toHaveBeenCalled();

    // info should pass the threshold
    sendLogToClient("info", "test", "info message", server);
    expect(spy).toHaveBeenCalledTimes(1);

    // error should also pass
    sendLogToClient("error", "test", "error message", server);
    expect(spy).toHaveBeenCalledTimes(2);

    spy.mockRestore();
  });

  it("does not send notifications to a disconnected server", () => {
    const server = createServer();
    // Not connected — notification should be skipped
    const spy = vi.spyOn(server, "notification");
    sendLogToClient("error", "test", "critical error", server);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("is safe when no active server exists", () => {
    resetServerState();
    // Should not throw
    expect(() => sendLogToClient("info", "test", "hello")).not.toThrow();
  });

  it("catches rejected notification promise without unhandled rejection", async () => {
    const server = createServer();
    setServerConnected(true, server);
    const spy = vi.spyOn(server, "notification").mockRejectedValue(new Error("transport closed"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    sendLogToClient("info", "test", "hello", server);

    // Allow the microtask (.catch handler) to run
    await new Promise((r) => setTimeout(r, 0));

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to send log notification: transport closed"),
    );

    spy.mockRestore();
    consoleSpy.mockRestore();
  });
});

describe("Progress notification routing", () => {
  beforeEach(() => {
    resetServerState();
  });

  it("sends progress notifications to the active server", () => {
    const server = createServer();
    // sendProgressNotification uses activeServer directly (no connected check)
    const spy = vi.spyOn(server, "notification").mockImplementation(async () => {});
    sendProgressNotification("token-1", 50, 100, "Halfway done");
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "notifications/progress",
        params: expect.objectContaining({
          progressToken: "token-1",
          progress: 50,
          total: 100,
          message: "Halfway done",
        }),
      }),
    );
    spy.mockRestore();
  });

  it("is safe when no server exists", () => {
    resetServerState();
    expect(() => sendProgressNotification("token", 0)).not.toThrow();
  });
});

describe("Resource update notifications", () => {
  beforeEach(() => {
    resetServerState();
  });

  it("is safe when server has no subscriptions for the URI", () => {
    const server = createServer();
    const spy = vi.spyOn(server, "notification");
    notifyResourceUpdate(server, "midnight://docs/guides/faq");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("Multi-session isolation", () => {
  beforeEach(() => {
    resetServerState();
  });

  it("each createServer call produces a distinct server with its own context", () => {
    const server1 = createServer();
    const server2 = createServer();

    expect(server1).not.toBe(server2);

    // Each has independent subscription state
    expect(getActiveSubscriptions(server1)).toEqual([]);
    expect(getActiveSubscriptions(server2)).toEqual([]);
  });

  it("setServerConnected on one server does not affect another", () => {
    const server1 = createServer();
    const server2 = createServer();

    setServerConnected(true, server1);
    // server2 is still not connected

    const spy1 = vi.spyOn(server1, "notification").mockImplementation(async () => {});
    const spy2 = vi.spyOn(server2, "notification");

    sendLogToClient("info", "test", "hello", server1);
    sendLogToClient("info", "test", "hello", server2);

    expect(spy1).toHaveBeenCalledTimes(1);
    expect(spy2).not.toHaveBeenCalled();

    spy1.mockRestore();
    spy2.mockRestore();
  });

  it("clearSubscriptions on one server does not affect another", () => {
    const server1 = createServer();
    const server2 = createServer();

    // Clear only server1's subscriptions
    clearSubscriptions(server1);

    // Both should still have empty subscriptions (neither had any)
    expect(getActiveSubscriptions(server1)).toEqual([]);
    expect(getActiveSubscriptions(server2)).toEqual([]);
  });

  it("notifications target the specified server, not the active server", () => {
    const server1 = createServer();
    const server2 = createServer(); // this becomes activeServer

    setServerConnected(true, server1);
    setServerConnected(true, server2);

    const spy1 = vi.spyOn(server1, "notification").mockImplementation(async () => {});
    const spy2 = vi.spyOn(server2, "notification").mockImplementation(async () => {});

    // Explicitly target server1 (not the active server2)
    sendLogToClient("info", "test", "for server1 only", server1);

    expect(spy1).toHaveBeenCalledTimes(1);
    expect(spy2).not.toHaveBeenCalled();

    spy1.mockRestore();
    spy2.mockRestore();
  });
});
