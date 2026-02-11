import { useState, useEffect } from "react";
import type { UIMessage } from "@ai-sdk/react";
import { parseShareableLinkFromURL } from "@/lib/shareable-links";

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

interface ShareableLinkData {
  customMessages: CustomMessage[];
  historyMessages: UIMessage[] | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Custom hook for initializing chat from a shareable link.
 * Checks URL for shareable link parameter, fetches content data,
 * and builds initial message history for the chat interface.
 *
 * @returns Object containing custom messages, history messages, loading state, and error state
 */
export function useShareableLink(): ShareableLinkData {
  const [customMessages, setCustomMessages] = useState<CustomMessage[]>([
    {
      id: "1",
      type: "bot",
      content:
        "Hi! I'm the personal AI assistant of Seppe Vanswegenoven. Ask me anything about his academics, professional projects, or personal projects."
    },
    {
      id: "2",
      type: "bot",
      component: "categories",
      data: {}
    }
  ]);

  const [historyMessages, setHistoryMessages] = useState<UIMessage[] | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const initializeShareableLink = async () => {
      const shareableLink = parseShareableLinkFromURL();

      if (!shareableLink) {
        setIsLoading(false);
        return;
      }

      try {
        // Fetch content data from API
        const response = await fetch(
          `/api/content?link=${encodeURIComponent(shareableLink)}`
        );

        if (!response.ok) {
          console.error(
            "Failed to fetch shareable content:",
            response.statusText
          );
          setError(
            new Error(`Failed to fetch content: ${response.statusText}`)
          );
          setIsLoading(false);
          return;
        }

        const result = (await response.json()) as {
          contentItem: any;
          allItems: any[];
          dataType: string;
          componentName: string;
        };
        const { contentItem, allItems, componentName } = result;

        if (!contentItem) {
          console.error("Content not found for shareable link:", shareableLink);
          setError(new Error("Content not found"));
          setIsLoading(false);
          return;
        }

        // Build preprogrammed messages for UI
        const preprogrammedMessages: CustomMessage[] = [
          // Intro message
          {
            id: "1",
            type: "bot",
            content:
              "Hi! I'm the personal AI assistant of Seppe Vanswegenoven. Ask me anything about his academics, professional projects, or personal projects."
          },
          // Category tiles
          {
            id: "2",
            type: "bot",
            component: "categories",
            data: {}
          },
          // User message requesting the content
          {
            id: "3",
            type: "user",
            content: `Show me ${contentItem.title}`
          },
          // Bot message with overview page component
          {
            id: "4",
            type: "bot",
            component: componentName as any,
            data: {
              data: allItems,
              initialEnlargedItemId: contentItem.id
            }
          }
        ];

        // Build synthetic UIMessage history for server initialization
        // This gives the AI context about what the user is viewing
        const typeContext =
          contentItem.type === "academic"
            ? "from Seppe's academic work"
            : contentItem.type === "work"
              ? "from his professional experience"
              : "one of his personal projects";

        // Generate unique IDs to avoid React key conflicts
        const timestamp = Date.now();

        const historyMessagesArray: UIMessage[] = [
          // User message
          {
            id: `shareable-init-user-${timestamp}`,
            role: "user",
            parts: [{ type: "text", text: `Show me ${contentItem.title}` }]
          } as UIMessage,
          // Assistant message with context about the content
          {
            id: `shareable-init-assistant-${timestamp}`,
            role: "assistant",
            parts: [
              {
                type: "text",
                text: `I'm showing you **${contentItem.title}**${contentItem.description ? ": " + contentItem.description : ""}. This is ${typeContext}. What would you like to know about it?`
              }
            ]
          } as UIMessage
        ];

        setCustomMessages(preprogrammedMessages);
        setHistoryMessages(historyMessagesArray);
        setIsLoading(false);
      } catch (err) {
        console.error("Error initializing shareable link:", err);
        setError(
          err instanceof Error ? err : new Error("Unknown error occurred")
        );
        setIsLoading(false);
      }
    };

    initializeShareableLink();
  }, []);

  return {
    customMessages,
    historyMessages,
    isLoading,
    error
  };
}
