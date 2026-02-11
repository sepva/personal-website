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
import { createInputGuardrailMiddleware } from "./middleware/inputGuardrail";
import { createOpenRouterProvider } from "./lib/openrouter";
import { ContentRepository } from "./repositories/ContentRepository";
import { ContactService } from "./services/ContactService";
import {
  DEFAULT_MAX_HISTORY_MESSAGES,
  DEFAULT_MAX_RETRIES,
  DEFAULT_BASE_DELAY_MS,
  MAX_RETRY_DELAY_MS,
  DEFAULT_BACKOFF_MULTIPLIER,
  API_ENDPOINTS
} from "@/config/constants";

/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends AIChatAgent<Env> {
  // Content repository for database operations
  private contentRepository!: ContentRepository;
  // Contact service for handling form submissions with rate limiting
  private contactService!: ContactService;

  /**
   * Called when a WebSocket connection is established
   * Captures the connection ID for session tracking and initializes tables
   */
  async onConnect(connection: any) {
    // Initialize content repository
    this.contentRepository = new ContentRepository(
      this.env.DB,
      this.env.AI,
      this.env.VECTOR_INDEX
    );

    // Initialize contact service
    this.contactService = new ContactService(this.env.DB, this.env);

    // Detect reconnection - log but preserve history state
    if (this.messages.length > 0) {
      console.log(
        `[Connection] Reconnection detected - ${this.messages.length} messages in history`
      );
    }
    // Store connection ID in the WebSocket attachment so it persists through hibernation
    if (connection.id) {
      connection.serializeAttachment({ connectionId: connection.id });
      console.log(`Chat session started with connection ID: ${connection.id}`);
    } else {
      console.warn("Connection established but no connection ID available");
    }

    // Create contact_messages table if it doesn't exist
    try {
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
      console.log("Contact messages table initialized");

      // Create index on timestamp for efficient rate limit queries
      await this.env.DB.prepare(
        `
        CREATE INDEX IF NOT EXISTS idx_contact_messages_timestamp 
        ON contact_messages(timestamp)
      `
      ).run();
      console.log("Contact messages timestamp index initialized");
    } catch (error) {
      console.error("Failed to create contact_messages table:", error);
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
        this.env.VECTOR_INDEX
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
    console.log(
      `[Sliding Window] Initial message count: ${initialMessageCount}, max allowed: ${maxMessages}`
    );

    if (this.messages.length <= maxMessages) {
      console.log(
        `[Sliding Window] No trimming needed (${this.messages.length}/${maxMessages})`
      );
      return; // No need to trim
    }

    console.log(
      `[Sliding Window] Trimming required - analyzing conversation turns...`
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

    console.log(
      `[Sliding Window] Found ${turnStartIndices.length} conversation turns`
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
        console.log(
          `[Sliding Window] Will drop turn ${i + 1} (${turnLength} messages, starting at index ${turnStart})`
        );
      } else {
        break;
      }
    }

    if (messagesToDrop > 0) {
      // Remove oldest messages from UIMessage array
      // UIMessages and ModelMessages have 1:1 correspondence after conversion
      this.messages = this.messages.slice(messagesToDrop);
      console.log(
        `[Sliding Window] ✓ Dropped ${turnsToRemove} oldest turn(s) (${messagesToDrop} messages)`
      );
      console.log(
        `[Sliding Window] ✓ Final message count: ${this.messages.length}/${maxMessages}`
      );
    } else {
      console.log(
        `[Sliding Window] No messages dropped - window already optimized`
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
        console.log(
          `[Retry] Executing ${operationName} (attempt ${attempt}/${maxAttempts})`
        );
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Log the full error for debugging
        console.error(`[Retry] ===== ERROR CAUGHT =====`);
        console.error(
          `[Retry] Error type: ${error?.constructor?.name || typeof error}`
        );
        console.error(`[Retry] Error message: ${lastError.message}`);
        console.error(`[Retry] Full error:`, JSON.stringify(error, null, 2));
        console.error(`[Retry] Stack trace:`, lastError.stack);

        // Check if error is recoverable (context length or rate limit)
        // Handle both Error objects and structured error objects from OpenAI
        let errorMessage = "";
        if (lastError.message) {
          errorMessage = lastError.message.toLowerCase();
        }
        // Check if error has a structured format (e.g., {error: {code: 'rate_limit_exceeded'}})
        const errorObj = error as any;
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
          console.error(`[Retry] Non-recoverable error, throwing immediately`);
          throw lastError;
        }

        const errorType = isContextError ? "context_length" : "rate_limit";
        console.warn(
          `[Retry] ${errorType} error on attempt ${attempt}/${maxAttempts}: ${lastError.message || JSON.stringify(errorObj)}`,
          { delay, remainingAttempts: maxAttempts - attempt }
        );

        if (attempt < maxAttempts) {
          // For context errors, try to drop oldest conversation turn
          if (isContextError && this.messages.length > 0) {
            console.log(
              `[Retry] Trimming messages due to context length error...`
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
              console.log(
                `[Retry] Dropped oldest conversation turn (${beforeCount - this.messages.length} messages), ${this.messages.length} remaining`
              );
            } else if (this.messages.length > 0) {
              // Fallback: just drop the oldest message
              this.messages = this.messages.slice(1);
              console.log(
                `[Retry] Dropped oldest message as fallback, ${this.messages.length} remaining`
              );
            }
          }

          // Wait with exponential backoff
          console.log(`[Retry] Waiting ${delay}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay = Math.min(
            delay * DEFAULT_BACKOFF_MULTIPLIER,
            MAX_RETRY_DELAY_MS
          );
        }
      }
    }

    // All retries exhausted
    console.error(`[Retry] All ${maxAttempts} attempts exhausted`);
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
    // Ensure repositories/services are initialized (in case onConnect wasn't called)
    if (!this.contentRepository) {
      this.contentRepository = new ContentRepository(
        this.env.DB,
        this.env.AI,
        this.env.VECTOR_INDEX
      );
    }
    if (!this.contactService) {
      this.contactService = new ContactService(this.env.DB, this.env);
    }

    // Check for initialization message with history payload and inject history
    if (this.messages.length > 0) {
      const initMessage = this.messages.find((msg: any) =>
        msg.parts?.some((part: any) => part.type === "init-history")
      );

      if (initMessage) {
        const initPart = initMessage.parts.find(
          (part: any) => part.type === "init-history"
        );
        const history = (initPart as any)?.history;

        if (history && Array.isArray(history) && history.length > 0) {
          // Remove all init messages from the array
          const messagesWithoutInit = this.messages.filter(
            (msg: any) =>
              !msg.parts?.some((part: any) => part.type === "init-history")
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
          this.messages.push(...history, ...messagesWithoutInit);
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
    const inputGuardrailMiddleware = createInputGuardrailMiddleware(
      this.contentRepository.queryVectorDatabase.bind(this.contentRepository),
      this.env
    );

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
      middleware: inputGuardrailMiddleware
    });

    // Wrap onFinish callback to track model usage
    const wrappedOnFinish: StreamTextOnFinishCallback<ToolSet> = async (
      event
    ) => {
      // Log which model was actually used by OpenRouter
      const modelUsed = event.response?.modelId || "unknown";
      console.log(`[OpenRouter] Model used: ${modelUsed}`);

      // Log usage if available
      if (event.usage) {
        console.log(`[OpenRouter] Usage:`, event.usage);
      }

      // Call original onFinish callback if provided
      if (onFinish) {
        await onFinish(event);
      }
    };

    // Wrap streamText call with retry logic for context/rate limit errors
    const result = await this.retryWithMessageTrimming(async () => {
      const modelMessages = await convertToModelMessages(this.messages);

      const streamTextConfig: any = {
        system: systemPrompt,
        messages: modelMessages,
        model,
        tools: allTools,
        stopWhen: stepCountIs(5), // Stop after 5 steps (enables multi-step tool calling)
        providerOptions: {
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
      return streamText(streamTextConfig);
    }, "streamText");

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        try {
          const uiStream = result.toUIMessageStream();
          writer.merge(uiStream);
        } catch (error) {
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
        // Create a temporary Durable Object instance to access the database
        // We use a deterministic ID so content can be fetched without a session
        const id = env.Chat.idFromName("__content_fetcher__");
        const chatStub = env.Chat.get(id) as any;

        // Call the method on the Durable Object
        const result =
          await chatStub.fetchContentByShareableLink(shareableLink);

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
        console.error("Error fetching content by shareable link:", error);
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
        const chatStub = env.Chat.get(id) as any;

        // Call saveContactMessage directly on the stub
        // The stub will route this to the actual Durable Object instance
        const result = await chatStub.saveContactMessage(email, name, message);

        if (!result.success) {
          return new Response(JSON.stringify({ error: result.error }), {
            status: result.error?.includes("Rate limit") ? 429 : 500,
            headers: { "Content-Type": "application/json" }
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      } catch (error) {
        console.error("Error handling contact submission:", error);
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

    // Serve static assets from the public directory
    // @ts-expect-error - ASSETS is provided by Cloudflare Workers when assets.directory is configured
    if (env.ASSETS) {
      // @ts-expect-error - ASSETS.fetch is the standard way to serve static files
      return env.ASSETS.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  }
} satisfies ExportedHandler<Env>;
