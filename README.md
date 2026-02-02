# 💼 Personal Website - Interactive AI Chat Portfolio

An innovative personal portfolio and CV for **Seppe Vanswegenoven** presented through an **AI-powered chat interface**. Instead of navigating through traditional web pages, visitors can have a natural conversation with an AI agent to learn about projects, achievements, experience, and expertise.

## 🎯 Project Overview

This website serves as a comprehensive online presence, showcasing:
- **Personal Projects** - Side projects and personal development work
- **Academic Achievements** - Education, research, and scholarly accomplishments  
- **Professional Experience** - Career history and professional projects
- **Interactive Content** - Rich UI components and overview pages rendered dynamically within chat responses
- **Conversation-Driven Discovery** - Ask the AI agent anything about your experience, skills, and work

## 📚 Content Management

All portfolio content (projects, academic work, professional experience) is managed in a separate repository: **[sepva/personal-website-rag](https://github.com/sepva/personal-website-rag)**

That repository contains:
- Markdown content files organized by type (projects, academic, work, blogs)
- Cloudflare Workflow for automated content synchronization
- Image CDN transformation (converts local paths to GitHub raw URLs)
- Content embedding generation using Cloudflare AI
- Automated population of D1 database and Vectorize index

**To add or update content**, visit the [sepva/personal-website-rag](https://github.com/sepva/personal-website-rag) repository for detailed documentation on the content workflow.

## ✨ What Makes This Special

Rather than a traditional static website where visitors navigate through multiple pages to find information, this project offers an **intelligent chat interface** that:

- **Retrieves content dynamically** from a Cloudflare D1 SQLite database
- **Answers questions directly** by synthesizing information with GPT-4o
- **Renders interactive UI components** - displays rich overview pages directly in the chat
- **Provides a conversational experience** - visitors can ask "What experience do you have with React?" or "Show me your personal projects"
- **Saves time** - no need to dig through multiple pages, just ask what you want to know

The AI agent uses custom tools to fetch relevant content and can render React components inline, creating a unique blend of conversation and visual presentation.

## 🚀 Features

- 💬 **AI-Powered Chat Agent** - Natural language conversation with GPT-4o
- ⚡️ **Real-time Streaming** - Streaming AI responses for responsive UX
- 🗄️ **Cloudflare D1 SQLite** - Persistent content storage at the edge
- 🔄 **Persistent Chat Sessions** - Durable Objects maintain chat history across reconnections
- 🎨 **Dynamic Component Rendering** - React components rendered inline within chat messages
- 🛠️ **Custom AI Tools** - Agent has tools to fetch projects, experience, and academic content
- 🌐 **Vector Search Ready** - Cloudflare Vectorize integration for semantic search
- 🧠 **Smart Caching** - In-memory TTL-based cache for efficient database queries
- 🔐 **Session-Scoped** - Each visitor gets their own isolated chat session
- 📊 **Full Observability** - LangSmith integration for AI interaction tracing
- 🎯 **Type-Safe** - Complete TypeScript support with Zod validation
- 🌓 **Dark/Light Theme** - Theme support with system preference detection
- 📱 **Responsive Design** - Mobile-friendly UI with sidebar and mobile menu
- ♿️ **Accessible** - Built with Radix UI primitives for accessibility

## 🛠️ Technology Stack

### Backend
- **Cloudflare Workers** - Serverless edge computing platform
- **Cloudflare D1** - SQLite database at the edge for content storage
- **Cloudflare Durable Objects** - Stateful serverless for persistent chat sessions
- **Cloudflare Vectorize** - Vector database for semantic search
- **Cloudflare AI** - Edge AI capabilities
- **Agents SDK** - AI agent framework for building conversational agents
- **AI SDK (Vercel)** - Streaming text and tool execution for AI models
- **LangSmith** - AI observability, tracing, and debugging
- **OpenAI GPT-4o** - Primary language model for chat

### Frontend
- **React 19** - UI framework with latest features
- **TypeScript** - Full type-safe development
- **Tailwind CSS 4** - Utility-first styling
- **Vite 7** - Lightning-fast build tooling
- **Radix UI** - Accessible component primitives
- **Phosphor Icons** - Beautiful icon library
- **AI SDK React** - React hooks for streaming AI responses
- **Sonner** - Toast notifications

### Development & Quality
- **Biome 2** - Fast linting and formatting
- **Vitest** - Unit testing framework
- **Wrangler 4** - Cloudflare development CLI
- **Prettier** - Code formatter
- **TypeScript** - Static type checking

## 🚦 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Cloudflare account (free tier works)
- OpenAI API key
- LangSmith API key (optional, for observability)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/sepva/personal-website.git
cd personal-website
```

2. Install dependencies:

```bash
npm install
```

3. Set up your environment:

Create a `.dev.vars` file in the project root:

```env
OPENAI_API_KEY=your_openai_api_key
LANGSMITH_API_KEY=your_langsmith_api_key
```

4. Set up the database:

Create a D1 database using Wrangler:

```bash
# Create the database
npx wrangler d1 create personal-website-db

# Update wrangler.jsonc with your database ID
```

Create a Vectorize index:

```bash
# Create the vector index
npx wrangler vectorize create personal-website-index --dimensions=768 --metric=cosine

# Update wrangler.jsonc with your index name
```

For content population, see the [sepva/personal-website-rag](https://github.com/sepva/personal-website-rag) repository which handles automated content synchronization via Cloudflare Workflows.

### Development

Run the development server:

```bash
npm start
```

The dev server will start at `http://localhost:5173` (Vite) and the Worker backend at `http://localhost:8787`. Your chat interface will be available at `http://localhost:5173`.

The Wrangler CLI automatically handles proxying API requests to the Worker during development.

### Deployment

1. Ensure your Cloudflare configuration in `wrangler.jsonc` is correct (D1 database ID, Durable Object bindings, etc.)

2. Set your secrets in Cloudflare:

```bash
npm run set_secrets
```

This uses the `.dev.vars` file to populate secrets on the remote Cloudflare account.

3. Build and deploy to Cloudflare Workers:

```bash
npm run deploy
```

Your site will be live at your Cloudflare Workers URL.

## 🗂️ Project Structure

```
src/
├── app.tsx                       # Main React chat UI
├── client.tsx                    # Client entry point
├── server.ts                     # AI Chat Durable Object + Worker handler
├── tools.ts                      # Custom tools for the AI agent
├── shared.ts                     # Shared types and interfaces
├── utils.ts                      # Utility functions
├── styles.css                    # Global Tailwind + CSS variables
├── components/
│   ├── chat-bubble/              # Message display with streaming support
│   ├── chat-input/               # Text input + suggestions
│   ├── overview-page/            # Content overview (Academic, Projects, Work)
│   ├── category-tiles/           # Category navigation grid
│   ├── suggestion-chips/         # Quick suggestion buttons
│   ├── sidebar/                  # Desktop sidebar navigation
│   ├── menu-bar/                 # Mobile menu
│   ├── detail-card/              # Individual content cards
│   ├── content-tile/             # Content preview tiles
│   ├── memoized-markdown.tsx     # Optimized markdown rendering
│   └── ...                       # Other UI components
├── hooks/
│   ├── useClickOutside.tsx       # Click-outside detection
│   ├── useMenuNavigation.tsx     # Menu keyboard navigation
│   └── useTheme.ts               # Dark/light theme management
├── instructions/
│   └── system_prompt_agent.md    # AI agent system prompt
├── lib/
│   └── utils.ts                  # Utility helpers
├── providers/                    # React context providers
│   ├── ModalProvider.tsx         # Modal state management
│   └── TooltipProvider.tsx       # Tooltip state management
└── pages/                        # Page layouts
figma/                            # Figma component exports (UI kit)
public/                           # Static assets
tests/                            # Test suite
wrangler.jsonc                    # Cloudflare Workers configuration
vite.config.ts                    # Vite build configuration
vitest.config.ts                  # Vitest test configuration
biome.json                        # Biome linting configuration
```

### Database Schema

The project uses Cloudflare D1 (SQLite) with **four separate content tables**, one for each content type:

- `projects` - Personal side projects and development work
- `academic` - Education, research, and scholarly accomplishments
- `work` - Professional experience and career history
- `blogs` - Blog posts and articles

Each table follows the `ContentItem` interface structure:

```typescript
interface ContentItem {
  id: string;
  title: string;
  description: string;
  tags?: string[];           // Stored as JSON string in D1
  link?: string;
  type: 'project' | 'blog' | 'academic' | 'work';
  date?: string;
  fullContent?: string;      // Full markdown content
}
```

**Vector Search:** Each content item's `fullContent` is embedded using Cloudflare AI (`@cf/baai/bge-base-en-v1.5`) and stored in the Vectorize index with metadata filtering by `data_type` (table name) for semantic search capabilities.

**Schema Management:** Tables are created and populated automatically via Cloudflare Workflows in the [sepva/personal-website-rag](https://github.com/sepva/personal-website-rag) repository.

### AI Tools & Agent

Four custom tools are defined in [src/tools.ts](src/tools.ts) that give the AI agent specialized capabilities:

1. **`getAcademic`** - Retrieves academic content from the `academic` table
   - Returns education, research, and scholarly accomplishments
   - Renders `AcademicOverviewPage` component inline

2. **`getWork`** - Retrieves professional experience from the `work` table
   - Returns career history and professional projects
   - Renders `WorkOverviewPage` component inline

3. **`getProjects`** - Retrieves personal projects from the `projects` table
   - Returns side projects and personal development work
   - Renders `ProjectsOverviewPage` component inline

4. **`semanticSearch`** - Performs vector-based semantic search across all content
   - Accepts a natural language query
   - Uses Cloudflare AI to generate query embeddings
   - Searches Vectorize index and cross-references with D1 for full content
   - Returns top-K most relevant results (default: 3)

Each tool:
1. Accepts parameters from the AI's reasoning
2. Fetches data from D1 database (with 5-minute TTL caching)
3. Returns React component specifications for inline rendering in chat

### Customizing the AI Agent

The agent behavior is controlled by:

1. **System Prompt** - [src/instructions/system_prompt_agent.md](src/instructions/system_prompt_agent.md)
   - Defines the AI's personality and instructions
   - Controls available tools and their usage

2. **Chat Durable Object** - [src/server.ts](src/server.ts)
   - Implements the `Chat` class extending `AIChatAgent`
   - Handles streaming responses with `streamText`
   - Manages session caching with TTL
   - Implements retry logic for database resilience

3. **Model Configuration** - Currently using `gpt-4o-2024-11-20` from OpenAI

### Customizing the UI

- **Theme** - Modify Tailwind config and CSS variables in [src/styles.css](src/styles.css)
- **Components** - Update or add components in `src/components/`
- **Chat Interface** - Customize message rendering, input styling, and layout
- **Overview Pages** - Each content type has a dedicated overview page component
- **Icons** - Uses Phosphor Icons; browse [phosphoricons.com](https://phosphoricons.com)

### Session Management

Each visitor gets a unique session ID that maps to a Durable Object instance:
- Persistent across page reloads (stored in sessionStorage)
- Maintains chat history and conversation context
- In-memory caching with configurable TTL
- Automatic retry logic for transient failures
- Connection health checks

## ⚙️ Scripts

```bash
npm start            # Start Vite dev server + Wrangler Worker
npm run deploy       # Build and deploy to Cloudflare Workers
npm test             # Run Vitest test suite
npm run types        # Generate TypeScript types for Wrangler
npm run format       # Format code with Prettier
npm run check        # Check formatting + lint with Biome + TypeScript
npm run set_secrets  # Load .dev.vars into Cloudflare
```

## 📊 Observability

The project includes full observability with LangSmith:

- **Trace AI interactions** - Every tool call and agent step is traced
- **Debug streaming** - Monitor real-time token streaming
- **Performance metrics** - Track latency and token usage
- **Error tracking** - Detailed error logs for debugging

Configure with `LANGSMITH_API_KEY` in `.dev.vars` for production tracing.

## 💡 How It Works

1. **Visitor asks a question** - "What personal projects have you worked on?"
2. **AI agent processes intent** - GPT-4o understands the request and determines which tool to use
3. **Tool executes** - Fetches relevant content from the D1 database with caching
4. **UI component renders** - Returns a React component specification to render inline
5. **Chat displays result** - The overview page appears in the chat with all relevant content
6. **Conversation continues** - The AI can answer follow-up questions with full context

This architecture combines the flexibility of conversational AI with the rich interactivity of modern web applications, creating a unique and engaging way for visitors to explore portfolio content.

## 📝 License

MIT
