/**
 * Metrics service backed by Cloudflare D1.
 * Replaces the previous KV + in-memory approach to eliminate race conditions
 * and blocking KV I/O on every request.
 */

import type { Metrics, QueryLog, ToolCall } from "../interfaces";

// ---- Counter helpers ----

function upsertCounter(db: D1Database, category: string, name: string, increment: number): D1PreparedStatement {
  return db.prepare(
    `INSERT INTO counters (category, name, value) VALUES (?1, ?2, ?3)
     ON CONFLICT (category, name) DO UPDATE SET value = value + excluded.value`,
  ).bind(category, name, increment);
}

// ---- Pruning ----

async function pruneIfNeeded(db: D1Database): Promise<void> {
  if (Math.random() > 0.02) return; // ~2% chance per write
  try {
    await db.batch([
      db.prepare(
        `DELETE FROM query_log WHERE id NOT IN (SELECT id FROM query_log ORDER BY timestamp DESC LIMIT 200)`,
      ),
      db.prepare(
        `DELETE FROM tool_call_log WHERE id NOT IN (SELECT id FROM tool_call_log ORDER BY timestamp DESC LIMIT 200)`,
      ),
      db.prepare(
        `DELETE FROM embedding_cache WHERE created_at < datetime('now', '-24 hours')`,
      ),
    ]);
  } catch (e) {
    console.error("Failed to prune event logs:", e);
  }
}

// ---- Track functions (async, use db.batch for atomic writes) ----

/**
 * Track a search query. Call inside waitUntil().
 */
export async function trackQuery(
  db: D1Database,
  query: string,
  endpoint: string,
  matches: VectorizeMatches["matches"],
  language?: string,
): Promise<void> {
  try {
    const scores = matches.map((m) => m.score);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const topScore = scores.length > 0 ? Math.max(...scores) : 0;
    const scoreBucket = topScore >= 0.7 ? "high" : topScore >= 0.4 ? "medium" : "low";

    const stmts: D1PreparedStatement[] = [
      upsertCounter(db, "total", "queries", 1),
      upsertCounter(db, "score", "avg_relevance_sum", avgScore),
      upsertCounter(db, "score", scoreBucket, 1),
      upsertCounter(db, "endpoint", endpoint, 1),
      db.prepare(
        `INSERT INTO query_log (query, endpoint, timestamp, results_count, avg_score, top_score, language)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
      ).bind(
        query.slice(0, 100),
        endpoint,
        new Date().toISOString(),
        matches.length,
        Math.round(avgScore * 1000) / 1000,
        Math.round(topScore * 1000) / 1000,
        language ?? null,
      ),
    ];

    if (language) {
      stmts.push(upsertCounter(db, "language", language, 1));
    }

    // Track repos from results (increment by count per repo)
    const repoCounts = new Map<string, number>();
    for (const m of matches) {
      const repo = m.metadata?.repository as string;
      if (repo) repoCounts.set(repo, (repoCounts.get(repo) ?? 0) + 1);
    }
    for (const [repo, count] of repoCounts) {
      stmts.push(upsertCounter(db, "repo", repo, count));
    }

    await db.batch(stmts);
    await pruneIfNeeded(db);
  } catch (e) {
    console.error("Failed to track query:", e);
  }
}

/**
 * Track a tool call from the MCP. Call inside waitUntil().
 */
export async function trackToolCall(
  db: D1Database,
  tool: string,
  success: boolean,
  durationMs?: number,
  version?: string,
): Promise<void> {
  try {
    await db.batch([
      upsertCounter(db, "total", "tool_calls", 1),
      upsertCounter(db, "tool", tool, 1),
      db.prepare(
        `INSERT INTO tool_call_log (tool, timestamp, success, duration_ms, version)
         VALUES (?1, ?2, ?3, ?4, ?5)`,
      ).bind(tool, new Date().toISOString(), success ? 1 : 0, durationMs ?? null, version ?? null),
    ]);
    await pruneIfNeeded(db);
  } catch (e) {
    console.error("Failed to track tool call:", e);
  }
}

/**
 * Track a playground proxy call. Call inside waitUntil().
 */
export async function trackPlaygroundCall(
  db: D1Database,
  endpoint: string,
  success: boolean,
  durationMs?: number,
  version?: string | null,
): Promise<void> {
  try {
    const stmts: D1PreparedStatement[] = [
      upsertCounter(db, "total", "playground_calls", 1),
      upsertCounter(db, "pg_endpoint", endpoint, 1),
      db.prepare(
        `INSERT INTO tool_call_log (tool, timestamp, success, duration_ms, version, endpoint)
         VALUES ('pg-proxy', ?1, ?2, ?3, ?4, ?5)`,
      ).bind(new Date().toISOString(), success ? 1 : 0, durationMs ?? null, version ?? null, endpoint),
    ];

    if (version) {
      stmts.push(upsertCounter(db, "pg_version", version, 1));
    }

    if (!success) {
      stmts.push(upsertCounter(db, "total", "playground_errors", 1));
    }

    await db.batch(stmts);
    await pruneIfNeeded(db);
  } catch (e) {
    console.error("Failed to track playground call:", e);
  }
}

// ---- Read functions ----

/**
 * Read all metrics from D1, returning the full Metrics object.
 */
export async function getMetrics(db: D1Database): Promise<Metrics> {
  const [countersResult, recentQueriesResult, recentToolCallsResult] = await db.batch([
    db.prepare(`SELECT category, name, value FROM counters`),
    db.prepare(`SELECT * FROM query_log ORDER BY timestamp DESC LIMIT 100`),
    db.prepare(`SELECT * FROM tool_call_log ORDER BY timestamp DESC LIMIT 100`),
  ]);

  // Build counter lookup
  const c = new Map<string, number>();
  const byCategory = new Map<string, Record<string, number>>();

  for (const row of countersResult.results as Array<{ category: string; name: string; value: number }>) {
    c.set(`${row.category}:${row.name}`, row.value);
    if (!byCategory.has(row.category)) byCategory.set(row.category, {});
    byCategory.get(row.category)![row.name] = row.value;
  }

  const totalQueries = c.get("total:queries") ?? 0;
  const avgRelevanceSum = c.get("score:avg_relevance_sum") ?? 0;

  // Map query_log rows
  const recentQueries: QueryLog[] = (recentQueriesResult.results as Array<{
    query: string; endpoint: string; timestamp: string;
    results_count: number; avg_score: number; top_score: number; language: string | null;
  }>).map((r) => ({
    query: r.query,
    endpoint: r.endpoint,
    timestamp: r.timestamp,
    resultsCount: r.results_count,
    avgScore: r.avg_score,
    topScore: r.top_score,
    language: r.language ?? undefined,
  }));

  // Map tool_call_log rows
  const recentToolCalls: ToolCall[] = (recentToolCallsResult.results as Array<{
    tool: string; timestamp: string; success: number;
    duration_ms: number | null; version: string | null; endpoint: string | null;
  }>).map((r) => ({
    tool: r.tool,
    timestamp: r.timestamp,
    success: r.success === 1,
    durationMs: r.duration_ms ?? undefined,
    version: r.version ?? undefined,
    endpoint: r.endpoint ?? undefined,
  }));

  const lastTs = recentToolCalls[0]?.timestamp ?? recentQueries[0]?.timestamp ?? new Date().toISOString();

  return {
    totalQueries,
    queriesByEndpoint: byCategory.get("endpoint") ?? {},
    queriesByLanguage: byCategory.get("language") ?? {},
    avgRelevanceScore: totalQueries > 0 ? Math.round((avgRelevanceSum / totalQueries) * 1000) / 1000 : 0,
    scoreDistribution: {
      high: c.get("score:high") ?? 0,
      medium: c.get("score:medium") ?? 0,
      low: c.get("score:low") ?? 0,
    },
    recentQueries,
    documentsByRepo: byCategory.get("repo") ?? {},
    lastUpdated: lastTs,
    totalToolCalls: c.get("total:tool_calls") ?? 0,
    toolCallsByName: byCategory.get("tool") ?? {},
    recentToolCalls,
    playgroundCalls: c.get("total:playground_calls") ?? 0,
    playgroundByEndpoint: byCategory.get("pg_endpoint") ?? {},
    playgroundByVersion: byCategory.get("pg_version") ?? {},
    playgroundErrors: c.get("total:playground_errors") ?? 0,
  };
}
