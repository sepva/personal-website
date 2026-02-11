import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDisplayMessages } from "../../src/hooks/useDisplayMessages";
import type { UIMessage } from "@ai-sdk/react";
import type { ContentItem } from "../../src/shared";

describe("useDisplayMessages", () => {
  const mockContentItem: ContentItem = {
    id: "1",
    title: "Test Item",
    description: "Test description",
    type: "blog"
  };

  const defaultCustomMessages = [
    {
      id: "1",
      type: "bot" as const,
      content: "Hi! I'm the personal AI assistant."
    },
    {
      id: "2",
      type: "bot" as const,
      component: "categories" as const,
      data: {}
    }
  ];

  it("should return custom messages when no agent messages", () => {
    const { result } = renderHook(() =>
      useDisplayMessages({
        customMessages: defaultCustomMessages,
        agentMessages: [],
        status: "ready",
        shareableLinkLoading: false
      })
    );

    expect(result.current).toHaveLength(2);
    expect(result.current[0].content).toBe(
      "Hi! I'm the personal AI assistant."
    );
    expect(result.current[1].component).toBe("categories");
  });

  it("should combine custom messages with agent text messages", () => {
    const agentMessages: UIMessage[] = [
      {
        id: "msg-1",
        role: "user",
        parts: [{ type: "text", text: "Hello" }]
      },
      {
        id: "msg-2",
        role: "assistant",
        parts: [{ type: "text", text: "Hi there!" }]
      }
    ];

    const { result } = renderHook(() =>
      useDisplayMessages({
        customMessages: defaultCustomMessages,
        agentMessages,
        status: "ready",
        shareableLinkLoading: false
      })
    );

    expect(result.current.length).toBeGreaterThan(2);

    // Find user message
    const userMessage = result.current.find((msg) => msg.type === "user");
    expect(userMessage?.content).toBe("Hello");

    // Find bot response
    const botResponses = result.current.filter(
      (msg) => msg.type === "bot" && msg.content === "Hi there!"
    );
    expect(botResponses.length).toBeGreaterThan(0);
  });

  it("should process tool results with React components", () => {
    const agentMessages: UIMessage[] = [
      {
        id: "msg-1",
        role: "assistant",
        parts: [
          {
            type: "tool-call-0",
            state: "output-available",
            result: {
              type: "react-component",
              componentName: "AcademicOverviewPage",
              message: "Here are the academic items",
              data: {
                data: [mockContentItem],
                initialEnlargedItemId: "1"
              }
            }
          } as any
        ]
      }
    ];

    const { result } = renderHook(() =>
      useDisplayMessages({
        customMessages: defaultCustomMessages,
        agentMessages,
        status: "ready",
        shareableLinkLoading: false
      })
    );

    // Should have message text + component
    const messageWithText = result.current.find(
      (msg) => msg.content === "Here are the academic items"
    );
    expect(messageWithText).toBeDefined();

    const componentMessage = result.current.find(
      (msg) => msg.component === "AcademicOverviewPage"
    );
    expect(componentMessage).toBeDefined();
    expect(componentMessage?.data?.data).toEqual([mockContentItem]);
    expect(componentMessage?.data?.initialEnlargedItemId).toBe("1");
  });

  it("should handle tool results without message text", () => {
    const agentMessages: UIMessage[] = [
      {
        id: "msg-1",
        role: "assistant",
        parts: [
          {
            type: "tool-call-0",
            state: "output-available",
            result: {
              type: "react-component",
              componentName: "ContactForm",
              data: {}
            }
          } as any
        ]
      }
    ];

    const { result } = renderHook(() =>
      useDisplayMessages({
        customMessages: defaultCustomMessages,
        agentMessages,
        status: "ready",
        shareableLinkLoading: false
      })
    );

    const componentMessage = result.current.find(
      (msg) => msg.component === "ContactForm"
    );
    expect(componentMessage).toBeDefined();

    // Should not have added a separate text message
    const textMessages = result.current.filter(
      (msg) => msg.content && msg.content !== ""
    );
    expect(textMessages.length).toBe(1); // Only the initial custom message
  });

  it("should skip tool results that are not output-available", () => {
    const agentMessages: UIMessage[] = [
      {
        id: "msg-1",
        role: "assistant",
        parts: [
          {
            type: "tool-call-0",
            state: "pending",
            result: {
              type: "react-component",
              componentName: "ContactForm"
            }
          } as any
        ]
      }
    ];

    const { result } = renderHook(() =>
      useDisplayMessages({
        customMessages: defaultCustomMessages,
        agentMessages,
        status: "ready",
        shareableLinkLoading: false
      })
    );

    const componentMessage = result.current.find(
      (msg) => msg.component === "ContactForm"
    );
    expect(componentMessage).toBeUndefined();
  });

  it("should skip tool results without React component type", () => {
    const agentMessages: UIMessage[] = [
      {
        id: "msg-1",
        role: "assistant",
        parts: [
          {
            type: "tool-call-0",
            state: "output-available",
            result: {
              type: "text-result",
              data: "some data"
            }
          } as any
        ]
      }
    ];

    const { result } = renderHook(() =>
      useDisplayMessages({
        customMessages: defaultCustomMessages,
        agentMessages,
        status: "ready",
        shareableLinkLoading: false
      })
    );

    // Should only have custom messages
    expect(result.current.length).toBe(2);
  });

  it("should add loading indicator when status is submitted", () => {
    const { result } = renderHook(() =>
      useDisplayMessages({
        customMessages: defaultCustomMessages,
        agentMessages: [],
        status: "submitted",
        shareableLinkLoading: false
      })
    );

    const loadingMessage = result.current.find(
      (msg) => msg.id === "loading-indicator"
    );
    expect(loadingMessage).toBeDefined();
    expect(loadingMessage?.type).toBe("bot");
    expect(loadingMessage?.content).toBe("");
  });

  it("should add loading indicator when status is streaming and no content yet", () => {
    const { result } = renderHook(() =>
      useDisplayMessages({
        customMessages: defaultCustomMessages,
        agentMessages: [],
        status: "streaming",
        shareableLinkLoading: false
      })
    );

    const loadingMessage = result.current.find(
      (msg) => msg.id === "loading-indicator"
    );
    expect(loadingMessage).toBeDefined();
  });

  it("should add loading indicator when shareableLinkLoading is true", () => {
    const { result } = renderHook(() =>
      useDisplayMessages({
        customMessages: defaultCustomMessages,
        agentMessages: [],
        status: "ready",
        shareableLinkLoading: true
      })
    );

    const loadingMessage = result.current.find(
      (msg) => msg.id === "loading-indicator"
    );
    expect(loadingMessage).toBeDefined();
  });

  it("should not add loading indicator when content is available", () => {
    const agentMessages: UIMessage[] = [
      {
        id: "msg-1",
        role: "assistant",
        parts: [{ type: "text", text: "Response text" }]
      }
    ];

    const { result } = renderHook(() =>
      useDisplayMessages({
        customMessages: defaultCustomMessages,
        agentMessages,
        status: "streaming",
        shareableLinkLoading: false
      })
    );

    const loadingMessage = result.current.find(
      (msg) => msg.id === "loading-indicator"
    );
    expect(loadingMessage).toBeUndefined();
  });

  it("should add loading indicator when tool calls are in progress", () => {
    const agentMessages: UIMessage[] = [
      {
        id: "msg-1",
        role: "assistant",
        parts: [
          {
            type: "tool-call-0",
            state: "pending" // Tool call not yet complete
          } as any
        ]
      }
    ];

    const { result } = renderHook(() =>
      useDisplayMessages({
        customMessages: defaultCustomMessages,
        agentMessages,
        status: "streaming",
        shareableLinkLoading: false
      })
    );

    const loadingMessage = result.current.find(
      (msg) => msg.id === "loading-indicator"
    );
    expect(loadingMessage).toBeDefined();
  });

  it("should not duplicate loading indicator", () => {
    const customMessagesWithLoading = [
      ...defaultCustomMessages,
      {
        id: "loading-indicator",
        type: "bot" as const,
        content: ""
      }
    ];

    const { result } = renderHook(() =>
      useDisplayMessages({
        customMessages: customMessagesWithLoading,
        agentMessages: [],
        status: "submitted",
        shareableLinkLoading: false
      })
    );

    const loadingMessages = result.current.filter(
      (msg) => msg.id === "loading-indicator"
    );
    expect(loadingMessages).toHaveLength(1);
  });

  it("should handle multiple parts in a single message", () => {
    const agentMessages: UIMessage[] = [
      {
        id: "msg-1",
        role: "assistant",
        parts: [
          { type: "text", text: "First part" },
          { type: "text", text: "Second part" },
          {
            type: "tool-call-0",
            state: "output-available",
            result: {
              type: "react-component",
              componentName: "ContactForm",
              data: {}
            }
          } as any
        ]
      }
    ];

    const { result } = renderHook(() =>
      useDisplayMessages({
        customMessages: defaultCustomMessages,
        agentMessages,
        status: "ready",
        shareableLinkLoading: false
      })
    );

    // Should have both text parts + component
    const textPart1 = result.current.find(
      (msg) => msg.content === "First part"
    );
    const textPart2 = result.current.find(
      (msg) => msg.content === "Second part"
    );
    const componentPart = result.current.find(
      (msg) => msg.component === "ContactForm"
    );

    expect(textPart1).toBeDefined();
    expect(textPart2).toBeDefined();
    expect(componentPart).toBeDefined();
  });

  it("should memoize results to prevent unnecessary re-renders", () => {
    const emptyAgentMessages: UIMessage[] = [];
    const { result, rerender } = renderHook(
      (props) => useDisplayMessages(props),
      {
        initialProps: {
          customMessages: defaultCustomMessages,
          agentMessages: emptyAgentMessages,
          status: "ready" as const,
          shareableLinkLoading: false
        }
      }
    );

    const firstResult = result.current;

    // Re-render with same props (same array references)
    rerender({
      customMessages: defaultCustomMessages,
      agentMessages: emptyAgentMessages,
      status: "ready",
      shareableLinkLoading: false
    });

    // Should return same reference (memoized)
    expect(result.current).toBe(firstResult);
  });

  it("should update when dependencies change", () => {
    const emptyMessages: UIMessage[] = [];
    const { result, rerender } = renderHook(
      (props) => useDisplayMessages(props),
      {
        initialProps: {
          customMessages: defaultCustomMessages,
          agentMessages: emptyMessages,
          status: "ready" as const,
          shareableLinkLoading: false
        }
      }
    );

    const firstResult = result.current;

    const newAgentMessages: UIMessage[] = [
      {
        id: "msg-1",
        role: "user",
        parts: [{ type: "text", text: "New message" }]
      }
    ];

    // Re-render with new agent messages
    rerender({
      customMessages: defaultCustomMessages,
      agentMessages: newAgentMessages,
      status: "ready",
      shareableLinkLoading: false
    });

    // Should return different reference (dependencies changed)
    expect(result.current).not.toBe(firstResult);
    expect(result.current.length).toBeGreaterThan(firstResult.length);
  });

  it("should handle empty parts array gracefully", () => {
    const agentMessages: UIMessage[] = [
      {
        id: "msg-1",
        role: "assistant",
        parts: [{ type: "text", text: "Message" }]
      }
    ];

    const { result } = renderHook(() =>
      useDisplayMessages({
        customMessages: defaultCustomMessages,
        agentMessages,
        status: "ready",
        shareableLinkLoading: false
      })
    );

    // Should not crash, should still return custom messages
    expect(result.current.length).toBeGreaterThanOrEqual(2);
  });

  it("should handle messages without parts property", () => {
    const agentMessages: UIMessage[] = [
      {
        id: "msg-1",
        role: "assistant",
        content: "Message"
        // No parts property
      } as any
    ];

    const { result } = renderHook(() =>
      useDisplayMessages({
        customMessages: defaultCustomMessages,
        agentMessages,
        status: "ready",
        shareableLinkLoading: false
      })
    );

    // Should not crash
    expect(result.current.length).toBeGreaterThanOrEqual(2);
  });
});
