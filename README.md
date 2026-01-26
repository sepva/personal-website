# 💼 Personal Website - Interactive CV

An innovative personal portfolio and CV presented through an AI-powered chat interface. Instead of navigating through traditional web pages, visitors can have a natural conversation to learn about projects, achievements, experience, and expertise.

## 🎯 Project Overview

This website serves as a comprehensive online presence, showcasing:
- **Personal Projects** - Side projects and personal development work
- **Academic Achievements** - Education, research, and scholarly accomplishments
- **Professional Experience** - Career history and professional projects
- **Interactive Content** - Dynamic UI components rendered within chat responses

## ✨ What Makes This Special

Rather than a traditional static website where visitors navigate through multiple pages to find information, this project offers an **intelligent chat interface** that:

- **Retrieves content dynamically** from a Cloudflare D1 SQLite database
- **Answers questions directly** by synthesizing information with GPT-4o
- **Renders interactive UI components** - displays rich overview pages directly in the chat
- **Provides a conversational experience** - visitors can ask "What experience do you have with React?" or "Show me your personal projects"
- **Saves time** - no need to dig through multiple pages, just ask what you want to know

The AI agent uses custom tools to fetch relevant content and can render React components inline, creating a unique blend of conversation and visual presentation.

## 🚀 Features

- 💬 **Interactive Chat Interface** - Powered by GPT-4o with streaming responses
- 🗄️ **Cloudflare D1 Database** - SQLite database for content storage
- 🎨 **Dynamic UI Components** - React components rendered inline within chat
- 🛠️ **Custom AI Tools** - Specialized tools for retrieving portfolio content
- 🌓 **Dark/Light Theme** - Theme support with system preference detection
- ⚡️ **Real-time Streaming** - Streaming AI responses for better UX
- 🔄 **Conversation History** - Maintains context across the chat session
- 📊 **LangSmith Integration** - Observability and monitoring for AI interactions
- 🧠 **Smart Caching** - In-memory caching for database queries
- 🎯 **Strong Typing** - Full TypeScript support with Zod validation

## 🛠️ Technology Stack

### Backend
- **Cloudflare Workers** - Serverless edge computing platform
- **Cloudflare D1** - SQLite database at the edge
- **Cloudflare Agents SDK** - AI agent framework for building chat agents
- **AI SDK (Vercel)** - Streaming and tool execution for AI models
- **LangSmith** - AI observability and tracing

### Frontend
- **React 19** - UI framework with latest features
- **TypeScript** - Type-safe development
- **Tailwind CSS 4** - Utility-first styling
- **Vite** - Fast build tooling
- **Radix UI** - Accessible component primitives
- **Phosphor Icons** - Icon library

### Development
- **Biome** - Fast linting and formatting
- **Vitest** - Unit testing framework
- **Wrangler** - Cloudflare development CLI

## 🚦 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Cloudflare account (free tier works)
- OpenAI API key
- LangSmith API key (optional, for observability)

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
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

Then create your database schema and populate it with your content.

### Development

Run the development server:

```bash
npm start
```

Visit `http://localhost:8787` to interact with the chat interface.

### Deployment

1. Set your secrets in Cloudflare:

```bash
npm run set_secrets
```

2. Deploy to Cloudflare Workers:

```bash
npm run deploy
```

Your site will be live on your Cloudflare Workers domain!

## 📁 Project Structure

```
├── src/
│   ├── app.tsx              # Main chat UI React application
│   ├── client.tsx           # Client-side entry point
│   ├── server.ts            # AI agent logic and Cloudflare Worker handler
│   ├── tools.ts             # Custom AI tools for content retrieval
│   ├── shared.ts            # Shared types and interfaces
│   ├── utils.ts             # Utility functions
│   ├── styles.css           # Global styles
│   ├── components/          # React components
│   │   ├── chat-bubble/     # Chat message display
│   │   ├── chat-input/      # User input component
│   │   ├── overview-page/   # Content overview components
│   │   ├── detail-card/     # Content detail views
│   │   ├── content-tile/    # Content preview tiles
│   │   └── ...              # Other UI components
│   ├── hooks/               # Custom React hooks
│   ├── instructions/        # AI system prompts
│   │   └── system_prompt_agent.md
│   ├── lib/                 # Utility libraries
│   ├── pages/               # Page components
│   └── providers/           # React context providers
├── public/                  # Static assets
├── tests/                   # Test files
├── wrangler.jsonc          # Cloudflare Workers configuration
├── vite.config.ts          # Vite build configuration
└── package.json            # Project dependencies
```

## 🎨 Customization

### Database Schema

The project uses Cloudflare D1 (SQLite) with separate tables for different content types:
- `academic` - Academic achievements and research
- `work` - Professional projects and experience
- `projects` - Personal projects

Each table should have this schema:

```sql
CREATE TABLE {table_name} (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL,
  tags TEXT,  -- JSON array as string
  date TEXT,
  fullContent TEXT,
  link_to_article TEXT
);
```

Add your content using SQL `INSERT` statements or the Wrangler CLI.

### Adding Custom Tools

Tools are defined in [tools.ts](src/tools.ts). Each tool can:
1. Fetch data from the database using the injected `fetchContent` function
2. Return structured data with a component name to render UI elements

Example of adding a new tool:

```ts
const getBlogPosts = tool({
  description: `Shows blog posts and articles`,
  inputSchema: z.object({ message: z.string() }),
  execute: async ({ message }) => {
    const data = await fetchContent('blog');
    return {
      type: 'react-component',
      data,
      componentName: 'BlogOverviewPage',
      message: message
    };
  }
});
```

### Customizing the AI Agent

The agent's behavior is controlled by:
1. **System Prompt** - [system_prompt_agent.md](src/instructions/system_prompt_agent.md) defines the AI's personality and instructions
2. **Available Tools** - Defined in [tools.ts](src/tools.ts)
3. **Model Configuration** - In [server.ts](src/server.ts), currently using `gpt-4o-2024-11-20`

### Customizing the UI

The chat interface components can be customized:
- **Theme** - Modify Tailwind configuration and CSS variables in [styles.css](src/styles.css)
- **Components** - Update or create new components in `src/components/`
- **Overview Pages** - Customize how content is displayed in overview components
- **Chat Bubbles** - Modify message rendering in the chat-bubble component

## 💡 How It Works

1. **Visitor asks a question** - "What personal projects have you worked on?"
2. **AI agent processes intent** - GPT-4o understands the request and determines which tool to use
3. **Tool executes** - Fetches relevant content from the D1 database with caching
4. **UI component renders** - Returns a React component specification to render inline
5. **Chat displays result** - The overview page appears in the chat with all relevant content
6. **Conversation continues** - The AI can answer follow-up questions with full context

This architecture combines the flexibility of conversational AI with the rich interactivity of modern web applications, creating a unique and engaging way for visitors to explore portfolio content.

## 🔧 Available Scripts

- `npm start` - Start development server with Vite
- `npm run deploy` - Build and deploy to Cloudflare Workers
- `npm run set_secrets` - Upload environment variables to Cloudflare
- `npm run types` - Generate TypeScript types from Wrangler
- `npm test` - Run tests with Vitest
- `npm run format` - Format code with Prettier
- `npm run check` - Run type checking and linting

## 📝 License

MIT
