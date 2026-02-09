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
import { AcademicOverviewPage } from "@/components/overview-page/AcademicOverviewPage";
import { PersonalProjectsOverviewPage } from "./components/overview-page/PersonalProjectsOverviewPage";
import { ProfessionalProjectsOverviewPage } from "./components/overview-page/ProfessionalProjectsOverviewPage";import { ContactForm } from "./components/contact-form/ContactForm";
import { Loader } from "./components/loader/Loader";

type MessageType = 'bot' | 'user' | 'system';

interface CustomMessage {
  id: string;
  type: MessageType;
  content?: string;
  component?: 'categories' | 'suggestions' | 'AcademicOverviewPage' | 'PersonalProjectsOverviewPage' | 'ProfessionalProjectsOverviewPage';
  data?: any;
}

export default function Chat() {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Generate or retrieve a unique session ID for this client
  // This ensures each client connects to their own Durable Object instance
  const [sessionId] = useState(() => {
    // Try to get existing session ID from sessionStorage (persists across page reloads)
    const existingId = sessionStorage.getItem('chat-session-id');
    if (existingId) {
      return existingId;
    }
    // Generate new session ID using cryptographically secure random values
    const randomBytes = new Uint8Array(8);
    crypto.getRandomValues(randomBytes);
    const randomPart = Array.from(randomBytes, b => b.toString(36)).join('').slice(0, 9);
    const newId = `session-${Date.now()}-${randomPart}`;
    sessionStorage.setItem('chat-session-id', newId);
    return newId;
  });

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
  const displayMessages: CustomMessage[] = [...customMessages];
  
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
      // Handle tool results that contain React components
      if (part.type && part.type.startsWith('tool-')) {
        const toolPart = part as any;
        if (toolPart.state === 'output-available' && toolPart.output) {
          const output = toolPart.output;
          // Check if the output indicates a React component should be rendered
          if (output.type === 'react-component' && output.componentName) {
            // Add a text message first
            if (output.message) {
              displayMessages.push({
                id: `${m.id}-${part.type}-message`,
                type: 'bot',
                content: output.message,
              });
            }
            // Add the component message
            displayMessages.push({
              id: `${m.id}-${part.type}-component`,
              type: 'bot',
              component: output.componentName as any,
              data: output.data || {},
            });
          }
        }
      }
    });
  });

  // Add loading indicator when agent is processing (only before streaming starts)
  const isLoading = status === "submitted" || status === "streaming";
  // Check if there's any text content or tool outputs in the latest agent messages
  const hasContent = agentMessages.length > 0 && 
    agentMessages[agentMessages.length - 1]?.parts?.some(part => 
      (part.type === "text" && part.text) || 
      (part.type?.startsWith('tool-') && (part as any).state === 'output-available')
    );
  
  if (isLoading && !hasContent && displayMessages[displayMessages.length - 1]?.id !== 'loading-indicator') {
    displayMessages.push({
      id: 'loading-indicator',
      type: 'bot',
      content: '' // Will be rendered as Loader component
    });
  }

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

              if (message.component === 'AcademicOverviewPage') {
                return (
                  <ChatBubble key={message.id} type={message.type}>
                    <AcademicOverviewPage data={message.data || []} />
                  </ChatBubble>
                );
              }

              if (message.component === 'PersonalProjectsOverviewPage') {
                return (
                  <ChatBubble key={message.id} type={message.type}>
                    <PersonalProjectsOverviewPage data={message.data || []} />
                  </ChatBubble>
                );
              }

              if (message.component === 'ProfessionalProjectsOverviewPage') {
                return (
                  <ChatBubble key={message.id} type={message.type}>
                    <ProfessionalProjectsOverviewPage data={message.data || []} />
                  </ChatBubble>
                );
              }

              if (message.component === 'ContactForm') {
                return (
                  <ChatBubble key={message.id} type={message.type}>
                    <ContactForm data={message.data} />
                  </ChatBubble>
                );
              }

              // Show loading indicator for the loading message
              if (message.id === 'loading-indicator') {
                return (
                  <ChatBubble key={message.id} type={message.type}>
                    <div className="flex items-center gap-2">
                      <Loader size={20} title="AI is thinking..." />
                      <span className="text-[#9BA1B3] text-sm">Thinking...</span>
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
