import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import {
  analyzeContract,
  compileContract,
} from "../src/tools/analyze/index.js";

// Mock config and logger
vi.mock("../src/utils/config.js", () => ({
  config: { hostedApiUrl: "https://api.test" },
}));

vi.mock("../src/utils/index.js", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  MCPError: class MCPError extends Error {
    code: string;
    constructor(message: string, code: string, suggestion?: string) {
      super(message);
      this.code = code;
      if (suggestion) (this as Record<string, unknown>).suggestion = suggestion;
    }
  },
  ErrorCodes: {
    INVALID_INPUT: "INVALID_INPUT",
    INTERNAL_ERROR: "INTERNAL_ERROR",
  },
}));

describe("Contract Analyzer", () => {
  const mockFetch = vi.fn();
  const originalFetch = globalThis.fetch;

  beforeAll(() => {
    globalThis.fetch = mockFetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("should analyze a contract via the playground API", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        mode: "fast",
        pragma: "0.18.0",
        imports: ["CompactStandardLibrary"],
        circuits: [
          {
            name: "increment",
            exported: true,
            pure: false,
            params: [{ name: "amount", type: "Field" }],
            returnType: "Field",
            line: 7,
          },
        ],
        ledger: [{ name: "counter", type: "Counter", exported: true }],
      }),
    });

    const result = await analyzeContract({
      code: "pragma language_version >= 0.18.0;",
      mode: "fast",
    });

    expect(result.success).toBe(true);
    expect(result.mode).toBe("fast");
    expect(result.circuits.length).toBe(1);
    expect(result.circuits[0].name).toBe("increment");
  });

  it("should pass mode to the API", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        mode: "deep",
        pragma: null,
        imports: [],
        circuits: [],
        ledger: [],
        compilation: { success: true },
      }),
    });

    const result = await analyzeContract({ code: "test", mode: "deep" });

    expect(result.mode).toBe("deep");
    expect(result.compilation).toBeDefined();
  });
});

describe("Compile Contract", () => {
  const mockFetch = vi.fn();
  const originalFetch = globalThis.fetch;

  beforeAll(() => {
    globalThis.fetch = mockFetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("should return success for valid contract", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        output: "Compilation successful",
        compilerVersion: "0.18.0",
        compiledAt: "2026-01-19T19:17:56.064Z",
        executionTime: 2841,
      }),
    });

    const result = (await compileContract({
      code: `pragma language_version >= 0.18.0;`,
      skipZk: true,
    })) as Record<string, unknown>;

    expect(result.success).toBe(true);
    expect(result.compilationMode).toBe("syntax-only");
  });

  it("should throw for 503 service unavailable", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
    });

    await expect(
      compileContract({ code: "pragma language_version >= 0.18.0;" }),
    ).rejects.toThrow(/unavailable/);
  });

  it("should throw MCPError for oversized code", async () => {
    await expect(
      compileContract({ code: "x".repeat(200 * 1024) }),
    ).rejects.toThrow(/exceeds maximum size/);
  });

  it("should set fullCompile mode correctly", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        output: "Full compilation successful",
      }),
    });

    const result = (await compileContract({
      code: "test code",
      fullCompile: true,
    })) as Record<string, unknown>;

    expect(result.compilationMode).toBe("full");

    // Verify that fetch was called with skipZk: false
    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body as string) as Record<string, unknown>;
    const options = fetchBody.options as Record<string, unknown>;
    expect(options.skipZk).toBe(false);
  });
});
