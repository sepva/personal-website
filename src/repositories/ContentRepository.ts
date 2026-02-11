import { z } from "zod";
import type { ContentItem } from "../shared";
import { DATA_TYPE_TO_COMPONENT } from "@/constants";
import { retryWithExponentialBackoff } from "@/utils/retry";

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

  // Cache TTL in milliseconds (5 minutes)
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  // Max number of cache entries to prevent memory leaks
  private readonly MAX_CACHE_ENTRIES = 100;

  // Connection health tracking
  private lastConnectionHealthCheck: number = 0;
  private lastDBActivity: number = Date.now();
  private isConnectionValid: boolean = true;
  private readonly CONNECTION_HEALTH_CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds
  private readonly CONNECTION_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private db: D1Database,
    private ai: Ai,
    private vectorIndex: VectorizeIndex
  ) {}

  /**
   * Clear expired cache entries to prevent memory leaks
   */
  private clearExpiredCache(): void {
    const now = Date.now();
    let clearedCount = 0;

    for (const [key, value] of this.contentCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL_MS) {
        this.contentCache.delete(key);
        clearedCount++;
      }
    }

    if (clearedCount > 0) {
      console.log(
        `[ContentRepository] Cleared ${clearedCount} expired cache entries`
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
      console.log(
        "[ContentRepository] Database connection validation successful"
      );
      return true;
    } catch (error) {
      this.isConnectionValid = false;
      console.warn(
        "[ContentRepository] Database connection validation failed:",
        error instanceof Error ? error.message : String(error)
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
      timeSinceLastCheck > this.CONNECTION_HEALTH_CHECK_INTERVAL_MS ||
      timeSinceLastActivity > this.CONNECTION_IDLE_TIMEOUT_MS ||
      !this.isConnectionValid
    ) {
      console.log(
        "[ContentRepository] Connection health check needed - validating..."
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
        maxAttempts: 3,
        baseDelayMs: 100,
        maxDelayMs: 2000,
        backoffMultiplier: 2,
        onRetry: (attempt, error, delay) => {
          console.warn(
            `${operationName} failed on attempt ${attempt}: ${error.message}`,
            { delay, remainingAttempts: 3 - attempt }
          );
        }
      }
    );

    return result;
  }

  /**
   * Parse and validate database results using Zod schema
   */
  private parseDBResults(results: any[]): ContentItem[] {
    return (
      results.map((row: any) => {
        try {
          return ContentItemSchema.parse(row);
        } catch (error) {
          console.error(
            `[ContentRepository] Failed to parse content item ${row.id}:`,
            error
          );
          // Return a minimal valid item as fallback
          return {
            id: row.id || "unknown",
            title: row.title || "Untitled",
            description: row.description || "",
            type: row.type || "blog"
          };
        }
      }) || []
    );
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
        const queryEmbedding = await this.ai.run("@cf/baai/bge-base-en-v1.5", {
          text: query
        });

        // Extract vector from embedding response
        let queryVector: number[];
        if (Array.isArray(queryEmbedding)) {
          queryVector = queryEmbedding;
        } else if ((queryEmbedding as any).data) {
          const data = (queryEmbedding as any).data;
          queryVector = Array.isArray(data[0]) ? data[0] : data;
        } else {
          queryVector = queryEmbedding as any;
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
      if (age < this.CACHE_TTL_MS) {
        console.log(
          `[ContentRepository] Cache hit for ${cacheKey} (age: ${age}ms)`
        );
        return cached.data;
      } else {
        console.log(
          `[ContentRepository] Cache expired for ${cacheKey}, removing`
        );
        this.contentCache.delete(cacheKey);
      }
    }

    // Cache miss - fetch from database
    console.log(
      `[ContentRepository] Cache miss for ${cacheKey}, fetching from DB`
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
      if (this.contentCache.size >= this.MAX_CACHE_ENTRIES) {
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
          console.log(
            `[ContentRepository] Evicted oldest cache entry (${oldestKey})`
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
      console.error(
        `[ContentRepository] Failed to fetch ${dataType}:`,
        error instanceof Error ? error.message : String(error)
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
