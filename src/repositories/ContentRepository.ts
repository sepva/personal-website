import { z } from "zod";
import type { ContentItem } from "../shared";
import { retryWithExponentialBackoff } from "@/utils/retry";
import { createLogger, type Logger } from "@/utils/logger";
import {
  CACHE_TTL_MS,
  MAX_CACHE_ENTRIES,
  CONNECTION_HEALTH_CHECK_INTERVAL_MS,
  CONNECTION_IDLE_TIMEOUT_MS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_BASE_DELAY_MS,
  MAX_RETRY_DELAY_MS,
  DEFAULT_BACKOFF_MULTIPLIER,
  DATA_TYPE_TO_COMPONENT
} from "@/config/constants";
import type { EmbeddingResult } from "@/types";

/**
 * Zod schema for validating and parsing ContentItem from database rows
 */
const ContentItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  type: z.enum(["project", "blog", "academic", "work", "faq"]),
  tags: z
    .string()
    .transform((val) => {
      try {
        return typeof val === "string" ? JSON.parse(val) : val;
      } catch {
        return [];
      }
    })
    .pipe(z.array(z.string()))
    .optional(),
  date: z
    .string()
    .nullable()
    .optional()
    .transform((val) => val ?? undefined),
  fullContent: z
    .string()
    .nullable()
    .optional()
    .transform((val) => val ?? undefined),
  link: z
    .string()
    .nullable()
    .optional()
    .transform((val) => val ?? undefined),
  shareable_link: z
    .string()
    .nullable()
    .optional()
    .transform((val) => val ?? undefined)
});

/**
 * Cache entry with timestamp for TTL management
 */
interface CacheEntry {
  data: ContentItem[];
  timestamp: number;
}

/**
 * Repository for managing content database operations with caching and retry logic.
 * Follows the Repository Pattern to separate data access from business logic.
 */
export class ContentRepository {
  // In-memory cache for database results with TTL
  private contentCache: Map<string, CacheEntry> = new Map();

  // Connection health tracking
  private lastConnectionHealthCheck: number = 0;
  private lastDBActivity: number = Date.now();
  private isConnectionValid: boolean = true;

  // Logger for structured logging
  private logger: Logger;

  constructor(
    private db: D1Database,
    private ai: Ai,
    private vectorIndex: VectorizeIndex,
    env: { LOGGER_LEVEL?: string; LOGGER_FORMAT?: 'json' | 'pretty' }
  ) {
    this.logger = createLogger('content', env);
  }

  /**
   * Clear expired cache entries to prevent memory leaks
   */
  private clearExpiredCache(): void {
    const now = Date.now();
    let clearedCount = 0;

    for (const [key, value] of this.contentCache.entries()) {
      if (now - value.timestamp > CACHE_TTL_MS) {
        this.contentCache.delete(key);
        clearedCount++;
      }
    }

    if (clearedCount > 0) {
      this.logger.debug(
        'cache_cleanup',
        'Cleared expired cache entries',
        { clearedCount, cacheSize: this.contentCache.size },
        'cache'
      );
    }
  }

  /**
   * Validate database connection by executing a simple health check query
   */
  private async validateConnection(): Promise<boolean> {
    try {
      await this.db.prepare("SELECT 1 as health_check").all();

      this.isConnectionValid = true;
      this.lastConnectionHealthCheck = Date.now();
      this.logger.info(
        'health_check',
        'Database connection validation successful',
        {},
        'database'
      );
      return true;
    } catch (error) {
      this.isConnectionValid = false;
      this.logger.error(
        'health_check_failed',
        'Database connection validation failed',
        error,
        {},
        'database'
      );
      return false;
    }
  }

  /**
   * Perform connection health check if needed
   */
  private async ensureConnectionHealth(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCheck = now - this.lastConnectionHealthCheck;
    const timeSinceLastActivity = now - this.lastDBActivity;

    if (
      timeSinceLastCheck > CONNECTION_HEALTH_CHECK_INTERVAL_MS ||
      timeSinceLastActivity > CONNECTION_IDLE_TIMEOUT_MS ||
      !this.isConnectionValid
    ) {
      this.logger.info(
        'health_check',
        'Connection health check needed - validating',
        { timeSinceLastCheck, timeSinceLastActivity },
        'database'
      );
      await this.validateConnection();
    }
  }

  /**
   * Execute database query with connection validation and retry logic
   */
  private async executeDBQuery<T>(
    fn: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    await this.ensureConnectionHealth();

    const result = await retryWithExponentialBackoff(
      async () => {
        this.lastDBActivity = Date.now();
        return fn();
      },
      {
        maxAttempts: DEFAULT_MAX_RETRIES,
        baseDelayMs: DEFAULT_BASE_DELAY_MS,
        maxDelayMs: MAX_RETRY_DELAY_MS,
        backoffMultiplier: DEFAULT_BACKOFF_MULTIPLIER,
        onRetry: (attempt, error, delay) => {
          console.warn(
            `${operationName} failed on attempt ${attempt}: ${error.message}`,
            { delay, remainingAttempts: DEFAULT_MAX_RETRIES - attempt }
          );
        }
      }
    );

    return result;
  }

  /**
   * Parse and validate database results using Zod schema
   */
  private parseDBResults(results: unknown[]): ContentItem[] {
    return results
      .map((row: unknown) => {
        try {
          return ContentItemSchema.parse(row);
        } catch (error) {
          // Type guard for row to check if it has expected properties
          const rowObj = row as Record<string, unknown>;
          console.error(
            `[ContentRepository] Failed to parse content item ${rowObj?.id}:`,
            error
          );
          // Return a minimal valid item as fallback
          return {
            id: (rowObj?.id as string) || "unknown",
            title: (rowObj?.title as string) || "Untitled",
            description: (rowObj?.description as string) || "",
            type:
              (rowObj?.type as ContentItem["type"] as ContentItem["type"]) ||
              "blog"
          };
        }
      })
      .filter((item): item is ContentItem => item !== null);
  }

  /**
   * Query the vector database for relevant documents
   */
  async queryVectorDatabase(
    query: string,
    topK: number = 3
  ): Promise<ContentItem[]> {
    return this.executeDBQuery(
      async () => {
        // Generate embedding for the query
        const queryEmbedding = (await this.ai.run("@cf/baai/bge-base-en-v1.5", {
          text: query
        })) as EmbeddingResult;

        // Extract vector from embedding response
        let queryVector: number[];
        if (Array.isArray(queryEmbedding)) {
          queryVector = queryEmbedding;
        } else if (queryEmbedding.data) {
          const data = queryEmbedding.data;
          // Handle both single and batched embedding responses
          if (Array.isArray(data[0])) {
            queryVector = data[0];
          } else {
            queryVector = data as unknown as number[];
          }
        } else {
          queryVector = queryEmbedding as unknown as number[];
        }

        if (!queryVector) {
          throw new Error("Failed to generate query vector embedding");
        }

        // Query the vector index with metadata
        const searchResults = await this.vectorIndex.query(queryVector, {
          topK: topK,
          returnMetadata: "all"
        });

        const contentItems: ContentItem[] = [];
        for (const result of searchResults.matches) {
          const dataType = result.metadata?.data_type as string;

          if (!dataType) continue;

          try {
            const { results } = await this.db
              .prepare(`SELECT * FROM ${dataType} WHERE id = ?`)
              .bind(result.id)
              .all();

            contentItems.push(...this.parseDBResults(results));
          } catch (error) {
            console.warn(
              `[ContentRepository] Failed to fetch record ${result.id} from ${dataType}:`,
              error instanceof Error ? error.message : String(error)
            );
            continue;
          }
        }
        return contentItems;
      },
      `queryVectorDatabase(${query.slice(0, 50)})`
    );
  }

  /**
   * Fetch content pages from database with caching and retry logic
   */
  async fetchContentByType(
    dataType: string,
    id?: string
  ): Promise<ContentItem[]> {
    const cacheKey = `${dataType}${id ? ":" + id : ""}`;

    // Clear expired cache periodically
    this.clearExpiredCache();

    // Check cache first
    if (this.contentCache.has(cacheKey)) {
      const cached = this.contentCache.get(cacheKey)!;
      const age = Date.now() - cached.timestamp;
      if (age < CACHE_TTL_MS) {
        this.logger.debug(
          'cache_hit',
          'Cache hit for content query',
          { cacheKey, age, ttl: CACHE_TTL_MS },
          'cache'
        );
        return cached.data;
      } else {
        this.logger.debug(
          'cache_expired',
          'Cache expired for content query',
          { cacheKey, age },
          'cache'
        );
        this.contentCache.delete(cacheKey);
      }
    }

    // Cache miss - fetch from database
    this.logger.info(
      'db_query',
      'Cache miss - fetching content from database',
      { cacheKey, contentType: dataType, cacheHit: false },
      'database'
    );

    try {
      const result = await this.executeDBQuery(
        async () => {
          let query = `SELECT * FROM ${dataType}`;
          const params: string[] = [];

          if (id) {
            query += " WHERE id = ?";
            params.push(id);
          }

          const stmt = this.db.prepare(query);
          const { results } =
            params.length > 0
              ? await stmt.bind(...params).all()
              : await stmt.all();

          return results;
        },
        `fetchContentByType(${dataType}${id ? ":" + id : ""})`
      );

      const parsedResults = this.parseDBResults(result);

      // Enforce max cache size by evicting oldest entry
      if (this.contentCache.size >= MAX_CACHE_ENTRIES) {
        let oldestKey: string | null = null;
        let oldestTimestamp = Infinity;

        for (const [key, value] of this.contentCache.entries()) {
          if (value.timestamp < oldestTimestamp) {
            oldestTimestamp = value.timestamp;
            oldestKey = key;
          }
        }

        if (oldestKey) {
          this.contentCache.delete(oldestKey);
          this.logger.info(
            'cache_eviction',
            'Evicted oldest cache entry due to size limit',
            { evictedKey: oldestKey, cacheSize: this.contentCache.size },
            'cache'
          );
        }
      }

      // Store in cache with timestamp
      this.contentCache.set(cacheKey, {
        data: parsedResults,
        timestamp: Date.now()
      });

      return parsedResults;
    } catch (error) {
      this.logger.error(
        'db_query_failed',
        'Failed to fetch content from database',
        error,
        { contentType: dataType, cacheKey },
        'database'
      );
      return [];
    }
  }

  /**
   * Fetch content by shareable link
   * Searches all content tables and returns the matching item plus all items of that type
   */
  async fetchContentByShareableLink(shareableLink: string): Promise<{
    contentItem: ContentItem | null;
    allItems: ContentItem[];
    dataType: string;
    componentName: string;
  }> {
    const dataTypes = ["academic", "work", "projects"];

    for (const dataType of dataTypes) {
      try {
        const { results } = await this.db
          .prepare(`SELECT * FROM ${dataType} WHERE shareable_link = ?`)
          .bind(shareableLink)
          .all();

        if (results && results.length > 0) {
          const parsedResults = this.parseDBResults(results);
          const contentItem = parsedResults[0];

          // Fetch all items of this type for the overview page
          const allItems = await this.fetchContentByType(dataType);

          return {
            contentItem,
            allItems,
            dataType,
            componentName: DATA_TYPE_TO_COMPONENT[dataType]
          };
        }
      } catch (error) {
        console.warn(
          `[ContentRepository] Error searching ${dataType} for shareable_link:`,
          error
        );
        continue;
      }
    }

    // Not found in any table
    return {
      contentItem: null,
      allItems: [],
      dataType: "",
      componentName: ""
    };
  }
}
