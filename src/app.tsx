/** biome-ignore-all lint/correctness/useUniqueElementIds: it's alright */
import { useEffect, useState, useRef } from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "agents/ai-react";
import type { UIMessage } from "@ai-sdk/react";

// Figma component imports
import { ChatBubble } from "@/components/chat-bubble/ChatBubble";
import { CategoryTiles, categories } from "@/components/category-tiles/CategoryTiles";
import { SuggestionChips } from "@/components/suggestion-chips/SuggestionChips";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { MobileMenu } from "@/components/menu-bar/MobileMenu";
import { ChatInput } from "@/components/chat-input/ChatInput";
import { MemoizedMarkdown } from "@/components/memoized-markdown";

type MessageType = 'bot' | 'user' | 'system';

interface CustomMessage {
  id: string;
  type: MessageType;
  content?: string;
  component?: 'categories' | 'suggestions';
  data?: any;
}

export default function Chat() {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initial custom messages
  const [customMessages, setCustomMessages] = useState<CustomMessage[]>([
      {
        id: '1',
        type: 'bot',
        content: "Hi! I'm the personal AI assistant of Seppe Vanswegenoven. Ask me anything about his academics, professional projects, or personal projects.",
      },
      {
        id: '2',
        type: 'bot',
        component: 'categories',
        data: {}
      }
    ]);
  
  // Function to scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Scroll to bottom when custom messages change
  useEffect(() => {
    scrollToBottom();
  }, [customMessages]);

  const agent = useAgent({
    agent: "chat"
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

  // Handler to send a message to the bot on choosing a category
  const handleCategorySelect = async (category: string) => {
    const message = categories.find(cat => cat.id === category)?.prompt || "Help me with this";
    
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

  // Handler to start a new chat
  const handleNewChat = () => {
    clearHistory();
    setCustomMessages(customMessages);
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
                      suggestions={message.data?.suggestions}
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



            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-[#2F323D] bg-[#16181D] px-[16px] md:px-[24px] py-[16px]">
          <div className="max-w-[900px] mx-auto">
            <ChatInput
              onSend={handleUserMessage}
              disabled={status === "submitted" || status === "streaming"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
