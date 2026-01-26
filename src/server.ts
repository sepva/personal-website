import { routeAgentRequest } from "agents";
import { AIChatAgent } from "agents/ai-chat-agent";
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
import { wrapAISDK, createLangSmithProviderOptions } from "langsmith/experimental/vercel"
import { z } from "zod";
import { tools } from "./tools";
import type { ContentItem } from "./shared";
import systemPrompt from "./instructions/system_prompt_agent.md?raw";

const { streamText } = wrapAISDK(ai);
const model = openai("gpt-4o-2024-11-20");

/**
 * Zod schema for validating and parsing ContentItem from database rows
 */
const ContentItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  type: z.enum(['project', 'blog', 'academic', 'work']),
  tags: z.string().transform(val => {
    try {
      return typeof val === 'string' ? JSON.parse(val) : val;
    } catch {
      return [];
    }
  }).pipe(z.array(z.string())).optional(),
  date: z.string().optional(),
  fullContent: z.string().optional(),
  link_to_article: z.string().optional(),
});

/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends AIChatAgent<Env> {
  // In-memory cache for database results during the session
  private contentCache: Map<string, ContentItem[]> = new Map();

  /**
   * Fetch content pages from SQLite database with caching
   */
  async fetchContentPageFromDB(dataType: string, id?: string): Promise<ContentItem[]> {
    const cacheKey = `${dataType}${id ? ':' + id : ''}`;
    
    // Check cache first
    if (this.contentCache.has(cacheKey)) {
      console.log(`Cache hit for ${cacheKey}`);
      return this.contentCache.get(cacheKey)!;
    }
    
    // Cache miss - fetch from database
    console.log(`Cache miss for ${cacheKey}, fetching from DB`);
    
    try {
      let query = `SELECT * FROM ${dataType}`;
      const params: string[] = [];
      
      if (id) {
        query += ' WHERE id = ?';
        params.push(id);
      }
      
      const stmt = this.env.DB.prepare(query);
      const { results } = params.length > 0 
        ? await stmt.bind(...params).all()
        : await stmt.all();
      
      // Parse and validate JSON fields using Zod
      const parsedResults = results?.map((row: any): ContentItem => {
        try {
          return ContentItemSchema.parse(row);
        } catch (error) {
          console.error(`Failed to parse content item ${row.id}:`, error);
          // Return a minimal valid item as fallback
          return {
            id: row.id || 'unknown',
            title: row.title || 'Untitled',
            description: row.description || '',
            type: row.type || 'blog',
          };
        }
      }) || [];
      
      // Store in cache
      this.contentCache.set(cacheKey, parsedResults);
      
      return parsedResults;
    } catch (error) {
      console.error(`Failed to fetch ${dataType} from database:`, error);
      return [];
    }
  }

  /**
   * Called when a WebSocket connection is established
   * Captures the connection ID for session tracking
   */
  async onConnect(connection: any) {
    // Store connection ID in the WebSocket attachment so it persists through hibernation
    if (connection.id) {
      connection.serializeAttachment({ connectionId: connection.id });
      console.log(`Chat session started with connection ID: ${connection.id}`);
    } else {
      console.warn('Connection established but no connection ID available');
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
   * Handles incoming chat messages and manages the response stream
   */
  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    _options?: { abortSignal?: AbortSignal }
  ) {
    // const mcpConnection = await this.mcp.connect(
    //   "https://path-to-mcp-server/sse"
    // );

    // Collect all tools, including MCP tools
    const allTools = {
      ...tools(this.fetchContentPageFromDB.bind(this)),
      ...this.mcp.getAITools()
    };

    // Get the current connection ID - this will work even after hibernation
    const sessionId = this.getConnectionId();
    console.log(`Processing chat message with session ID: ${sessionId}`);

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const result = streamText({
          system: systemPrompt,
          messages: convertToModelMessages(this.messages),
          model,
          tools: allTools,
          providerOptions: {
            langsmith: createLangSmithProviderOptions({
              metadata: {
                session_id: sessionId,
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
