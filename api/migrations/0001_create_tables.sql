-- Atomic counters for scalars and keyed breakdowns.
-- category groups counters; name is the sub-key.
CREATE TABLE IF NOT EXISTS counters (
  category TEXT NOT NULL,
  name     TEXT NOT NULL,
  value    REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (category, name)
);

-- Recent search queries (read with LIMIT 100)
CREATE TABLE IF NOT EXISTS query_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  query         TEXT    NOT NULL,
  endpoint      TEXT    NOT NULL,
  timestamp     TEXT    NOT NULL,
  results_count INTEGER NOT NULL,
  avg_score     REAL    NOT NULL,
  top_score     REAL    NOT NULL,
  language      TEXT
);

CREATE INDEX IF NOT EXISTS idx_query_log_ts ON query_log (timestamp DESC);

-- Recent tool calls and playground calls (read with LIMIT 100)
CREATE TABLE IF NOT EXISTS tool_call_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tool        TEXT    NOT NULL,
  timestamp   TEXT    NOT NULL,
  success     INTEGER NOT NULL,
  duration_ms INTEGER,
  version     TEXT,
  endpoint    TEXT
);

CREATE INDEX IF NOT EXISTS idx_tool_call_log_ts ON tool_call_log (timestamp DESC);

-- Embedding vector cache (replaces EMBEDDING_CACHE KV namespace)
CREATE TABLE IF NOT EXISTS embedding_cache (
  cache_key  TEXT PRIMARY KEY,
  embedding  TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
