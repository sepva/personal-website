import { useMemo } from "react";
import type { UIMessage } from "@ai-sdk/react";

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
  data?: any;
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
          const toolPart = part as any;
          if (toolPart.state === "output-available" && toolPart.output) {
            const output = toolPart.output;
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
                component: output.componentName as any,
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
      agentMessages[agentMessages.length - 1]?.parts?.some(
        (part) =>
          part.type?.startsWith("tool-") &&
          (part as any).state !== "output-available"
      );

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
