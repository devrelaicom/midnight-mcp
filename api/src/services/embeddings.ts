/**
 * OpenAI embeddings service with D1 caching.
 * Caches embedding vectors by normalized query hash to avoid redundant API calls.
 */

import { z } from "zod";

/** Zod schema for OpenAI embeddings API response. Requires at least one embedding. */
const EmbeddingResponseSchema = z.object({
  data: z
    .array(z.object({ embedding: z.array(z.number()) }))
    .min(1, "OpenAI returned empty embeddings array"),
});

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
 * Generate embedding using OpenAI API, with D1 caching.
 * Cache hit: returns cached vector, skips OpenAI call.
 * Cache miss: calls OpenAI, stores in D1, returns vector.
 */
export async function getEmbedding(
  text: string,
  apiKey: string,
  db: D1Database
): Promise<number[]> {
  const normalized = normalizeQuery(text);
  const hash = await hashQuery(normalized);
  const cacheKey = `embedding:${hash}`;

  // Try cache first
  const row = await db.prepare(
    `SELECT embedding FROM embedding_cache WHERE cache_key = ?1`,
  ).bind(cacheKey).first<{ embedding: string }>();
  if (row) {
    return JSON.parse(row.embedding) as number[];
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

  const raw: unknown = await response.json();
  const parsed = EmbeddingResponseSchema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues[0]?.message ?? "unexpected shape";
    throw new Error(`Invalid OpenAI embeddings response: ${detail}`);
  }
  const embedding = parsed.data.data[0]!.embedding;

  // Store in cache
  await db.prepare(
    `INSERT OR REPLACE INTO embedding_cache (cache_key, embedding, created_at)
     VALUES (?1, ?2, datetime('now'))`,
  ).bind(cacheKey, JSON.stringify(embedding)).run();

  return embedding;
}
