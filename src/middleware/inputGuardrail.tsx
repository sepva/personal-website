import type { LanguageModelV3Middleware } from "@ai-sdk/provider";
import { streamText, stepCountIs } from "ai";
import { tool } from "ai";
import { z } from "zod/v3";
import validationPrompt from "../instructions/input_validation_prompt.md?raw";
import { createOpenRouterProvider } from "../lib/openrouter";
import { createLogger } from "../utils/logger";

interface ValidationResult {
  allowed: boolean;
  reason: string;
}

/**
 * Type definition for the vector search function
 */
type VectorSearch = (query: string, topK?: number) => Promise<any[]>;

/**
 * Factory function to create input guardrail middleware with vector search capability
 */
export function createInputGuardrailMiddleware(
  vectorSearch: VectorSearch,
  env: Cloudflare.Env
): LanguageModelV3Middleware {
  const logger = createLogger('validation', env);
  // Create vector search tool for validation agent
  const vectorSearchTool = tool({
    description: `Performs semantic vector search across documents about Seppe Vanswegenoven.
    Use this to verify if a user's question is answerable based on available content.
    If relevant results are found (especially with score > 0.5), the question is likely valid.`,
    inputSchema: z.object({
      query: z.string().describe("The search query to find relevant content"),
      topK: z
        .number()
        .optional()
        .default(3)
        .describe("Number of results to return (default: 3)")
    }),
    execute: async ({ query, topK }) => {
      const results = await vectorSearch(query, topK);
      return {
        type: "vector-search-results",
        results: results.map((item: any) => ({
          title: item.title,
          description: item.description,
          type: item.type,
          relevanceNote:
            "Score > 0.5 suggests question is answerable and in scope"
        }))
      };
    }
  });

  // Create validation result tool to enforce structured output
  const reportValidationTool = tool({
    description: `Report the final validation decision. You MUST call this tool with your decision.`,
    inputSchema: z.object({
      allowed: z
        .boolean()
        .describe(
          "Whether the user's question should be allowed (true) or rejected (false)"
        ),
      reason: z
        .string()
        .describe(
          "Detailed explanation of why the question was allowed or rejected"
        )
    }),
    execute: async ({ allowed, reason }) => {
      return { allowed, reason };
    }
  });

  return {
    specificationVersion: "v3",

    wrapGenerate: async ({ doGenerate }) => {
      const result = await doGenerate();

      return result;
    },

    wrapStream: async ({ doStream, params }) => {
      const prompt = params.prompt;

      // Filter out system messages and get last 3 user/assistant messages
      const conversationMessages = prompt
        .filter((msg: any) => msg.role === "user" || msg.role === "assistant")
        .slice(-3);

      // Only validate if there are user messages
      if (conversationMessages.length > 0) {
        try {
          // Create OpenRouter provider for guardrail validation
          const { provider: openrouter, primaryModel } =
            createOpenRouterProvider(env, env.OPENROUTER_GUARDRAIL_MODELS);

          // Use streamText (not generateText) to force /chat/completions endpoint
          // generateText uses /responses which has incompatible tool schema
          const validationStream = streamText({
            model: openrouter(primaryModel),
            messages: [
              { role: "system", content: validationPrompt },
              ...conversationMessages.map((msg: any) => ({
                role: msg.role,
                content:
                  typeof msg.content === "string"
                    ? msg.content
                    : JSON.stringify(msg.content)
              }))
            ],
            tools: {
              vectorSearch: vectorSearchTool,
              reportValidation: reportValidationTool
            },
            toolChoice: "auto", // Use 'auto' for compatibility with free models
            stopWhen: stepCountIs(5), // Allow up to 5 steps for validation with tools
            temperature: 0.1
          });

          let validation: ValidationResult | null = null;
          const toolCalls: any[] = [];

          // Consume the stream and collect tool calls
          for await (const chunk of validationStream.fullStream) {
            if (chunk.type === "tool-call") {
              toolCalls.push(chunk);
            }

            // Extract validation from reportValidation tool result
            if (
              chunk.type === "tool-result" &&
              chunk.toolName === "reportValidation"
            ) {
              // The execute function returns the validation object directly
              const result = (chunk as any).result as {
                allowed: boolean;
                reason: string;
              };
              if (result && typeof result.allowed === "boolean") {
                validation = {
                  allowed: result.allowed,
                  reason: result.reason
                };
              } else {
                logger.warn(
                  'validation_tool_missing_fields',
                  'reportValidation tool result missing expected fields',
                  { result },
                  'validation'
                );
              }
            }
          }

          // If no validation was reported via tool, fail open
          if (!validation) {
            validation = {
              allowed: true,
              reason: "No validation result provided"
            };
          }

          // If not allowed, log and return predefined response stream
          if (!validation.allowed) {
            const lastUserMessage = conversationMessages
              .filter((msg: any) => msg.role === "user")
              .slice(-1)[0];

            logger.warn(
              'content_blocked',
              'Input guardrail rejected message',
              {
                reason: validation.reason,
                inputSnippet: lastUserMessage?.content?.slice(0, 100)
              },
              'validation'
            );

            // Create predefined error message
            const errorMessage = `I appreciate your interest, but this question is outside the scope of what I can help with. I'm here to discuss Seppe's background, projects, and professional experience.${validation.reason && validation.reason !== "No reason provided" ? ` ${validation.reason}` : ""}`;

            // Create a synthetic stream using the same mechanism as successful responses
            const textBlockId = "error-block-0";
            const errorStream = new ReadableStream({
              start(controller) {
                // Send text-start
                controller.enqueue({ type: "text-start", id: textBlockId });

                // Send text-delta
                controller.enqueue({
                  type: "text-delta",
                  id: textBlockId,
                  delta: errorMessage
                });

                // Send text-end
                controller.enqueue({ type: "text-end", id: textBlockId });

                // Send finish
                controller.enqueue({ type: "finish", finishReason: "stop" });

                controller.close();
              }
            });

            // Apply the same transform logic as successful responses
            let generatedText = "";
            const textBlocks = new Map<string, string>();

            const transformStream = new TransformStream({
              transform(chunk: any, controller: any) {
                switch (chunk.type) {
                  case "text-start": {
                    textBlocks.set(chunk.id, "");
                    break;
                  }
                  case "text-delta": {
                    const existing = textBlocks.get(chunk.id) || "";
                    textBlocks.set(chunk.id, existing + chunk.delta);
                    generatedText += chunk.delta;
                    break;
                  }
                  case "text-end": {
                    console.log(
                      `Text block ${chunk.id} completed:`,
                      textBlocks.get(chunk.id)
                    );
                    break;
                  }
                }

                controller.enqueue(chunk);
              },

              flush() {
                console.log("Error stream finished");
                console.log(`generated text: ${generatedText}`);
              }
            });

            return {
              stream: errorStream.pipeThrough(transformStream),
              rawCall: { rawPrompt: null, rawSettings: {} },
              rawResponse: { headers: {} },
              warnings: [],
              request: { body: "" }
            };
          }

          logger.info(
            'content_approved',
            'Input guardrail: message validated successfully',
            {},
            'validation'
          );
        } catch (error) {
          // For validation errors (network, API issues), log and fail open
          logger.error(
            'validation_llm_failed',
            'Input guardrail validation error - falling back to allow',
            error,
            {},
            'validation'
          );
          // Allow the request to proceed with original prompt
        }
      }

      // Only call doStream if we haven't already returned (validation passed or no messages)
      const { stream, ...rest } = await doStream();
      return {
        stream: stream,
        ...rest
      };
    }
  };
}
