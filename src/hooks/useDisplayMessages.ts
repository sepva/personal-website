import { useMemo } from "react";
import type { UIMessage } from "@ai-sdk/react";
import type { ContentItem } from "@/shared";

interface CustomMessage {
  id: string;
  type: "bot" | "user" | "system";
  content?: string;
  component?:
    | "categories"
    | "suggestions"
    | "AcademicOverviewPage"
    | "PersonalProjectsOverviewPage"
    | "ProfessionalProjectsOverviewPage"
    | "ContactForm";
  data?: {
    data?: ContentItem[];
    initialEnlargedItemId?: string;
    suggestions?: string[];
  };
}

interface UseDisplayMessagesOptions {
  customMessages: CustomMessage[];
  agentMessages: UIMessage[];
  status: "submitted" | "streaming" | "ready" | "error";
  shareableLinkLoading: boolean;
}

/**
 * Custom hook for computing the final display messages array.
 * Combines custom UI messages with agent messages, processes tool results,
 * and adds loading indicators when appropriate.
 *
 * @param options - Configuration object containing messages and status
 * @returns Array of messages to display in the chat interface
 */
export function useDisplayMessages({
  customMessages,
  agentMessages,
  status,
  shareableLinkLoading
}: UseDisplayMessagesOptions): CustomMessage[] {
  return useMemo(() => {
    // Start with custom UI messages
    const displayMessages: CustomMessage[] = [...customMessages];

    // Add agent messages after the initial custom messages
    agentMessages.forEach((m) => {
      const isUser = m.role === "user";

      // Add text parts
      m.parts?.forEach((part, partIndex) => {
        if (part.type === "text") {
          displayMessages.push({
            id: `${m.id}-${part.type}-${partIndex}`,
            type: isUser ? "user" : "bot",
            content: part.text
          });
        }

        // Handle tool results that contain React components
        if (part.type && part.type.startsWith("tool-")) {
          // Type guard to check if part has tool invocation properties
          const toolPart = part as {
            type: string;
            state?: string;
            result?: unknown;
            output?: unknown;
          };
          const result = toolPart.result || toolPart.output;
          if (toolPart.state === "output-available" && result) {
            const output = result as {
              type?: string;
              componentName?: string;
              message?: string;
              data?: Record<string, unknown>;
            };
            // Check if the output indicates a React component should be rendered
            if (output.type === "react-component" && output.componentName) {
              // Add a text message first if present
              if (output.message) {
                displayMessages.push({
                  id: `${m.id}-${part.type}-${partIndex}-message`,
                  type: "bot",
                  content: output.message
                });
              }
              // Add the component message
              displayMessages.push({
                id: `${m.id}-${part.type}-${partIndex}-component`,
                type: "bot",
                component: output.componentName as CustomMessage["component"],
                data: output.data || {}
              });
            }
          }
        }
      });
    });

    // Add loading indicator when agent is processing (only before streaming starts)
    const isLoading =
      shareableLinkLoading || status === "submitted" || status === "streaming";

    // Check if there's any text content or tool outputs in the latest agent messages
    const hasContent =
      agentMessages.length > 0 &&
      agentMessages[agentMessages.length - 1]?.parts?.some(
        (part) => part.type === "text" && part.text
      );

    // Check if there are any active tool-calls still in progress
    const hasActiveToolCalls =
      agentMessages.length > 0 &&
      agentMessages[agentMessages.length - 1]?.parts?.some((part) => {
        // Type guard for tool parts
        const toolPart = part as { type?: string; state?: string };
        return (
          toolPart.type?.startsWith("tool-") &&
          toolPart.state !== "output-available"
        );
      });

    if (
      isLoading &&
      (!hasContent || hasActiveToolCalls) &&
      displayMessages[displayMessages.length - 1]?.id !== "loading-indicator"
    ) {
      displayMessages.push({
        id: "loading-indicator",
        type: "bot",
        content: "" // Will be rendered as Loader component
      });
    }

    return displayMessages;
  }, [customMessages, agentMessages, status, shareableLinkLoading]);
}
