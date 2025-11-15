/** biome-ignore-all lint/correctness/useUniqueElementIds: it's alright */
import { useEffect, useState, useRef, use } from "react";
import { useAgent } from "agents/react";
import { isToolUIPart } from "ai";
import { useAgentChat } from "agents/ai-react";
import type { UIMessage } from "@ai-sdk/react";
import type { tools } from "./tools";

// Figma component imports
import { ChatBubble } from "@/components/chat-bubble/ChatBubble";
import { CategoryTiles } from "@/components/category-tiles/CategoryTiles";
import { SuggestionChips } from "@/components/suggestion-chips/SuggestionChips";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { MobileMenu } from "@/components/menu-bar/MobileMenu";
import { ChatInput } from "@/components/chat-input/ChatInput";
import { MemoizedMarkdown } from "@/components/memoized-markdown";
import { ToolInvocationCard } from "@/components/tool-invocation-card/ToolInvocationCard";

// List of tools that require human confirmation
const toolsRequiringConfirmation: (keyof typeof tools)[] = [
  "getWeatherInformation"
];

type MessageType = 'bot' | 'user' | 'system';

interface CustomMessage {
  id: string;
  type: MessageType;
  content?: string;
  component?: 'categories' | 'suggestions';
  data?: any;
}

const initialSuggestions = [
  "What's the weather in San Francisco?",
  "What time is it in Tokyo?",
  "Show me the current time",
  "Tell me about the weather"
];

export default function Chat() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [customMessages, setCustomMessages] = useState<CustomMessage[]>([
    {
      id: '1',
      type: 'bot',
      content: "Hi! I'm your AI assistant. I can help you with weather information and time zones. What would you like to know about?"
    },
    {
      id: '2',
      type: 'bot',
      component: 'categories',
      data: {}
    }
  ]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [customMessages]);

  const agent = useAgent({
    agent: "chat"
  });

  const {
    messages: agentMessages,
    addToolResult,
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

  const pendingToolCallConfirmation = agentMessages.some((m: UIMessage) =>
    m.parts?.some(
      (part) =>
        isToolUIPart(part) &&
        part.state === "input-available" &&
        toolsRequiringConfirmation.includes(
          part.type.replace("tool-", "") as keyof typeof tools
        )
    )
  );

  const handleCategorySelect = async (category: string) => {
    const prompts: Record<string, string> = {
      weather: "Tell me about weather information you can provide",
      time: "What time zone information can you help with?",
      help: "What can you help me with?"
    };

    const message = prompts[category] || "Help me with this";
    
    // Send to backend agent
    await sendMessage({
      role: "user",
      parts: [{ type: "text", text: message }]
    });
  };

  const handleUserMessage = async (message: string) => {
    if (!message.trim()) return;

    // Send directly to the agent
    await sendMessage({
      role: "user",
      parts: [{ type: "text", text: message }]
    });
  };

  const handleNewChat = () => {
    clearHistory();
    setCustomMessages([
      {
        id: '1',
        type: 'bot',
        content: "Hi! I'm your AI assistant. I can help you with weather information and time zones. What would you like to know about?"
      },
      {
        id: '2',
        type: 'bot',
        component: 'categories',
        data: {}
      }
    ]);
  };

  // Combine custom UI messages with agent messages for display
  const displayMessages = [...customMessages];
  
  // Add agent messages after the initial custom messages
  agentMessages.forEach((m) => {
    const isUser = m.role === "user";
    
    // Add text parts
    m.parts?.forEach((part) => {
      if (part.type === "text") {
        displayMessages.push({
          id: `${m.id}-${part.type}`,
          type: isUser ? 'user' : 'bot',
          content: part.text
        });
      }
    });
  });

  return (
    <div className="flex h-screen bg-[#0F1115]">
      <HasOpenAIKey />
      <Sidebar onNewChat={handleNewChat} />
      <MobileMenu onNewChat={handleNewChat} />

      <div className="flex-1 flex flex-col h-screen">
        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto px-[16px] md:px-[24px] py-[24px] md:py-[32px]">
          <div className="max-w-[900px] mx-auto space-y-[16px]">
            {displayMessages.map((message) => {
              if (message.component === 'categories') {
                return (
                  <div key={message.id} className="max-w-[85%]">
                    <CategoryTiles onSelect={handleCategorySelect} />
                  </div>
                );
              }

              if (message.component === 'suggestions') {
                return (
                  <div key={message.id} className="max-w-[85%]">
                    <SuggestionChips
                      suggestions={message.data?.suggestions || initialSuggestions}
                      onSelect={handleUserMessage}
                    />
                  </div>
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

            {/* Render tool invocations from agent messages */}
            {agentMessages.map((m) => (
              <div key={`tools-${m.id}`}>
                {m.parts?.map((part, i) => {
                  if (isToolUIPart(part) && m.role === "assistant") {
                    const toolCallId = part.toolCallId;
                    const toolName = part.type.replace("tool-", "");
                    const needsConfirmation = toolsRequiringConfirmation.includes(
                      toolName as keyof typeof tools
                    );

                    return (
                      <ToolInvocationCard
                        // biome-ignore lint/suspicious/noArrayIndexKey: using index is safe here
                        key={`${toolCallId}-${i}`}
                        toolUIPart={part}
                        toolCallId={toolCallId}
                        needsConfirmation={needsConfirmation}
                        onSubmit={({ toolCallId, result }) => {
                          addToolResult({
                            tool: part.type.replace("tool-", ""),
                            toolCallId,
                            output: result
                          });
                        }}
                        addToolResult={(toolCallId, result) => {
                          addToolResult({
                            tool: part.type.replace("tool-", ""),
                            toolCallId,
                            output: result
                          });
                        }}
                      />
                    );
                  }
                  return null;
                })}
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-[#2F323D] bg-[#16181D] px-[16px] md:px-[24px] py-[16px]">
          <div className="max-w-[900px] mx-auto">
            <ChatInput
              onSend={handleUserMessage}
              disabled={pendingToolCallConfirmation || status === "submitted" || status === "streaming"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const hasOpenAiKeyPromise = fetch("/check-open-ai-key").then((res) =>
  res.json<{ success: boolean }>()
);

function HasOpenAIKey() {
  const hasOpenAiKey = use(hasOpenAiKeyPromise);

  if (!hasOpenAiKey.success) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-red-500/10 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg border border-red-200 dark:border-red-900 p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                <svg
                  className="w-5 h-5 text-red-600 dark:text-red-400"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-labelledby="warningIcon"
                >
                  <title id="warningIcon">Warning Icon</title>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
                  OpenAI API Key Not Configured
                </h3>
                <p className="text-neutral-600 dark:text-neutral-300 mb-1">
                  Requests to the API, including from the frontend UI, will not
                  work until an OpenAI API key is configured.
                </p>
                <p className="text-neutral-600 dark:text-neutral-300">
                  Please configure an OpenAI API key by setting a{" "}
                  <a
                    href="https://developers.cloudflare.com/workers/configuration/secrets/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-red-600 dark:text-red-400"
                  >
                    secret
                  </a>{" "}
                  named{" "}
                  <code className="bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded text-red-600 dark:text-red-400 font-mono text-sm">
                    OPENAI_API_KEY
                  </code>
                  . <br />
                  You can also use a different model provider by following these{" "}
                  <a
                    href="https://github.com/cloudflare/agents-starter?tab=readme-ov-file#use-a-different-ai-model-provider"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-red-600 dark:text-red-400"
                  >
                    instructions.
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
}
