/**
 * Cloudflare Vectorize service
 */

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN!;
const VECTORIZE_INDEX = "midnight-code";

interface VectorData {
  id: string;
  values: number[];
  metadata: Record<string, unknown>;
}

/**
 * Sanitize string for NDJSON format
 * Removes or escapes characters that could break JSON parsing
 */
function sanitizeForNDJSON(value: unknown): unknown {
  if (typeof value === "string") {
    // Remove null bytes and other control characters that break JSON
    // Keep newlines (\n), tabs (\t), and carriage returns (\r) as they're valid
    return value
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // Remove control chars except \t\n\r
      .replace(/\uFFFD/g, "") // Remove replacement character
      .replace(/[\uD800-\uDFFF]/g, ""); // Remove lone surrogates
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeForNDJSON);
  }
  if (value && typeof value === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      sanitized[k] = sanitizeForNDJSON(v);
    }
    return sanitized;
  }
  return value;
}

/**
 * Delete vectors by IDs from Vectorize
 */
export async function deleteVectors(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/vectorize/v2/indexes/${VECTORIZE_INDEX}/delete_by_ids`;

  // Delete in batches of 100
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids: batch }),
    });

    if (!response.ok) {
      console.warn(`  ⚠️ Failed to delete vectors: ${response.status}`);
    }
  }
}

/**
 * Upsert vectors to Vectorize (batched)
 * Sanitizes content to prevent NDJSON parsing errors
 */
export async function upsertToVectorize(
  vectors: VectorData[]
): Promise<unknown> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/vectorize/v2/indexes/${VECTORIZE_INDEX}/upsert`;

  // Sanitize and convert to NDJSON format
  const ndjson = vectors
    .map((v) => JSON.stringify(sanitizeForNDJSON(v)))
    .join("\n");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/x-ndjson",
    },
    body: ndjson,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Vectorize upsert failed: ${response.status} ${text}`);
  }

  return response.json();
}
