/**
 * Sampling service for agentic workflows
 *
 * Enables the MCP server to request LLM completions from the client,
 * allowing for sophisticated multi-step workflows like:
 * - Auto-generating contracts from examples
 * - Code review with suggested fixes
 * - Documentation generation
 */

import { logger } from "../utils/index.js";
import type { SamplingRequest, SamplingResponse, ModelPreferences } from "../types/index.js";

// Type for the sampling callback
type SamplingCallback = (request: SamplingRequest) => Promise<SamplingResponse>;

// Store for the sampling callback
let samplingCallback: SamplingCallback | null = null;

// Track if sampling has permanently failed (client doesn't support it)
let samplingFailedPermanently = false;

/**
 * Reset all module-level mutable state to initial values.
 * Used for test isolation.
 */
export function resetSamplingState(): void {
  samplingCallback = null;
  samplingFailedPermanently = false;
}

/**
 * Check if sampling is available
 * Returns false if client doesn't support sampling (detected on first failed call)
 */
export function isSamplingAvailable(): boolean {
  if (samplingFailedPermanently) return false;
  return samplingCallback !== null;
}

/**
 * Mark sampling as permanently failed (client doesn't support it)
 */
export function markSamplingFailed(): void {
  samplingFailedPermanently = true;
  logger.warn("Sampling marked as permanently unavailable for this session");
}

/**
 * Register the sampling callback from the client
 * This is called during server initialization when client supports sampling
 */
export function registerSamplingCallback(callback: SamplingCallback): void {
  samplingCallback = callback;
  samplingFailedPermanently = false;
  logger.info("Sampling capability registered");
}

/**
 * Request a completion from the LLM via the client
 */
export async function requestCompletion(
  messages: { role: "user" | "assistant"; content: string }[],
  options: {
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
    modelPreferences?: ModelPreferences;
  } = {},
): Promise<string> {
  if (!samplingCallback || samplingFailedPermanently) {
    throw new Error("Sampling not available - client does not support this capability");
  }

  const request: SamplingRequest = {
    messages: messages.map((m) => ({
      role: m.role,
      content: { type: "text" as const, text: m.content },
    })),
    systemPrompt: options.systemPrompt,
    maxTokens: options.maxTokens ?? 2048,
    temperature: options.temperature ?? 0.7,
    modelPreferences: options.modelPreferences ?? {
      hints: [{ name: "claude-3-sonnet" }, { name: "gpt-4" }],
      intelligencePriority: 0.8,
      speedPriority: 0.5,
    },
  };

  logger.debug("Requesting LLM completion", {
    messageCount: messages.length,
    maxTokens: request.maxTokens,
  });

  try {
    const response = await samplingCallback(request);

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (response.content.type !== "text") {
      throw new Error("Unexpected response content type");
    }

    return response.content.text;
  } catch (error: unknown) {
    const errorStr = String(error);

    // Check for "Method not found" error which indicates client doesn't support sampling
    if (
      errorStr.includes("-32601") ||
      errorStr.includes("Method not found") ||
      errorStr.includes("not supported")
    ) {
      logger.warn(
        "Client does not support sampling/createMessage, disabling sampling for this session",
      );
      markSamplingFailed();
      throw new Error(
        "Sampling not supported by this client - use Claude Desktop for this feature",
        { cause: error },
      );
    }

    throw error;
  }
}
