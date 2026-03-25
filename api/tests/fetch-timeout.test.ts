/**
 * Tests for fetchWithTimeout utility.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchWithTimeout } from "../src/utils/fetch";

// Save original fetch so we can restore it
const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("fetchWithTimeout", () => {
  it("passes through a successful response", async () => {
    const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    const res = await fetchWithTimeout("https://example.com/api");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it("forwards request init options to fetch", async () => {
    const mockResponse = new Response("ok", { status: 200 });
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    await fetchWithTimeout("https://example.com/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: 1 }),
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://example.com/api",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: 1 }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("sets an AbortSignal with the specified timeout", async () => {
    const mockResponse = new Response("ok", { status: 200 });
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    await fetchWithTimeout("https://example.com/api", {}, 5_000);

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const signal = callArgs[1]?.signal as AbortSignal;
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it("throws on timeout (simulated via abort)", async () => {
    // Simulate a fetch that never resolves before the signal aborts
    globalThis.fetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        if (init?.signal) {
          init.signal.addEventListener("abort", () => {
            reject(init.signal!.reason ?? new DOMException("The operation was aborted.", "AbortError"));
          });
        }
      });
    });

    // Use a very short timeout to trigger abort quickly
    await expect(fetchWithTimeout("https://example.com/slow", {}, 1)).rejects.toThrow();
  });

  it("defaults to 30s timeout", async () => {
    const mockResponse = new Response("ok", { status: 200 });
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    await fetchWithTimeout("https://example.com/api");

    // Verify the signal was passed (we can't easily read the timeout value,
    // but we can confirm a signal exists)
    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[1]?.signal).toBeTruthy();
  });
});
