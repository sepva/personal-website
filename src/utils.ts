// via https://github.com/vercel/ai/blob/main/examples/next-openai/app/api/use-chat-human-in-the-loop/utils.ts

import type {
  UIMessage,
  UIMessageStreamWriter,
  ToolSet,
  ToolCallOptions
} from "ai";
import { convertToModelMessages, isToolUIPart } from "ai";



/**
 * Processes tool invocations automatically, executing tools as soon as input is available.
 */
export async function processToolCalls<Tools extends ToolSet>({
  dataStream,
  messages,
  executions
}: {
  tools: Tools; // used for type inference
  dataStream: UIMessageStreamWriter;
  messages: UIMessage[];
  executions: Record<
    string,
    // biome-ignore lint/suspicious/noExplicitAny: needs a better type
    (args: any, context: ToolCallOptions) => Promise<unknown>
  >;
}): Promise<UIMessage[]> {
  // Process all messages, not just the last one
  const processedMessages = await Promise.all(
    messages.map(async (message) => {
      const parts = message.parts;
      if (!parts) return message;

      const processedParts = await Promise.all(
        parts.map(async (part) => {
          // Only process tool UI parts
          if (!isToolUIPart(part)) return part;

          const toolName = part.type.replace(
            "tool-",
            ""
          ) as keyof typeof executions;

          // Only process tools that are in executions object and are in 'input-available' state
          if (!(toolName in executions)) return part;
          if (part.state !== "input-available") return part;

          const toolInstance = executions[toolName];
          if (!toolInstance) {
            return {
              ...part,
              output: "Error: No execute function found on tool",
              state: "output-available" as const
            };
          }

          const result = await toolInstance(part.input, {
            messages: convertToModelMessages(messages),
            toolCallId: part.toolCallId
          });

          // Forward updated tool result to the client.
          dataStream.write({
            type: "tool-output-available",
            toolCallId: part.toolCallId,
            output: result
          });

          // Return updated tool part with the actual result and correct state
          return {
            ...part,
            output: result,
            state: "output-available" as const
          };
        })
      );

      return { ...message, parts: processedParts };
    })
  );

  return processedMessages;
}

/**
 * Clean up incomplete tool calls from messages before sending to API
 * Prevents API errors from interrupted or failed tool executions
 */
export function cleanupMessages(messages: UIMessage[]): UIMessage[] {
  return messages.filter((message) => {
    if (!message.parts) return true;

    // Filter out messages with incomplete tool calls
    const hasIncompleteToolCall = message.parts.some((part) => {
      if (!isToolUIPart(part)) return false;
      // Remove tool calls that are still streaming or awaiting input without results
      return (
        part.state === "input-streaming" ||
        (part.state === "input-available" && !part.output && !part.errorText)
      );
    });

    return !hasIncompleteToolCall;
  });
}
