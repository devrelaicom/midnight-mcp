/**
 * Shared type definitions for the Midnight MCP API
 */

// ============== Cloudflare Bindings ==============

export type Bindings = {
  // Existing
  VECTORIZE: VectorizeIndex;
  OPENAI_API_KEY: string;
  ENVIRONMENT: string;
  METRICS: KVNamespace; // OAuth/session storage only
  DB: D1Database; // Metrics, analytics, embedding cache
  // Auth
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  DASHBOARD_ALLOWED_ORGS: string;
  // Rate limiting
  RATE_LIMIT_ANON: RateLimit;
  RATE_LIMIT_AUTH: RateLimit;
  COMPACT_PLAYGROUND_URL: string;
};

export interface AuthUser {
  githubId: number;
  username: string;
  email: string;
  orgs: string[];
  expiresAt: number;
}

export interface AuthState {
  user: AuthUser | null;
  tokenInvalid: boolean;
}

// ============== Metrics Types ==============

export interface QueryLog {
  query: string;
  endpoint: string;
  timestamp: string;
  resultsCount: number;
  avgScore: number;
  topScore: number;
  language?: string;
}

export interface ToolCall {
  tool: string;
  timestamp: string;
  success: boolean;
  durationMs?: number;
  version?: string;
  // playground endpoint, e.g. "/pg/compile"
  endpoint?: string;
}

export interface Metrics {
  totalQueries: number;
  queriesByEndpoint: Record<string, number>;
  queriesByLanguage: Record<string, number>;
  avgRelevanceScore: number;
  scoreDistribution: { high: number; medium: number; low: number };
  recentQueries: QueryLog[];
  documentsByRepo: Record<string, number>;
  lastUpdated: string;
  // Tool tracking
  totalToolCalls: number;
  toolCallsByName: Record<string, number>;
  recentToolCalls: ToolCall[];
  // Playground tracking
  playgroundCalls: number;
  playgroundByEndpoint: Record<string, number>;
  playgroundByVersion: Record<string, number>;
  playgroundErrors: number;
}

// ============== Search Types ==============

export interface SearchRequestBody {
  query: string;
  limit?: number;
  filter?: { language?: string };
}

export interface SearchResult {
  content: string;
  relevanceScore: number;
  source: {
    repository: string;
    filePath: string;
    lines?: string;
  };
  codeType?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  totalResults: number;
  warnings?: string[];
}

// ============== OpenAI Types ==============

export interface EmbeddingResponse {
  data: Array<{ embedding: number[] }>;
}
