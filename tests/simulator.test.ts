/**
 * Local simulation engine tests.
 * Verifies session lifecycle, circuit execution, state inspection,
 * session cleanup, and TTL/capacity management.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/utils/config.js", () => ({
  config: { hostedApiUrl: "https://api.test", mode: "hosted", logLevel: "info" },
  clientId: "test-client-id",
  isHostedMode: () => true,
  isLocalMode: () => false,
  DEFAULT_REPOSITORIES: [],
}));

vi.mock("../src/utils/index.js", () => ({
  config: { hostedApiUrl: "https://api.test" },
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  MCPError: class extends Error {
    code: string;
    constructor(m: string, c: string) {
      super(m);
      this.code = c;
    }
  },
  ErrorCodes: { INTERNAL_ERROR: "INTERNAL_ERROR", INVALID_INPUT: "INVALID_INPUT" },
}));

// Mock the compile function from playground
const { mockCompile } = vi.hoisted(() => ({
  mockCompile: vi.fn(),
}));

vi.mock("../src/services/playground.js", () => ({
  compile: mockCompile,
}));

import {
  localSimulateDeploy,
  localSimulateCall,
  localSimulateState,
  localSimulateDelete,
  resetSimulatorState,
  getActiveSessionCount,
} from "../src/services/simulator.js";

describe("Local simulator — session lifecycle", () => {
  beforeEach(() => {
    resetSimulatorState();
    vi.clearAllMocks();
    mockCompile.mockResolvedValue({
      success: true,
      output: "export circuit main() {}\nexport circuit transfer(amount: Field) {}",
    });
  });

  it("deploy creates a session with extracted circuits", async () => {
    const result = await localSimulateDeploy("export circuit main() {}");

    expect(result.success).toBe(true);
    expect(result.sessionId).toBeDefined();
    expect(result.circuits.length).toBeGreaterThan(0);
    expect(getActiveSessionCount()).toBe(1);
  });

  it("deploy compiles the code with includeBindings", async () => {
    await localSimulateDeploy("export circuit main() {}");

    expect(mockCompile).toHaveBeenCalledWith("export circuit main() {}", expect.objectContaining({
      includeBindings: true,
      skipZk: true,
      wrapWithDefaults: true,
    }));
  });

  it("deploy throws when compilation fails", async () => {
    mockCompile.mockResolvedValueOnce({
      success: false,
      errors: [{ message: "syntax error at line 1" }],
    });

    await expect(localSimulateDeploy("bad code")).rejects.toThrow("Cannot simulate");
  });

  it("call executes a circuit and records history", async () => {
    const deploy = await localSimulateDeploy("export circuit main() {}");
    const callResult = await localSimulateCall(deploy.sessionId, "main");

    expect(callResult.success).toBe(true);
    expect(callResult.result).toBeDefined();
  });

  it("call throws for nonexistent circuit", async () => {
    const deploy = await localSimulateDeploy("export circuit main() {}");

    await expect(
      localSimulateCall(deploy.sessionId, "nonexistent"),
    ).rejects.toThrow("Circuit 'nonexistent' not found");
  });

  it("state returns ledger, circuits, and call history", async () => {
    const deploy = await localSimulateDeploy("export circuit main() {}");
    await localSimulateCall(deploy.sessionId, "main");

    const state = await localSimulateState(deploy.sessionId);

    expect(state.success).toBe(true);
    expect(state.circuits).toBeDefined();
    expect(state.callHistory).toHaveLength(1);
    expect(state.callHistory[0].circuit).toBe("main");
  });

  it("delete removes the session", async () => {
    const deploy = await localSimulateDeploy("export circuit main() {}");
    expect(getActiveSessionCount()).toBe(1);

    const result = await localSimulateDelete(deploy.sessionId);
    expect(result.success).toBe(true);
    expect(getActiveSessionCount()).toBe(0);
  });

  it("delete is idempotent (deleting twice succeeds)", async () => {
    const deploy = await localSimulateDeploy("export circuit main() {}");
    await localSimulateDelete(deploy.sessionId);
    const result = await localSimulateDelete(deploy.sessionId);
    expect(result.success).toBe(true);
  });

  it("accessing a deleted session throws", async () => {
    const deploy = await localSimulateDeploy("export circuit main() {}");
    await localSimulateDelete(deploy.sessionId);

    await expect(localSimulateState(deploy.sessionId)).rejects.toThrow("not found");
  });

  it("accessing a nonexistent session throws", async () => {
    await expect(localSimulateState("fake-session-id")).rejects.toThrow("not found");
  });
});

describe("Local simulator — capacity management", () => {
  beforeEach(() => {
    resetSimulatorState();
    vi.clearAllMocks();
    mockCompile.mockResolvedValue({
      success: true,
      output: "export circuit main() {}",
    });
  });

  it("evicts the oldest session when capacity is exceeded", async () => {
    // Create 10 sessions (max capacity)
    const sessions = [];
    for (let i = 0; i < 10; i++) {
      sessions.push(await localSimulateDeploy(`contract ${i}`));
    }
    expect(getActiveSessionCount()).toBe(10);

    // Creating an 11th should evict the oldest
    await localSimulateDeploy("contract overflow");
    expect(getActiveSessionCount()).toBe(10);

    // The first session should have been evicted
    await expect(localSimulateState(sessions[0].sessionId)).rejects.toThrow("not found");
  });
});

describe("Local simulator — circuit extraction", () => {
  beforeEach(() => {
    resetSimulatorState();
    vi.clearAllMocks();
  });

  it("extracts multiple circuits from compilation output", async () => {
    mockCompile.mockResolvedValueOnce({
      success: true,
      output: "export circuit deposit(amount: Field) {}\ncircuit internal_check() {}\nexport circuit withdraw(amount: Field, to: Bytes<32>) {}",
    });

    const result = await localSimulateDeploy("source code");

    const names = result.circuits.map((c) => c.name);
    expect(names).toContain("deposit");
    expect(names).toContain("internal_check");
    expect(names).toContain("withdraw");

    const deposit = result.circuits.find((c) => c.name === "deposit")!;
    expect(deposit.isPublic).toBe(true);
    expect(deposit.parameters).toContain("amount");

    const internal = result.circuits.find((c) => c.name === "internal_check")!;
    expect(internal.isPublic).toBe(false);
  });

  it("provides fallback circuit when output is binary", async () => {
    mockCompile.mockResolvedValueOnce({
      success: true,
      output: "\x00\x01\x02 binary ZKIR output",
    });

    const result = await localSimulateDeploy("source code");
    expect(result.circuits.length).toBeGreaterThan(0);
  });
});
