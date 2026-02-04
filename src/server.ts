import { routeAgentRequest } from "agents";
import { AIChatAgent } from "@cloudflare/ai-chat";
import {
  type StreamTextOnFinishCallback,
  stepCountIs,
  createUIMessageStream,
  convertToModelMessages,
  createUIMessageStreamResponse,
  type ToolSet
} from "ai";
import * as ai from "ai";
import { openai } from "@ai-sdk/openai";
import {
  wrapAISDK,
  createLangSmithProviderOptions
} from "langsmith/experimental/vercel";
import { z } from "zod";
import { tools } from "./tools";
import type { ContentItem } from "./shared";
import systemPrompt from "./instructions/system_prompt_agent.md?raw";
import { inputGuardrailMiddleware } from "./middleware/inputGuardrail";

const { streamText } = wrapAISDK(ai);
const model = ai.wrapLanguageModel({
  model: openai("gpt-4o-2024-11-20"),
  middleware: inputGuardrailMiddleware
});

/**
 * Zod schema for validating and parsing ContentItem from database rows
 */
const ContentItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  type: z.enum(["project", "blog", "academic", "work"]),
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
  date: z.string().nullable().optional().transform(val => val ?? undefined),
  fullContent: z.string().nullable().optional().transform(val => val ?? undefined),
  link: z.string().nullable().optional().transform(val => val ?? undefined)
});

/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends AIChatAgent<Env> {
  // In-memory cache for database results during the session with TTL
  private contentCache: Map<string, { data: ContentItem[]; timestamp: number }> = new Map();
  // Cache TTL in milliseconds (5 minutes)
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;
  // Max number of cache entries to prevent memory leaks
  private readonly MAX_CACHE_ENTRIES = 100;
  // Retry configuration for database operations
  private readonly RETRY_CONFIG = {
    maxAttempts: 3,
    initialDelayMs: 100,
    maxDelayMs: 2000,
    backoffMultiplier: 2
  };
  // Connection pooling and health check configuration
  private readonly CONNECTION_HEALTH_CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds
  private readonly CONNECTION_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  private lastConnectionHealthCheck: number = 0;
  private lastDBActivity: number = Date.now();
  private isConnectionValid: boolean = true;

  // Rate limiting for contact form submissions (timestamps of submissions)
  private contactSubmissions: number[] = [];

  /**
   * Called when a WebSocket connection is established
   * Captures the connection ID for session tracking and initializes tables
   */
  async onConnect(connection: any) {
    // Store connection ID in the WebSocket attachment so it persists through hibernation
    if (connection.id) {
      connection.serializeAttachment({ connectionId: connection.id });
      console.log(`Chat session started with connection ID: ${connection.id}`);
    } else {
      console.warn("Connection established but no connection ID available");
    }

    // Create contact_messages table if it doesn't exist
    try {
      await this.env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS contact_messages (
          id TEXT,
          email TEXT,
          name TEXT,
          message TEXT,
          timestamp TEXT
        )
      `).run();
      console.log("Contact messages table initialized");

      // Create index on timestamp for efficient rate limit queries
      await this.env.DB.prepare(`
        CREATE INDEX IF NOT EXISTS idx_contact_messages_timestamp 
        ON contact_messages(timestamp)
      `).run();
      console.log("Contact messages timestamp index initialized");
    } catch (error) {
      console.error("Failed to create contact_messages table:", error);
    }
  }

  /**
   * Execute a function with exponential backoff retry logic
   * Handles transient failures common with remote database connections
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;
    let delay = this.RETRY_CONFIG.initialDelayMs;

    for (let attempt = 1; attempt <= this.RETRY_CONFIG.maxAttempts; attempt++) {
      try {
        console.log(`Executing ${operationName} (attempt ${attempt}/${this.RETRY_CONFIG.maxAttempts})`);
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(
          `${operationName} failed on attempt ${attempt}: ${lastError.message}`,
          { delay, remainingAttempts: this.RETRY_CONFIG.maxAttempts - attempt }
        );

        if (attempt < this.RETRY_CONFIG.maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay = Math.min(delay * this.RETRY_CONFIG.backoffMultiplier, this.RETRY_CONFIG.maxDelayMs);
        }
      }
    }

    throw new Error(
      `${operationName} failed after ${this.RETRY_CONFIG.maxAttempts} attempts: ${lastError?.message}`
    );
  }

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
      console.log(`Cleared ${clearedCount} expired cache entries`);
    }
  }

  /**
   * Validate database connection by executing a simple health check query
   * Returns true if connection is healthy, false otherwise
   */
  private async validateConnection(): Promise<boolean> {
    try {
      // Execute a minimal query to test connection validity
      await this.env.DB.prepare(
        "SELECT 1 as health_check"
      ).all();
      
      this.isConnectionValid = true;
      this.lastConnectionHealthCheck = Date.now();
      console.log("Database connection validation successful");
      return true;
    } catch (error) {
      this.isConnectionValid = false;
      console.warn(
        "Database connection validation failed:",
        error instanceof Error ? error.message : String(error)
      );
      return false;
    }
  }

  /**
   * Perform connection health check if needed (based on interval or idle timeout)
   * Proactively validates connection before executing queries
   */
  private async ensureConnectionHealth(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCheck = now - this.lastConnectionHealthCheck;
    const timeSinceLastActivity = now - this.lastDBActivity;

    // Check if connection has been idle too long or if health check interval has passed
    if (
      timeSinceLastCheck > this.CONNECTION_HEALTH_CHECK_INTERVAL_MS ||
      timeSinceLastActivity > this.CONNECTION_IDLE_TIMEOUT_MS ||
      !this.isConnectionValid
    ) {
      console.log("Connection health check needed - validating...");
      await this.validateConnection();
    }
  }

  /**
   * Execute database query with connection validation and retry logic
   * Ensures connection is healthy before executing, with automatic reconnection on failure
   */
  private async executeDBQuery<T>(
    fn: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    // Validate connection before attempting query
    await this.ensureConnectionHealth();

    // Execute with retry logic
    const result = await this.withRetry(async () => {
      // Update activity timestamp
      this.lastDBActivity = Date.now();
      return fn();
    }, operationName);

    return result;
  }

  /**
   * Get the connection ID from the current WebSocket context
   * This works even after hibernation by retrieving from attachment
   */
  private getConnectionId(): string {
    // Primary: Get connection ID from WebSocket attachments (works 99.9% of the time)
    const connections = this.ctx.getWebSockets();
    for (const connection of connections) {
      const attachment = connection.deserializeAttachment();
      if (attachment?.connectionId) {
        return attachment.connectionId;
      }
    }

    // Fallback: Use Durable Object ID - still ensures client isolation
    // since each client connects to their own DO instance
    return this.ctx.id.toString();
  }

  /**
   * Query the vector database for relevant documents with retry logic
   */
  async queryVectorDatabase(
    query: string,
    topK: number = 3
  ): Promise<ContentItem[]> {
    return this.executeDBQuery(async () => {
      // Generate embedding for the query
      const queryEmbedding = await this.env.AI.run("@cf/baai/bge-base-en-v1.5", {
        text: query
      });

      // Extract vector from embedding response
      let queryVector: number[];
      if (Array.isArray(queryEmbedding)) {
        queryVector = queryEmbedding;
      } else if ((queryEmbedding as any).data) {
        const data = (queryEmbedding as any).data;
        // If data is a nested array, get the first element; otherwise use it directly
        queryVector = Array.isArray(data[0]) ? data[0] : data;
      } else {
        queryVector = queryEmbedding as any;
      }
      
      if (!queryVector) {
        throw new Error("Failed to generate query vector embedding");
      }

      // Query the vector index with metadata
      const searchResults = await this.env.VECTOR_INDEX.query(queryVector, {
        topK: topK,
        returnMetadata: "all"
      });

      const contentItems: ContentItem[] = [];
      for (const result of searchResults.matches) {
        const dataType = result.metadata?.data_type as string;
        
        if (!dataType) continue;

        try {
          const { results } = await this.env.DB.prepare(
            `SELECT * FROM ${dataType} WHERE id = ?`
          )
            .bind(result.id)
            .all();

          contentItems.push(...this.parseDBResults(results));
        } catch (error) {
          console.warn(
            `Failed to fetch record ${result.id} from ${dataType}:`,
            error instanceof Error ? error.message : String(error)
          );
          // Skip failed records but continue processing
          continue;
        }
      }
      return contentItems;
    }, `queryVectorDatabase(${query.slice(0, 50)})`);
  }

  /**
   * Fetch content pages from SQLite database with caching and retry logic
   */
  async fetchContentPageFromDB(
    dataType: string,
    id?: string
  ): Promise<ContentItem[]> {
    const cacheKey = `${dataType}${id ? ":" + id : ""}`;

    // Clear expired cache periodically to prevent memory leaks
    this.clearExpiredCache();

    // Check cache first - verify it hasn't expired
    if (this.contentCache.has(cacheKey)) {
      const cached = this.contentCache.get(cacheKey)!;
      const age = Date.now() - cached.timestamp;
      if (age < this.CACHE_TTL_MS) {
        console.log(`Cache hit for ${cacheKey} (age: ${age}ms)`);
        return cached.data;
      } else {
        console.log(`Cache expired for ${cacheKey} (age: ${age}ms), removing`);
        this.contentCache.delete(cacheKey);
      }
    }

    // Cache miss - fetch from database with connection validation and retry logic
    console.log(`Cache miss for ${cacheKey}, fetching from DB`);

    try {
      const result = await this.executeDBQuery(async () => {
        let query = `SELECT * FROM ${dataType}`;
        const params: string[] = [];

        if (id) {
          query += " WHERE id = ?";
          params.push(id);
        }

        const stmt = this.env.DB.prepare(query);
        const { results } =
          params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();

        return results;
      }, `fetchContentPageFromDB(${dataType}${id ? ":" + id : ""})`);

      // Parse and validate JSON fields using Zod
      const parsedResults = this.parseDBResults(result);

      // Enforce max cache size by removing oldest entries if necessary
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
          console.log(`Evicted oldest cache entry (${oldestKey}) to respect max cache size`);
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
        `Failed to fetch ${dataType} from database after retries:`,
        error instanceof Error ? error.message : String(error)
      );
      return [];
    }
  }

  parseDBResults(results: any[]): ContentItem[] {
    return results.map((row: any) => {
      try {
        return ContentItemSchema.parse(row);
      } catch (error) {
        console.error(`Failed to parse content item ${row.id}:`, error);
        // Return a minimal valid item as fallback
        return {
          id: row.id || "unknown",
          title: row.title || "Untitled",
          description: row.description || "",
          type: row.type || "blog"
        };
      }
    }) || [];
  }

  /**
   * Save a contact message to the database with rate limiting
   * Checks three levels (configurable via environment variables):
   * 1. Global rate limit: RATE_LIMIT_GLOBAL_PER_HOUR (default: 100) submissions per hour
   * 2. Session-based rate limit: RATE_LIMIT_SESSION_PER_HOUR (default: 3) per hour
   * 3. Email-based rate limit: RATE_LIMIT_EMAIL_PER_HOUR (default: 3) per hour per email
   */
  async saveContactMessage(email: string, name: string, message: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Clean up old submissions from rate limit tracking (older than 1 hour)
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      this.contactSubmissions = this.contactSubmissions.filter(timestamp => timestamp > oneHourAgo);

      console.log(`Current session submissions in last hour: ${this.contactSubmissions.length}`);

      // Get rate limit values from environment variables with defaults
      const globalLimit = Number.parseInt(this.env.RATE_LIMIT_GLOBAL_PER_HOUR || "100", 10);
      const sessionLimit = Number.parseInt(this.env.RATE_LIMIT_SESSION_PER_HOUR || "3", 10);
      const emailLimit = Number.parseInt(this.env.RATE_LIMIT_EMAIL_PER_HOUR || "3", 10);

      // Check global rate limit (across all sessions and emails)
      const globalRateLimitResult = await this.executeDBQuery(async () => {
        const oneHourAgoISO = new Date(oneHourAgo).toISOString();
        const { results } = await this.env.DB.prepare(
          "SELECT COUNT(*) as count FROM contact_messages WHERE timestamp > ?"
        )
          .bind(oneHourAgoISO)
          .all();
        
        return results[0] as { count: number };
      }, "checkGlobalRateLimit");

      if (globalRateLimitResult.count >= globalLimit) {
        console.warn(`Global rate limit reached: ${globalRateLimitResult.count} submissions in last hour`);
        return {
          success: false,
          error: "Service is currently experiencing high traffic. Please try again later."
        };
      }

      console.log(`Global submissions in last hour: ${globalRateLimitResult.count}/${globalLimit}`);

      // Check session-based rate limit
      if (this.contactSubmissions.length >= sessionLimit) {
        const oldestSubmission = Math.min(...this.contactSubmissions);
        const minutesUntilAvailable = Math.ceil((oldestSubmission + (60 * 60 * 1000) - Date.now()) / (60 * 1000));
        return {
          success: false,
          error: `Rate limit reached. Please try again in ${minutesUntilAvailable} minute${minutesUntilAvailable !== 1 ? 's' : ''}.`
        };
      }

      // Check email-based rate limit
      const emailRateLimitResult = await this.executeDBQuery(async () => {
        const oneHourAgoISO = new Date(oneHourAgo).toISOString();
        const { results } = await this.env.DB.prepare(
          "SELECT COUNT(*) as count FROM contact_messages WHERE email = ? AND timestamp > ?"
        )
          .bind(email, oneHourAgoISO)
          .all();
        
        return results[0] as { count: number };
      }, "checkEmailRateLimit");

      if (emailRateLimitResult.count >= emailLimit) {
        return {
          success: false,
          error: "Rate limit reached. Please try again later."
        };
      }

      // Generate ID and timestamp
      const id = crypto.randomUUID();
      const timestamp = new Date().toISOString();

      // Insert into database
      await this.executeDBQuery(async () => {
        await this.env.DB.prepare(
          "INSERT INTO contact_messages (id, email, name, message, timestamp) VALUES (?, ?, ?, ?, ?)"
        )
          .bind(id, email, name, message, timestamp)
          .run();
      }, "insertContactMessage");

      // Add to session rate limit tracking
      this.contactSubmissions.push(Date.now());

      console.log(`Contact message saved: ${id} from ${email}`);
      return { success: true };
    } catch (error) {
      console.error("Failed to save contact message:", error);
      return {
        success: false,
        error: "Failed to save message. Please try again later."
      };
    }
  }

  /**
   * Handles incoming chat messages and manages the response stream
   */
  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    _options?: { abortSignal?: AbortSignal }
  ) {
    // Get MCP tools safely (handles hot reload issues in development)
    let mcpTools = {};
    try {
      mcpTools = this.mcp.getAITools();
    } catch (error) {
      console.warn('MCP tools not available (likely due to hot reload):', error instanceof Error ? error.message : error);
      // Continue without MCP tools - they'll be available after a full reload
    }

    const allTools = {
      ...tools(
        this.fetchContentPageFromDB.bind(this),
        this.queryVectorDatabase.bind(this)
      ),
      ...mcpTools
    };

    const sessionId = this.getConnectionId();

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const result = streamText({
          system: systemPrompt,
          messages: await convertToModelMessages(this.messages),
          model,
          tools: allTools,
          providerOptions: {
            langsmith: createLangSmithProviderOptions({
              metadata: {
                session_id: sessionId
              }
            })
          },
          // Type boundary: streamText expects specific tool types, but base class uses ToolSet
          // This is safe because our tools satisfy ToolSet interface (verified by 'satisfies' in tools.ts)
          onFinish: onFinish as unknown as StreamTextOnFinishCallback<
            typeof allTools
          >,
          stopWhen: stepCountIs(10)
        });

        writer.merge(result.toUIMessageStream());
      }
    });

    return createUIMessageStreamResponse({ stream });
  }
}

/**
 * Worker entry point that routes incoming requests to the appropriate handler
 */
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    const url = new URL(request.url);
    
    // Handle contact form submissions
    if (url.pathname === '/api/contact' && request.method === 'POST') {
      try {
        // Parse request body
        const body = await request.json() as { email: string; name: string; message: string; sessionId: string };
        
        // Validate input
        const contactSchema = z.object({
          email: z.string().email(),
          name: z.string().min(1),
          message: z.string().min(1).max(1000),
          sessionId: z.string()
        });

        const validation = contactSchema.safeParse(body);
        if (!validation.success) {
          return new Response(
            JSON.stringify({ error: "Invalid input", details: validation.error.errors }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const { email, name, message, sessionId } = validation.data;

        // Get the Chat Durable Object stub for this session
        const id = env.Chat.idFromName(sessionId);
        const chatStub = env.Chat.get(id) as any;

        // Call saveContactMessage directly on the stub
        // The stub will route this to the actual Durable Object instance
        const result = await chatStub.saveContactMessage(email, name, message);

        if (!result.success) {
          return new Response(
            JSON.stringify({ error: result.error }),
            { 
              status: result.error?.includes('Rate limit') ? 429 : 500,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        console.error("Error handling contact submission:", error);
        return new Response(
          JSON.stringify({ error: "Internal server error" }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Try routing to the agent first (for API endpoints like /api/chat)
    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) {
      return agentResponse;
    }

    // Serve static assets from the public directory
    // @ts-expect-error - ASSETS is provided by Cloudflare Workers when assets.directory is configured
    if (env.ASSETS) {
      // @ts-expect-error - ASSETS.fetch is the standard way to serve static files
      return env.ASSETS.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  }
} satisfies ExportedHandler<Env>;
