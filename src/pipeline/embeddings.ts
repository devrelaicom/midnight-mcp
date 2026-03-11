import OpenAI from "openai";
import { config, logger } from "../utils/index.js";

export interface EmbeddingResult {
  text: string;
  embedding: number[];
  model: string;
  tokenCount?: number;
}

export class EmbeddingGenerator {
  private openai: OpenAI | null = null;
  private model: string;

  constructor() {
    this.model = config.embeddingModel;
    if (config.openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: config.openaiApiKey,
      });
    }
  }

  /**
   * Returns true if no OpenAI API key is configured and dummy embeddings will be used.
   */
  get isDummyMode(): boolean {
    return this.openai === null;
  }

  /**
   * Generate embeddings for a single text
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    if (!this.openai) {
      // Return a dummy embedding for testing without API key
      logger.warn("No OpenAI API key configured, using dummy embeddings");
      return {
        text,
        embedding: new Array(1536).fill(0).map(() => Math.random() - 0.5),
        model: "dummy",
      };
    }

    try {
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: text,
      });

      const embedding = response.data[0].embedding;
      const EXPECTED_DIMENSIONS = 1536; // text-embedding-3-small default
      if (!embedding || embedding.length !== EXPECTED_DIMENSIONS) {
        logger.warn("Unexpected embedding dimensions", {
          expected: EXPECTED_DIMENSIONS,
          actual: embedding?.length ?? 0,
          model: this.model,
        });
      }

      return {
        text,
        embedding,
        model: this.model,
        tokenCount: response.usage?.total_tokens,
      };
    } catch (error: unknown) {
      logger.error("Failed to generate embedding", { error: String(error) });
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    if (!this.openai) {
      logger.warn("No OpenAI API key configured, using dummy embeddings");
      return texts.map((text) => ({
        text,
        embedding: new Array(1536).fill(0).map(() => Math.random() - 0.5),
        model: "dummy",
      }));
    }

    try {
      // OpenAI allows up to 2048 inputs per request
      const batchSize = 100;
      const results: EmbeddingResult[] = [];

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        logger.debug(`Generating embeddings for batch ${i / batchSize + 1}`);

        const response = await this.openai.embeddings.create({
          model: this.model,
          input: batch,
        });

        for (let j = 0; j < batch.length; j++) {
          results.push({
            text: batch[j],
            embedding: response.data[j].embedding,
            model: this.model,
          });
        }
      }

      return results;
    } catch (error: unknown) {
      logger.error("Failed to generate batch embeddings", {
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Embeddings must have the same length");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

export const embeddingGenerator = new EmbeddingGenerator();
