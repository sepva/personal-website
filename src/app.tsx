/** biome-ignore-all lint/correctness/useUniqueElementIds: it's alright */
import { useEffect, useState, useRef } from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "agents/ai-react";
import type { UIMessage } from "@ai-sdk/react";

// Figma component imports
import { ChatBubble } from "@/components/chat-bubble/ChatBubble";
import {
  CategoryTiles,
  categories
} from "@/components/category-tiles/CategoryTiles";
import { SuggestionChips } from "@/components/suggestion-chips/SuggestionChips";
import { Header } from "@/components/header/Header";
import { ChatInput } from "@/components/chat-input/ChatInput";
import { MemoizedMarkdown } from "@/components/memoized-markdown";
import { AcademicOverviewPage } from "@/components/overview-page/AcademicOverviewPage";
import { PersonalProjectsOverviewPage } from "./components/overview-page/PersonalProjectsOverviewPage";
import { ProfessionalProjectsOverviewPage } from "./components/overview-page/ProfessionalProjectsOverviewPage";
import { COMPONENT_NAMES } from "@/constants";
import { ContactForm } from "./components/contact-form/ContactForm";
import { Loader } from "./components/loader/Loader";
import { RotateCcw } from "lucide-react";

// Custom hooks
import { useSessionManagement } from "@/hooks/useSessionManagement";
import { useShareableLink } from "@/hooks/useShareableLink";
import { useDisplayMessages } from "@/hooks/useDisplayMessages";

export default function Chat() {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use custom hooks for session management and shareable links
  const { sessionId } = useSessionManagement();
  const {
    customMessages,
    historyMessages: shareableHistoryMessages,
    isLoading: shareableLinkLoading
  } = useShareableLink();

  const [isInitializing, setIsInitializing] = useState(false);
  const [shareableHistoryMessagesState, setShareableHistoryMessagesState] =
    useState<UIMessage[] | null>(null);

  // Sync shareable history messages from hook to local state
  useEffect(() => {
    if (shareableHistoryMessages && !shareableHistoryMessagesState) {
      setShareableHistoryMessagesState(shareableHistoryMessages);
    }
  }, [shareableHistoryMessages, shareableHistoryMessagesState]);

  // Function to scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Scroll to bottom when custom messages change
  useEffect(() => {
    scrollToBottom();
  }, [customMessages]);

  // Connect to the agent with a unique session name
  // This ensures each client gets their own Durable Object instance
  const agent = useAgent({
    agent: "chat",
    name: sessionId
  });

  // Hook to manage chat with the agent
  const {
    messages: agentMessages,
    clearHistory,
    status,
    sendMessage
  } = useAgentChat<unknown, UIMessage<{ createdAt: string }>>({
    agent
  });

  // Scroll to bottom when agent messages change
  useEffect(() => {
    if (agentMessages.length > 0) {
      scrollToBottom();
    }
  }, [agentMessages]);

  // Send initialization message when shareable history is ready
  useEffect(() => {
    const initializeHistory = async () => {
      // Only initialize if we have history messages, agent is ready, and not already initialized
      if (
        !shareableHistoryMessagesState ||
        isInitializing ||
        agentMessages.length > 0
      ) {
        return;
      }

      try {
        setIsInitializing(true);

        // Send special init-history message
        await sendMessage({
          role: "user" as const,
          parts: [
            {
              type: "init-history" as any,
              history: shareableHistoryMessagesState
            } as any
          ]
        });

        // Clear the history messages to prevent re-sending
        setShareableHistoryMessagesState(null);
      } catch (error) {
        console.error(
          "[History Init] Failed to send initialization message:",
          error
        );
      } finally {
        setIsInitializing(false);
      }
    };

    initializeHistory();
  }, [
    shareableHistoryMessagesState,
    sendMessage,
    isInitializing,
    agentMessages.length
  ]);

  // Handler to send a message to the bot on choosing a category
  const handleCategorySelect = async (category: string) => {
    const message =
      categories.find((cat) => cat.id === category)?.prompt ||
      "Help me with this";

    // Send to backend agent
    await sendMessage({
      role: "user",
      parts: [{ type: "text", text: message }]
    });
  };

  // Handler for user message input
  const handleUserMessage = async (message: string) => {
    if (!message.trim()) return;

    // Send directly to the agent
    await sendMessage({
      role: "user",
      parts: [{ type: "text", text: message }]
    });
  };

  // Handler to refresh the chat
  const handleRefresh = () => {
    clearHistory();
    sessionStorage.removeItem("chat-session-id");
    // Clear shareable link from URL
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    // Reset states
    setShareableHistoryMessagesState(null);
    setIsInitializing(false);
    window.location.reload();
  };

  // Use custom hook for display messages
  const displayMessages = useDisplayMessages({
    customMessages,
    agentMessages,
    status,
    shareableLinkLoading
  });

  return (
    <div className="flex flex-col h-screen bg-[#0F1115]">
      <Header
        name="Seppe Vanswegenoven"
        photoUrl="/CV_picture.jpeg"
        contactInfo={{
          email: "seppe.vanswegenoven@skynet.be",
          phone: "(+32) 04 77 25 90 19",
          github: "sepva",
          linkedin: "seppe-vanswegenoven-119151268"
        }}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto px-[16px] md:px-[24px] py-[24px] md:py-[32px]">
          <div className="max-w-[900px] mx-auto space-y-[16px]">
            {displayMessages.map((message) => {
              if (message.component === "categories") {
                return (
                  <div key={message.id} className="max-w-[85%]">
                    <CategoryTiles onSelect={handleCategorySelect} />
                  </div>
                );
              }

              if (message.component === "suggestions") {
                return (
                  <div key={message.id} className="max-w-[85%]">
                    <SuggestionChips
                      suggestions={message.data?.suggestions}
                      onSelect={handleUserMessage}
                    />
                  </div>
                );
              }

              if (message.component === COMPONENT_NAMES.ACADEMIC_OVERVIEW) {
                return (
                  <ChatBubble key={message.id} type={message.type}>
                    <AcademicOverviewPage
                      data={message.data?.data || message.data || []}
                      initialEnlargedItemId={
                        message.data?.initialEnlargedItemId
                      }
                    />
                  </ChatBubble>
                );
              }

              if (
                message.component === COMPONENT_NAMES.PERSONAL_PROJECTS_OVERVIEW
              ) {
                return (
                  <ChatBubble key={message.id} type={message.type}>
                    <PersonalProjectsOverviewPage
                      data={message.data?.data || message.data || []}
                      initialEnlargedItemId={
                        message.data?.initialEnlargedItemId
                      }
                    />
                  </ChatBubble>
                );
              }

              if (
                message.component ===
                COMPONENT_NAMES.PROFESSIONAL_PROJECTS_OVERVIEW
              ) {
                return (
                  <ChatBubble key={message.id} type={message.type}>
                    <ProfessionalProjectsOverviewPage
                      data={message.data?.data || message.data || []}
                      initialEnlargedItemId={
                        message.data?.initialEnlargedItemId
                      }
                    />
                  </ChatBubble>
                );
              }

              if (message.component === COMPONENT_NAMES.CONTACT_FORM) {
                return (
                  <ChatBubble key={message.id} type={message.type}>
                    <ContactForm data={message.data} />
                  </ChatBubble>
                );
              }

              // Show loading indicator for the loading message
              if (message.id === "loading-indicator") {
                return (
                  <ChatBubble key={message.id} type={message.type}>
                    <div className="flex items-center gap-2">
                      <Loader size={20} title="AI is thinking..." />
                      <span className="text-[#9BA1B3] text-sm">
                        Thinking...
                      </span>
                    </div>
                  </ChatBubble>
                );
              }

              return (
                <ChatBubble key={message.id} type={message.type}>
                  <MemoizedMarkdown
                    id={message.id}
                    content={message.content || ""}
                  />
                </ChatBubble>
              );
            })}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-[#2F323D] bg-[#16181D] px-[16px] md:px-[24px] py-[16px]">
          <div className="max-w-[900px] mx-auto flex items-end gap-3">
            <button
              onClick={handleRefresh}
              className="p-2.5 rounded-lg bg-[#2F323D] hover:bg-[#3F424D] transition-colors text-[#9BA1B3] hover:text-white flex items-center justify-center shrink-0"
              title="Start new chat"
            >
              <RotateCcw size={20} />
            </button>
            <div className="flex-1">
              <ChatInput
                onSend={handleUserMessage}
                disabled={
                  status === "submitted" ||
                  status === "streaming" ||
                  isInitializing
                }
              />
              {isInitializing && (
                <div className="text-xs text-[#9BA1B3] mt-2 pl-2">
                  Initializing context...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
