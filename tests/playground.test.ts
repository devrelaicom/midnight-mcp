import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MCPError } from "../src/utils/errors.js";

// Mock config before importing playground
vi.mock("../src/utils/config.js", () => ({
  config: {
    hostedApiUrl: "https://test-api.example.com",
    logLevel: "error",
  },
}));

vi.mock("../src/utils/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  compile,
  format,
  analyze,
  diff,
  healthCheck,
} from "../src/services/playground.js";

const BASE_URL = "https://test-api.example.com/pg";

describe("playground API client", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetchOk(body: unknown) {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }

  function mockFetchStatus(status: number, body = "error") {
    fetchSpy.mockResolvedValueOnce(
      new Response(body, { status }),
    );
  }

  // ---- compile ----

  describe("compile", () => {
    it("sends POST to /pg/compile with correct body", async () => {
      const result = { success: true, output: "OK" };
      mockFetchOk(result);

      const res = await compile("export circuit main() {}");

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/compile`);
      expect(init?.method).toBe("POST");
      expect(init?.headers).toEqual({ "Content-Type": "application/json" });

      const parsed = JSON.parse(init?.body as string);
      expect(parsed.code).toBe("export circuit main() {}");
      expect(parsed.options.wrapWithDefaults).toBe(true);
      expect(parsed.options.skipZk).toBe(true);
      expect(res).toEqual(result);
    });

    it("passes version and versions when provided", async () => {
      mockFetchOk({ success: true });

      await compile("code", {
        version: "0.14.0",
        versions: ["0.13.0", "0.14.0"],
        wrapWithDefaults: false,
        skipZk: false,
      });

      const parsed = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(parsed.options.version).toBe("0.14.0");
      expect(parsed.options.wrapWithDefaults).toBe(false);
      expect(parsed.options.skipZk).toBe(false);
      expect(parsed.versions).toEqual(["0.13.0", "0.14.0"]);
    });

    it("throws MCPError for code exceeding max size", async () => {
      const bigCode = "x".repeat(100 * 1024 + 1);
      await expect(compile(bigCode)).rejects.toThrow(MCPError);
      await expect(compile(bigCode)).rejects.toThrow("exceeds maximum size");
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  // ---- format ----

  describe("format", () => {
    it("sends POST to /pg/format with correct body", async () => {
      const result = { success: true, formatted: "code", changed: false };
      mockFetchOk(result);

      const res = await format("code", { version: "0.14.0" });

      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/format`);
      const parsed = JSON.parse(init?.body as string);
      expect(parsed.code).toBe("code");
      expect(parsed.options.version).toBe("0.14.0");
      expect(res).toEqual(result);
    });
  });

  // ---- analyze ----

  describe("analyze", () => {
    it("sends POST to /pg/analyze with mode param", async () => {
      const result = { success: true, mode: "deep", circuits: [] };
      mockFetchOk(result);

      const res = await analyze("code", "deep");

      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/analyze`);
      const parsed = JSON.parse(init?.body as string);
      expect(parsed.code).toBe("code");
      expect(parsed.mode).toBe("deep");
      expect(res).toEqual(result);
    });

    it("defaults mode to fast", async () => {
      mockFetchOk({ success: true, mode: "fast" });

      await analyze("code");

      const parsed = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(parsed.mode).toBe("fast");
    });
  });

  // ---- diff ----

  describe("diff", () => {
    it("sends POST to /pg/diff with before and after", async () => {
      const result = { success: true, hasChanges: true };
      mockFetchOk(result);

      const res = await diff("old code", "new code");

      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/diff`);
      const parsed = JSON.parse(init?.body as string);
      expect(parsed.before).toBe("old code");
      expect(parsed.after).toBe("new code");
      expect(res).toEqual(result);
    });
  });

  // ---- healthCheck ----

  describe("healthCheck", () => {
    it("sends GET to /pg/health", async () => {
      const result = {
        status: "ok",
        compactCli: { installed: true, version: "0.14.0" },
      };
      mockFetchOk(result);

      const res = await healthCheck();

      const [url] = fetchSpy.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/health`);
      expect(res).toEqual(result);
    });

    it("returns unavailable on non-ok response", async () => {
      mockFetchStatus(500);
      const res = await healthCheck();
      expect(res).toEqual({ status: "unavailable" });
    });

    it("returns unavailable on network error", async () => {
      fetchSpy.mockRejectedValueOnce(new Error("network down"));
      const res = await healthCheck();
      expect(res).toEqual({ status: "unavailable" });
    });
  });

  // ---- error handling ----

  describe("error handling", () => {
    it("throws MCPError on 503", async () => {
      mockFetchStatus(503);
      await expect(compile("code")).rejects.toThrow(MCPError);
      await expect(async () => {
        mockFetchStatus(503);
        await format("code");
      }).rejects.toThrow("Compilation service unavailable");
    });

    it("throws MCPError on non-ok response", async () => {
      mockFetchStatus(400, "Bad request body");
      await expect(compile("code")).rejects.toThrow("API error (400): Bad request body");
    });

    it("throws MCPError on network error", async () => {
      fetchSpy.mockRejectedValueOnce(new Error("ECONNREFUSED"));
      await expect(compile("code")).rejects.toThrow("Failed to connect to API");
    });

    it("throws MCPError on abort/timeout", async () => {
      const abortError = new DOMException("The operation was aborted", "AbortError");
      fetchSpy.mockRejectedValueOnce(abortError);
      await expect(compile("code")).rejects.toThrow("Request timed out");
    });
  });
});
