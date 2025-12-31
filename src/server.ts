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
import { tools } from "./tools";
import systemPrompt from "./instructions/system_prompt_agent.md?raw";
// import { env } from "cloudflare:workers";

const { generateText, streamText, generateObject, streamObject } = wrapAISDK(ai);
const model = openai("gpt-4o-2024-11-20");
// Cloudflare AI Gateway
// const openai = createOpenAI({
//   apiKey: env.OPENAI_API_KEY,
//   baseURL: env.GATEWAY_BASE_URL,
// });

/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends AIChatAgent<Env> {

  private connectionId?: string;

  /**
   * Called when a WebSocket connection is established
   * Captures the connection ID for session tracking
   */
  async onConnect(connection: any) {
    this.connectionId = connection.id;
    console.log(`Chat session started with connection ID: ${this.connectionId}`);
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
      ...tools,
      ...this.mcp.getAITools()
    };

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
                session_id: this.connectionId || "unknown",
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
