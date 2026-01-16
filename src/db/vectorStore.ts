import { ChromaClient, Collection } from "chromadb";
import { config, logger } from "../utils/index.js";
import { embeddingGenerator } from "../pipeline/embeddings.js";

export interface CodeDocument {
  id: string;
  content: string;
  embedding?: number[];
  metadata: {
    repository: string;
    filePath: string;
    language: string;
    startLine: number;
    endLine: number;
    codeType: string;
    codeName: string;
    isPublic: boolean;
    // Version tracking
    repoVersion?: string;
    pragmaVersion?: string;
    indexedAt?: string;
  };
}

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata: CodeDocument["metadata"];
}

export interface SearchFilter {
  repository?: string;
  language?: string;
  codeType?: string;
  isPublic?: boolean;
}

class VectorStore {
  private client: ChromaClient | null = null;
  private collection: Collection | null = null;
  private collectionName = "midnight-code";
  private initialized = false;

  /**
   * Initialize the vector store connection
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.client = new ChromaClient({
        path: config.chromaUrl,
      });

      // Get or create the collection
      this.collection = await this.client.getOrCreateCollection({
        name: this.collectionName,
        metadata: {
          description: "Midnight blockchain code and documentation",
        },
      });

      this.initialized = true;
      logger.info("Vector store initialized successfully");
    } catch (error: unknown) {
      logger.error("Failed to initialize vector store", {
        error: String(error),
      });
      // Continue without vector store - use fallback search
      logger.warn("Vector store unavailable, using in-memory fallback");
    }
  }

  /**
   * Add documents to the vector store
   */
  async addDocuments(documents: CodeDocument[]): Promise<void> {
    if (!this.collection) {
      logger.warn("Vector store not initialized, skipping document storage");
      return;
    }

    try {
      const ids = documents.map((d) => d.id);
      const embeddings = documents.map((d) => d.embedding!);
      const metadatas = documents.map((d) => ({
        repository: d.metadata.repository,
        filePath: d.metadata.filePath,
        language: d.metadata.language,
        startLine: d.metadata.startLine,
        endLine: d.metadata.endLine,
        codeType: d.metadata.codeType,
        codeName: d.metadata.codeName,
        isPublic: d.metadata.isPublic,
      }));
      const documentContents = documents.map((d) => d.content);

      await this.collection.add({
        ids,
        embeddings,
        metadatas,
        documents: documentContents,
      });

      logger.debug(`Added ${documents.length} documents to vector store`);
    } catch (error: unknown) {
      logger.error("Failed to add documents to vector store", {
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Search for similar documents
   */
  async search(
    query: string,
    limit = 10,
    filter?: SearchFilter
  ): Promise<SearchResult[]> {
    if (!this.collection) {
      logger.warn("Vector store not initialized, returning empty results");
      return [];
    }

    try {
      // Generate embedding for the query
      const queryEmbedding = await embeddingGenerator.generateEmbedding(query);

      // Build where filter
      const whereFilter: Record<string, unknown> = {};
      if (filter?.repository) {
        whereFilter.repository = filter.repository;
      }
      if (filter?.language) {
        whereFilter.language = filter.language;
      }
      if (filter?.codeType) {
        whereFilter.codeType = filter.codeType;
      }
      if (filter?.isPublic !== undefined) {
        whereFilter.isPublic = filter.isPublic;
      }

      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding.embedding],
        nResults: limit,
        where: Object.keys(whereFilter).length > 0 ? whereFilter : undefined,
      });

      // Format results
      const searchResults: SearchResult[] = [];
      if (results.ids[0] && results.documents[0] && results.metadatas[0]) {
        for (let i = 0; i < results.ids[0].length; i++) {
          const metadata = results.metadatas[0][i] as CodeDocument["metadata"];
          searchResults.push({
            id: results.ids[0][i],
            content: results.documents[0][i] || "",
            score: results.distances ? 1 - (results.distances[0][i] || 0) : 0,
            metadata,
          });
        }
      }

      return searchResults;
    } catch (error: unknown) {
      logger.error("Search failed", { error: String(error) });
      return [];
    }
  }

  /**
   * Delete documents by file path
   */
  async deleteByPath(repository: string, filePath: string): Promise<void> {
    if (!this.collection) return;

    try {
      await this.collection.delete({
        where: {
          repository,
          filePath,
        },
      });
      logger.debug(`Deleted documents for ${repository}:${filePath}`);
    } catch (error: unknown) {
      logger.error("Failed to delete documents", { error: String(error) });
    }
  }

  /**
   * Delete all documents for a repository
   */
  async deleteRepository(repository: string): Promise<void> {
    if (!this.collection) return;

    try {
      await this.collection.delete({
        where: { repository },
      });
      logger.info(`Deleted all documents for repository ${repository}`);
    } catch (error: unknown) {
      logger.error("Failed to delete repository documents", {
        error: String(error),
      });
    }
  }

  /**
   * Get collection statistics
   */
  async getStats(): Promise<{ count: number }> {
    if (!this.collection) {
      return { count: 0 };
    }

    try {
      const count = await this.collection.count();
      return { count };
    } catch (error: unknown) {
      logger.error("Failed to get stats", { error: String(error) });
      return { count: 0 };
    }
  }

  /**
   * Clear all data from the collection
   */
  async clear(): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.deleteCollection({ name: this.collectionName });
      this.collection = await this.client.getOrCreateCollection({
        name: this.collectionName,
      });
      logger.info("Vector store cleared");
    } catch (error: unknown) {
      logger.error("Failed to clear vector store", { error: String(error) });
    }
  }
}

export const vectorStore = new VectorStore();
