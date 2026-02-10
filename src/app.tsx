/** biome-ignore-all lint/correctness/useUniqueElementIds: it's alright */
import { useEffect, useState, useRef } from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "agents/ai-react";
import type { UIMessage } from "@ai-sdk/react";

// Figma component imports
import { ChatBubble } from "@/components/chat-bubble/ChatBubble";
import { CategoryTiles, categories } from "@/components/category-tiles/CategoryTiles";
import { SuggestionChips } from "@/components/suggestion-chips/SuggestionChips";
import { Header } from "@/components/header/Header";
import { ChatInput } from "@/components/chat-input/ChatInput";
import { MemoizedMarkdown } from "@/components/memoized-markdown";
import { AcademicOverviewPage } from "@/components/overview-page/AcademicOverviewPage";
import { PersonalProjectsOverviewPage } from "./components/overview-page/PersonalProjectsOverviewPage";
import { ProfessionalProjectsOverviewPage } from "./components/overview-page/ProfessionalProjectsOverviewPage";
import { ContactForm } from "./components/contact-form/ContactForm";
import { Loader } from "./components/loader/Loader";
import { RotateCcw } from "lucide-react";
import { parseShareableLinkFromURL } from "./lib/shareable-links";

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
  
  const [shareableLinkLoading, setShareableLinkLoading] = useState(true);
  const [shareableHistoryMessages, setShareableHistoryMessages] = useState<UIMessage[] | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // Check for shareable link on mount and initialize messages
  useEffect(() => {
    const initializeShareableLink = async () => {
      const shareableLink = parseShareableLinkFromURL();
      
      if (!shareableLink) {
        setShareableLinkLoading(false);
        return;
      }

      try {
        // Fetch content data from API
        const response = await fetch(`/api/content?link=${encodeURIComponent(shareableLink)}`);
        
        if (!response.ok) {
          console.error('Failed to fetch shareable content:', response.statusText);
          setShareableLinkLoading(false);
          return;
        }

        const result = await response.json() as {
          contentItem: any;
          allItems: any[];
          dataType: string;
          componentName: string;
        };
        const { contentItem, allItems, componentName } = result;

        if (!contentItem) {
          console.error('Content not found for shareable link:', shareableLink);
          setShareableLinkLoading(false);
          return;
        }

        // Build preprogrammed messages for UI
        const preprogrammedMessages: CustomMessage[] = [
          // Intro message
          {
            id: '1',
            type: 'bot',
            content: "Hi! I'm the personal AI assistant of Seppe Vanswegenoven. Ask me anything about his academics, professional projects, or personal projects.",
          },
          // Category tiles
          {
            id: '2',
            type: 'bot',
            component: 'categories',
            data: {}
          },
          // User message requesting the content
          {
            id: '3',
            type: 'user',
            content: `Show me ${contentItem.title}`
          },
          // Bot message with overview page component
          {
            id: '4',
            type: 'bot',
            component: componentName as any,
            data: {
              data: allItems,
              initialEnlargedItemId: contentItem.id
            }
          }
        ];

        // Build synthetic UIMessage history for server initialization
        // This gives the AI context about what the user is viewing
        const typeContext = contentItem.type === 'academic' 
          ? "from Seppe's academic work"
          : contentItem.type === 'work'
          ? "from his professional experience" 
          : "one of his personal projects";
        
        // Generate unique IDs to avoid React key conflicts
        const timestamp = Date.now();
        
        const historyMessages: UIMessage[] = [
          // User message
          {
            id: `shareable-init-user-${timestamp}`,
            role: 'user',
            parts: [{ type: 'text', text: `Show me ${contentItem.title}` }]
          } as UIMessage,
          // Assistant message with context about the content
          {
            id: `shareable-init-assistant-${timestamp}`, 
            role: 'assistant',
            parts: [{
              type: 'text',
              text: `I'm showing you **${contentItem.title}**${contentItem.description ? ': ' + contentItem.description : ''}. This is ${typeContext}. What would you like to know about it?`
            }]
          } as UIMessage
        ];

        setCustomMessages(preprogrammedMessages);
        setShareableHistoryMessages(historyMessages);
        setShareableLinkLoading(false);
      } catch (error) {
        console.error('Error initializing shareable link:', error);
        setShareableLinkLoading(false);
      }
    };

    initializeShareableLink();
  }, []);
  
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
      if (!shareableHistoryMessages || isInitializing || agentMessages.length > 0) {
        return;
      }

      try {
        setIsInitializing(true);

        // Send special init-history message
        await sendMessage({
          role: 'user' as const,
          parts: [{ 
            type: 'init-history' as any, 
            history: shareableHistoryMessages 
          } as any]
        });
        
        // Clear the history messages to prevent re-sending
        setShareableHistoryMessages(null);
      } catch (error) {
        console.error('[History Init] Failed to send initialization message:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeHistory();
  }, [shareableHistoryMessages, sendMessage, isInitializing, agentMessages.length]);

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

  // Handler to refresh the chat
  const handleRefresh = () => {
    clearHistory();
    sessionStorage.removeItem('chat-session-id');
    // Clear shareable link from URL
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    // Reset states
    setShareableHistoryMessages(null);
    setIsInitializing(false);
    window.location.reload();
  };

  // Combine custom UI messages with agent messages for display
  const displayMessages: CustomMessage[] = [...customMessages];
  
  // Add agent messages after the initial custom messages
  agentMessages.forEach((m) => {
    const isUser = m.role === "user";
    
    // Add text parts
    m.parts?.forEach((part, partIndex) => {
      if (part.type === "text") {
        displayMessages.push({
          id: `${m.id}-${part.type}-${partIndex}`,
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
                id: `${m.id}-${part.type}-${partIndex}-message`,
                type: 'bot',
                content: output.message,
              });
            }
            // Add the component message
            displayMessages.push({
              id: `${m.id}-${part.type}-${partIndex}-component`,
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
  const isLoading = shareableLinkLoading || status === "submitted" || status === "streaming";
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
                    <AcademicOverviewPage 
                      data={message.data?.data || message.data || []} 
                      initialEnlargedItemId={message.data?.initialEnlargedItemId}
                    />
                  </ChatBubble>
                );
              }

              if (message.component === 'PersonalProjectsOverviewPage') {
                return (
                  <ChatBubble key={message.id} type={message.type}>
                    <PersonalProjectsOverviewPage 
                      data={message.data?.data || message.data || []} 
                      initialEnlargedItemId={message.data?.initialEnlargedItemId}
                    />
                  </ChatBubble>
                );
              }

              if (message.component === 'ProfessionalProjectsOverviewPage') {
                return (
                  <ChatBubble key={message.id} type={message.type}>
                    <ProfessionalProjectsOverviewPage 
                      data={message.data?.data || message.data || []} 
                      initialEnlargedItemId={message.data?.initialEnlargedItemId}
                    />
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
                disabled={status === "submitted" || status === "streaming" || isInitializing}
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
