/**
 * OpenAI embeddings service with KV caching.
 * Caches embedding vectors by normalized query hash to avoid redundant API calls.
 */

import type { EmbeddingResponse } from "../interfaces";

/**
 * Normalize a query for consistent cache keys.
 */
function normalizeQuery(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Hash a string using SHA-256, return hex string.
 */
async function hashQuery(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generate embedding using OpenAI API, with KV caching.
 * Cache hit: returns cached vector, skips OpenAI call.
 * Cache miss: calls OpenAI, stores in KV with 24h TTL, returns vector.
 */
export async function getEmbedding(
  text: string,
  apiKey: string,
  cache: KVNamespace
): Promise<number[]> {
  const normalized = normalizeQuery(text);
  const hash = await hashQuery(normalized);
  const cacheKey = `embedding:${hash}`;

  // Try cache first
  const cached = await cache.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as number[];
  }

  // Cache miss — call OpenAI
  const truncatedText = text.slice(0, 8000);

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: truncatedText,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = (await response.json()) as EmbeddingResponse;
  const embedding = data.data[0].embedding;

  // Store in cache with 24h TTL
  await cache.put(cacheKey, JSON.stringify(embedding), {
    expirationTtl: 24 * 60 * 60,
  });

  return embedding;
}
