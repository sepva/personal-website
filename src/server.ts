import { routeAgentRequest } from "agents";
import { AIChatAgent } from "@cloudflare/ai-chat";
import * as ai from "ai";
import {
  type StreamTextOnFinishCallback,
  createUIMessageStream,
  convertToModelMessages,
  createUIMessageStreamResponse,
  type ToolSet,
  wrapLanguageModel,
  stepCountIs
} from "ai";
import {
  wrapAISDK,
  createLangSmithProviderOptions
} from "langsmith/experimental/vercel";
import { z } from "zod";
import { tools } from "./tools";
import systemPrompt from "./instructions/system_prompt_agent.md?raw";
import { createOpenRouterProvider } from "./lib/openrouter";
import { createLogger, type Logger } from "./utils/logger";
import { ContentRepository } from "./repositories/ContentRepository";
import { ContactService } from "./services/ContactService";
import type { ContentItem } from "./shared";
import {
  buildShareableHtml,
  buildSitemapXml,
  fetchShareableLinks,
  getBaseIndexHtml,
  getSeoDefaults
} from "./utils/seo";
import {
  DEFAULT_MAX_HISTORY_MESSAGES,
  DEFAULT_MAX_RETRIES,
  DEFAULT_BASE_DELAY_MS,
  MAX_RETRY_DELAY_MS,
  DEFAULT_BACKOFF_MULTIPLIER,
  API_ENDPOINTS
} from "@/config/constants";
import type { WebSocketConnection, StreamTextConfig, ChatStub } from "@/types";


const fetchShareableContent = async (
  env: Env,
  logger: Logger,
  shareableLink: string
) => {
  const id = env.Chat.idFromName("__content_fetcher__");
  const chatStub = env.Chat.get(id) as unknown as ChatStub;
  const result = (await (chatStub.fetchContentByShareableLink?.(
    shareableLink
  ) || Promise.resolve({ contentItem: null }))) as {
    contentItem?: ContentItem | null;
    allItems?: ContentItem[];
    dataType?: string;
    componentName?: string;
    error?: string;
  };

  if (result.error) {
    logger.error(
      'fetch_shareable_link',
      'Content fetch returned error',
      result.error,
      { linkId: shareableLink },
      'api'
    );
  }

  return result;
};


/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends AIChatAgent<Env & Cloudflare.Env> {
  // Content repository for database operations
  private contentRepository!: ContentRepository;
  // Contact service for handling form submissions with rate limiting
  private contactService!: ContactService;
  // Logger for structured logging
  private logger!: Logger;

  /**
   * Called when a WebSocket connection is established
   * Captures the connection ID for session tracking and initializes tables
   */
  async onConnect(connection: WebSocketConnection) {
    // Initialize logger
    this.logger = createLogger('chat', this.env, {
      connectionId: connection.id,
      sessionId: this.ctx.id.toString()
    });

    this.logger.info(
      'connection_established',
      'WebSocket connection established',
      { connectionId: connection.id },
      'websocket'
    );

    // Initialize content repository
    this.contentRepository = new ContentRepository(
      this.env.DB,
      this.env.AI,
      this.env.VECTOR_INDEX,
      this.env
    );

    // Initialize contact service
    this.contactService = new ContactService(this.env.DB, this.env);

    // Detect reconnection - log but preserve history state
    if (this.messages.length > 0) {
      this.logger.info(
        'reconnection_detected',
        'Reconnection detected with existing message history',
        { messageCount: this.messages.length },
        'websocket'
      );
    }

    // Store connection ID in the WebSocket attachment so it persists through hibernation
    if (connection.id) {
      connection.serializeAttachment({ connectionId: connection.id });
    } else {
      this.logger.warn(
        'connection_no_id',
        'Connection established but no connection ID available',
        {},
        'websocket'
      );
    }

    // Create contact_messages table if it doesn't exist
    const timer = this.logger.startTimer();
    try {
      this.logger.info(
        'table_initialization',
        'Initializing contact_messages table',
        {},
        'database'
      );

      await this.env.DB.prepare(
        `
        CREATE TABLE IF NOT EXISTS contact_messages (
          id TEXT,
          email TEXT,
          name TEXT,
          message TEXT,
          timestamp TEXT
        )
      `
      ).run();

      // Create index on timestamp for efficient rate limit queries
      await this.env.DB.prepare(
        `
        CREATE INDEX IF NOT EXISTS idx_contact_messages_timestamp 
        ON contact_messages(timestamp)
      `
      ).run();

      timer.end(
        'info',
        'table_initialization',
        'Contact messages table initialized successfully',
        {},
        'database'
      );
    } catch (error) {
      timer.end(
        'error',
        'table_initialization',
        'Failed to create contact_messages table',
        {},
        'database'
      );
      this.logger.error(
        'table_initialization_failed',
        'Failed to create contact_messages table',
        error,
        {},
        'database'
      );
    }
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
   * Fetch content by shareable link (delegated to ContentRepository)
   * This method is called via Durable Object RPC from the fetch handler
   */
  async fetchContentByShareableLink(shareableLink: string) {
    // Ensure repository is initialized (for RPC calls outside WebSocket context)
    if (!this.contentRepository) {
      this.contentRepository = new ContentRepository(
        this.env.DB,
        this.env.AI,
        this.env.VECTOR_INDEX,
        this.env
      );
    }
    return this.contentRepository.fetchContentByShareableLink(shareableLink);
  }

  /**
   * Save a contact message (delegated to ContactService)
   * This method is called from tools.ts via RPC
   */
  async saveContactMessage(
    email: string,
    name: string,
    message: string
  ): Promise<{ success: boolean; error?: string }> {
    // Ensure service is initialized (for RPC calls outside WebSocket context)
    if (!this.contactService) {
      this.contactService = new ContactService(this.env.DB, this.env);
    }
    return this.contactService.saveContactMessage(email, name, message);
  }

  /**
   * Applies sliding window to message history
   * Drops oldest conversation turns (user → assistant → tool → assistant sequences)
   * to keep message count under MAX_HISTORY_MESSAGES
   */
  private async applySlidingWindow(): Promise<void> {
    const maxMessages = Number.parseInt(
      this.env.MAX_HISTORY_MESSAGES || String(DEFAULT_MAX_HISTORY_MESSAGES),
      10
    );

    const initialMessageCount = this.messages.length;
    this.logger.debug(
      'sliding_window',
      'Checking message history against limit',
      { initialMessageCount, maxMessages }
    );

    if (this.messages.length <= maxMessages) {
      this.logger.info(
        'sliding_window',
        'No trimming needed',
        { messageCount: this.messages.length, maxMessages, withinLimit: true }
      );
      return; // No need to trim
    }

    this.logger.info(
      'sliding_window',
      'Trimming required - analyzing conversation turns',
      { messageCount: this.messages.length, maxMessages }
    );

    // Convert to model messages to understand structure
    const modelMessages = await convertToModelMessages(this.messages);

    // Find indices where conversation turns start (user messages)
    const turnStartIndices: number[] = [];
    modelMessages.forEach((msg, idx) => {
      if (msg.role === "user") {
        turnStartIndices.push(idx);
      }
    });

    this.logger.debug(
      'sliding_window',
      'Found conversation turns',
      { turnCount: turnStartIndices.length }
    );

    // Calculate how many complete turns to drop
    let messagesToDrop = 0;
    let turnsToRemove = 0;
    for (let i = 0; i < turnStartIndices.length - 1; i++) {
      const turnStart = turnStartIndices[i];
      const nextTurnStart = turnStartIndices[i + 1];
      const turnLength = nextTurnStart - turnStart;

      if (modelMessages.length - messagesToDrop - turnLength >= maxMessages) {
        messagesToDrop += turnLength;
        turnsToRemove++;
      } else {
        break;
      }
    }

    if (messagesToDrop > 0) {
      // Remove oldest messages from UIMessage array
      // UIMessages and ModelMessages have 1:1 correspondence after conversion
      const beforeCount = this.messages.length;
      this.messages = this.messages.slice(messagesToDrop);
      this.logger.warn(
        'message_trim',
        'Dropped oldest conversation turns due to message limit',
        {
          beforeCount,
          afterCount: this.messages.length,
          messagesDropped: messagesToDrop,
          turnsRemoved: turnsToRemove,
          maxMessages
        }
      );
    } else {
      this.logger.debug(
        'sliding_window',
        'No messages dropped - window already optimized',
        {}
      );
    }
  }

  /**
   * Retry wrapper for OpenAI API calls with message trimming on context/rate limit errors
   * Implements exponential backoff and automatic message history reduction
   */
  private async retryWithMessageTrimming<T>(
    fn: () => Promise<T>,
    operationName: string,
    maxAttempts: number = DEFAULT_MAX_RETRIES
  ): Promise<T> {
    let lastError: Error | null = null;
    let delay = DEFAULT_BASE_DELAY_MS;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.logger.debug(
          'ai_retry',
          `Executing ${operationName}`,
          { attempt, maxAttempts, operationName },
          'ai'
        );
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is recoverable (context length or rate limit)
        // Handle both Error objects and structured error objects from OpenAI
        let errorMessage = "";
        if (lastError.message) {
          errorMessage = lastError.message.toLowerCase();
        }
        // Check if error has a structured format (e.g., {error: {code: 'rate_limit_exceeded'}})
        const errorObj = error as { error?: { code?: string }; code?: string };
        const errorCode = errorObj?.error?.code || errorObj?.code || "";

        const isContextError =
          errorMessage.includes("context_length_exceeded") ||
          errorMessage.includes("context length") ||
          errorMessage.includes("maximum context") ||
          errorCode === "context_length_exceeded";
        const isRateLimitError =
          errorMessage.includes("rate_limit_exceeded") ||
          errorMessage.includes("rate limit") ||
          errorMessage.includes("429") ||
          errorCode === "rate_limit_exceeded";

        if (!isContextError && !isRateLimitError) {
          // Not a recoverable error, throw immediately
          this.logger.error(
            'ai_retry',
            'Non-recoverable error encountered',
            error,
            { attempt, operationName, errorType: lastError.constructor.name },
            'ai'
          );
          throw lastError;
        }

        const errorType = isContextError ? "context_length" : "rate_limit";
        this.logger.warn(
          'ai_retry',
          `Retryable ${errorType} error encountered`,
          {
            attempt,
            maxAttempts,
            errorType,
            errorMessage: lastError.message,
            delay,
            remainingAttempts: maxAttempts - attempt
          },
          'ai'
        );

        if (attempt < maxAttempts) {
          // For context errors, try to drop oldest conversation turn
          if (isContextError && this.messages.length > 0) {
            this.logger.info(
              'message_trim',
              'Trimming messages due to context length error',
              { messageCount: this.messages.length },
              'ai'
            );
            // Convert to model messages to find turn boundaries
            const modelMessages = await convertToModelMessages(this.messages);

            // Find the second user message (first turn to keep)
            let secondUserIdx = -1;
            let userCount = 0;
            for (let i = 0; i < modelMessages.length; i++) {
              if (modelMessages[i].role === "user") {
                userCount++;
                if (userCount === 2) {
                  secondUserIdx = i;
                  break;
                }
              }
            }

            if (secondUserIdx > 0) {
              // Drop everything before the second user message
              const beforeCount = this.messages.length;
              this.messages = this.messages.slice(secondUserIdx);
              this.logger.warn(
                'message_trim',
                'Dropped oldest conversation turn',
                {
                  beforeCount,
                  afterCount: this.messages.length,
                  messagesDropped: beforeCount - this.messages.length
                },
                'ai'
              );
            } else if (this.messages.length > 0) {
              // Fallback: just drop the oldest message
              this.messages = this.messages.slice(1);
              this.logger.warn(
                'message_trim',
                'Dropped oldest message as fallback',
                { remainingCount: this.messages.length },
                'ai'
              );
            }
          }

          // Wait with exponential backoff
          this.logger.debug(
            'ai_retry',
            'Waiting before retry with exponential backoff',
            { delay, nextAttempt: attempt + 1 },
            'ai'
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay = Math.min(
            delay * DEFAULT_BACKOFF_MULTIPLIER,
            MAX_RETRY_DELAY_MS
          );
        }
      }
    }

    // All retries exhausted
    this.logger.error(
      'ai_retry',
      'All retry attempts exhausted',
      lastError,
      { maxAttempts, operationName },
      'ai'
    );
    throw new Error(
      `${operationName} failed after ${maxAttempts} attempts: ${lastError?.message}`
    );
  }

  /**
   * Handles incoming chat messages and manages the response stream
   *
   * Special handling for shareable links:
   * - Client sends init-history message with conversation context
   * - We extract the history and inject it before real messages
   * - This gives the AI context about what content the user is viewing
   */
  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    _options?: { abortSignal?: AbortSignal }
  ) {
    // Ensure logger is initialized (in case onConnect wasn't called)
    if (!this.logger) {
      const connectionId = this.getConnectionId();
      this.logger = createLogger('chat', this.env, {
        connectionId: connectionId,
        sessionId: this.ctx.id.toString()
      });
    }
    
    const timer = this.logger.startTimer();
    
    // Ensure repositories/services are initialized (in case onConnect wasn't called)
    if (!this.contentRepository) {
      this.contentRepository = new ContentRepository(
        this.env.DB,
        this.env.AI,
        this.env.VECTOR_INDEX,
        this.env
      );
    }
    if (!this.contactService) {
      this.contactService = new ContactService(this.env.DB, this.env);
    }

    this.logger.info(
      'chat_message_received',
      'Processing incoming chat message',
      { messageCount: this.messages.length },
      'websocket'
    );

    // Check for initialization message with history payload and inject history
    if (this.messages.length > 0) {
      const initMessage = this.messages.find((msg) =>
        msg.parts?.some(
          (part) => (part as { type?: string }).type === "init-history"
        )
      );

      if (initMessage) {
        const initPart = initMessage.parts?.find(
          (part) => (part as { type?: string }).type === "init-history"
        );
        const history = (initPart as { history?: unknown[] })?.history;

        if (history && Array.isArray(history) && history.length > 0) {
          // Remove all init messages from the array
          const messagesWithoutInit = this.messages.filter(
            (msg) =>
              !msg.parts?.some(
                (part) => (part as { type?: string }).type === "init-history"
              )
          );

          // If only init message present, return early (no LLM call needed)
          if (messagesWithoutInit.length === 0) {
            const stream = createUIMessageStream({
              execute: async () => {}
            });
            return createUIMessageStreamResponse({ stream });
          }

          // Inject history before real messages
          this.messages.length = 0;
          this.messages.push(
            ...(history as typeof this.messages),
            ...messagesWithoutInit
          );
        }
      }
    }

    // Apply sliding window to manage message history
    await this.applySlidingWindow();
    // Get MCP tools safely (handles hot reload issues in development)
    let mcpTools = {};
    try {
      mcpTools = this.mcp.getAITools();
    } catch (error) {
      this.logger.warn(
        'mcp_tools_unavailable',
        'MCP tools unavailable, continuing without them',
        {},
        'tools'
      );
      // Continue without MCP tools - they'll be available after a full reload
    }

    const allTools = {
      ...tools(
        this.contentRepository.fetchContentByType.bind(this.contentRepository),
        this.contentRepository.queryVectorDatabase.bind(this.contentRepository)
      ),
      ...mcpTools
    };

    const sessionId = this.getConnectionId();

    // Create model with input guardrail middleware that has access to vector search
    // const inputGuardrailMiddleware = createInputGuardrailMiddleware(
    //   this.contentRepository.queryVectorDatabase.bind(this.contentRepository),
    //   this.env
    // );

    // Wrap AI SDK with LangSmith for full tracing
    const { streamText } = wrapAISDK(ai);

    // Create OpenRouter provider with model fallback chain
    const { provider: openrouter, primaryModel } = createOpenRouterProvider(
      this.env,
      this.env.OPENROUTER_MODELS
    );

    // Wrap model with input guardrail middleware
    const model = wrapLanguageModel({
      model: openrouter.chat(primaryModel),
      middleware: []
      // middleware: inputGuardrailMiddleware
    });

    // Wrap onFinish callback to track model usage
    const wrappedOnFinish: StreamTextOnFinishCallback<ToolSet> = async (
      event
    ) => {
      // LangSmith tracks model usage and costs - no need to log here
      
      // Call original onFinish callback if provided
      if (onFinish) {
        await onFinish(event);
      }
    };

    this.logger.info(
      'ai_stream_start',
      'Starting AI stream',
      { messageCount: this.messages.length },
      'ai'
    );

    // Wrap streamText call with retry logic for context/rate limit errors
    const result = await this.retryWithMessageTrimming(async () => {
      const modelMessages = await convertToModelMessages(this.messages);

      const streamTextConfig: StreamTextConfig = {
        system: systemPrompt,
        messages: modelMessages,
        model,
        tools: allTools,
        stopWhen: stepCountIs(5), // Stop after 5 steps (enables multi-step tool calling)
        providerOptions: {
          openrouter: {
            reasoning: {
              effort: "low" // Optimize for speed - only works with reasoning models (o1/o3, claude-3.7+, deepseek-r1)
            }
          },
          langsmith: createLangSmithProviderOptions({
            metadata: {
              session_id: sessionId
            }
          })
        },
        // Type boundary: streamText expects specific tool types, but base class uses ToolSet
        // This is safe because our tools satisfy ToolSet interface (verified by 'satisfies' in tools.ts)
        onFinish: wrappedOnFinish as unknown as StreamTextOnFinishCallback<
          typeof allTools
        >
      };
      return streamText(streamTextConfig as Parameters<typeof streamText>[0]);
    }, "streamText");

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        try {
          const uiStream = result.toUIMessageStream();
          writer.merge(uiStream);
          
          timer.end(
            'info',
            'ai_stream_complete',
            'AI stream completed successfully',
            {},
            'ai'
          );
        } catch (error) {
          timer.end(
            'error',
            'ai_stream_failed',
            'AI stream failed',
            {},
            'ai'
          );
          this.logger.error(
            'ai_stream_failed',
            'Failed to create UI stream',
            error,
            {},
            'ai'
          );
          throw error;
        }
      }
    });

    const response = createUIMessageStreamResponse({ stream });
    return response;
  }
}

/**
 * Worker entry point that routes incoming requests to the appropriate handler
 */
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    const url = new URL(request.url);
    const requestId = crypto.randomUUID();
    const logger = createLogger('chat', env, { requestId });

    logger.info(
      'http_request',
      'Incoming HTTP request',
      {
        method: request.method,
        path: url.pathname,
        hasQuery: url.search.length > 0
      },
      'api'
    );

    const { baseUrl } = getSeoDefaults();

    if (url.pathname === "/robots.txt" && request.method === "GET") {
      const body = `User-agent: *\nAllow: /\nSitemap: ${baseUrl}/sitemap.xml\n`;
      return new Response(body, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=3600"
        }
      });
    }

    if (url.pathname === "/sitemap.xml" && request.method === "GET") {
      const shareableLinks = await fetchShareableLinks(env, logger);
      const urls = [baseUrl + "/"]
        .concat(
          shareableLinks.map(
            (link) => `${baseUrl}/?link=${encodeURIComponent(link)}`
          )
        );
      const sitemap = buildSitemapXml(urls);
      return new Response(sitemap, {
        status: 200,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "public, max-age=3600"
        }
      });
    }

    if (url.pathname === "/" && request.method === "GET") {
      const shareableLink = url.searchParams.get("link");
      
      if (shareableLink) {
        try {
          const result = await fetchShareableContent(
            env,
            logger,
            shareableLink
          );

          if (!result.contentItem) {
            logger.warn(
              'fetch_shareable_link',
              'Content not found for SSR',
              { linkId: shareableLink },
              'api'
            );
            return new Response(
              JSON.stringify({ error: "Content not found" }),
              {
                status: 404,
                headers: { "Content-Type": "application/json" }
              }
            );
          }

          const baseHtml = await getBaseIndexHtml(request, env);
          if (!baseHtml) {
            logger.error(
              'fetch_shareable_link',
              'Failed to fetch base HTML for SSR',
              undefined,
              { linkId: shareableLink },
              'api'
            );
            return new Response(
              JSON.stringify({ error: "Failed to load base HTML" }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" }
              }
            );
          }

          const canonicalUrl = `${baseUrl}/?link=${encodeURIComponent(
            shareableLink
          )}`;
          const html = buildShareableHtml(
            baseHtml,
            result.contentItem,
            canonicalUrl
          );
          
          return new Response(html, {
            status: 200,
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "public, max-age=300",
              "Content-Security-Policy": "frame-ancestors 'self' https://www.linkedin.com https://*.linkedin.com"
            }
          });
        } catch (error) {
          logger.error(
            'fetch_shareable_link',
            'SSR rendering failed for shareable link',
            error,
            { linkId: shareableLink },
            'api'
          );
          return new Response(
            JSON.stringify({ error: "Internal server error during SSR" }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" }
            }
          );
        }
      } else {
        // No query param - serve static index.html via ASSETS
        // @ts-expect-error - ASSETS is automatically provided by Cloudflare Workers
        if (env.ASSETS) {
          // @ts-expect-error - ASSETS.fetch is the standard way to serve static files
          const response = await env.ASSETS.fetch(request);
          // Add CSP header to allow LinkedIn to embed the site
          const newHeaders = new Headers(response.headers);
          newHeaders.set("Content-Security-Policy", "frame-ancestors 'self' https://www.linkedin.com https://*.linkedin.com");
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders
          });
        }
      }
    }

    // Handle shareable link content fetching
    if (url.pathname === "/api/content" && request.method === "GET") {
      const shareableLink = url.searchParams.get("link");

      if (!shareableLink) {
        return new Response(
          JSON.stringify({ error: "Missing 'link' query parameter" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      try {
        const result = await fetchShareableContent(
          env,
          logger,
          shareableLink
        );

        if (!result.contentItem) {
          return new Response(JSON.stringify({ error: "Content not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" }
          });
        }

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=300" // Cache for 5 minutes
          }
        });
      } catch (error) {
        logger.error(
          'fetch_shareable_link',
          'Failed to fetch content by shareable link',
          error,
          { linkId: shareableLink },
          'api'
        );
        return new Response(
          JSON.stringify({ error: "Internal server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Handle contact form submissions
    if (url.pathname === API_ENDPOINTS.CONTACT && request.method === "POST") {
      try {
        // Parse request body
        const body = (await request.json()) as {
          email: string;
          name: string;
          message: string;
          sessionId: string;
        };

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
            JSON.stringify({
              error: "Invalid input",
              details: validation.error.errors
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        const { email, name, message, sessionId } = validation.data;

        // Get the Chat Durable Object stub for this session
        const id = env.Chat.idFromName(sessionId);
        const chatStub = env.Chat.get(id) as unknown as ChatStub;

        // Call saveContactMessage directly on the stub
        // The stub will route this to the actual Durable Object instance
        const result = await (chatStub.saveContactMessage?.(
          email,
          name,
          message
        ) ||
          Promise.resolve({ success: false, error: "Method not available" }));

        if (!result.success) {
          const status = result.error?.includes("Rate limit") ? 429 : 500;
          return new Response(JSON.stringify({ error: result.error }), {
            status,
            headers: { "Content-Type": "application/json" }
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      } catch (error) {
        logger.error(
          'contact_submission',
          'Failed to handle contact form submission',
          error,
          {},
          'api'
        );
        return new Response(
          JSON.stringify({ error: "Internal server error" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Try routing to the agent first (for API endpoints like /api/chat)
    const agentResponse = await routeAgentRequest(request, env);
    if (agentResponse) {
      return agentResponse;
    }

    // Serve other static assets
    // @ts-expect-error - ASSETS is automatically provided by Cloudflare Workers
    if (env.ASSETS) {
      // @ts-expect-error - ASSETS.fetch is the standard way to serve static files
      const response = await env.ASSETS.fetch(request);
      // Add CSP header to HTML responses to allow LinkedIn to embed the site
      if (response.headers.get("Content-Type")?.includes("text/html")) {
        const newHeaders = new Headers(response.headers);
        newHeaders.set("Content-Security-Policy", "frame-ancestors 'self' https://www.linkedin.com https://*.linkedin.com");
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders
        });
      }
      return response;
    }

    return new Response("Not found", { status: 404 });
  }
} satisfies ExportedHandler<Env>;
