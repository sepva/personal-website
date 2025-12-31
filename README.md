# 💼 Personal Website - Interactive CV

An innovative personal portfolio and CV presented through an AI-powered chat interface. Instead of navigating through traditional web pages, visitors can have a natural conversation to learn about my projects, achievements, experience, and expertise.

## 🎯 Project Goal

This website serves as my comprehensive online presence, showcasing:
- **Personal Projects** - Side projects and passion work
- **Academic Achievements** - Education, research, and scholarly accomplishments
- **Professional Experience** - Career history and professional projects
- **Posts & Articles** - Thoughts, tutorials, and insights

## ✨ What Makes This Special

Rather than a traditional static website where visitors navigate through multiple pages to find information, this project offers an **intelligent chat interface** that:

- **Retrieves pre-made content** about my background and experience
- **Answers questions directly** by summarizing and synthesizing information
- **Provides a conversational experience** - visitors can ask "What experience do you have with React?" or "Tell me about your most interesting project"
- **Saves time** - no need to dig through dozens of pages, just ask what you want to know

Think of it as having a conversation with an AI that knows everything about me, my work, and my accomplishments.

## 🚀 Features

- 💬 Interactive chat interface powered by AI
- 🛠️ Custom tools for retrieving portfolio content
- 🌓 Dark/Light theme support
- ⚡️ Real-time streaming responses
- 🔄 Conversation history
- 🎨 Modern, responsive UI

## 🛠️ Technology Stack

Built with:
- **Cloudflare Workers** - Edge computing platform
- **Cloudflare Agents** - AI agent framework
- **AI SDK** - Language model integration
- **React** - UI framework
- **TypeScript** - Type-safe development
- **Vite** - Build tooling

## 🚦 Getting Started

### Prerequisites

- Node.js and npm
- Cloudflare account
- OpenAI API key

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

Create a `.dev.vars` file:

```env
OPENAI_API_KEY=your_openai_api_key
```

### Development

Run the development server:

```bash
npm start
```

Visit `http://localhost:8787` to interact with the chat interface.

### Deployment

Deploy to Cloudflare Workers:

```bash
npm run deploy
```

## 📁 Project Structure

```
├── src/
│   ├── app.tsx           # Chat UI implementation
│   ├── server.ts         # AI agent logic and configuration
│   ├── tools.ts          # Custom tools for content retrieval
│   ├── utils.ts          # Helper functions
│   ├── styles.css        # UI styling
│   ├── components/       # React components
│   ├── data/            # Portfolio data and content
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utility libraries
│   ├── pages/           # Page components
│   └── providers/       # Context providers
├── public/              # Static assets
└── tests/              # Test files
```

## 🎨 Customization

### Adding Content

To add your own portfolio content:

1. **Update data files** in `src/data/` with your projects, experience, and achievements
2. **Create custom tools** in `tools.ts` to retrieve and present your content
3. **Customize the agent** in `server.ts` to understand your domain and respond appropriately

### Adding New Tools

Add new tools in `tools.ts` to provide the AI with access to your content:

```ts
// Example: Tool to retrieve project information
const getProjects = tool({
  description: "Get information about personal projects",
  parameters: z.object({
    category: z.string().optional(),
    limit: z.number().optional()
  }),
  execute: async ({ category, limit }) => {
    // Return project data from your content store
    return await fetchProjects({ category, limit });
  }
});
```

### Modifying the UI

The chat interface is built with React and can be customized in `app.tsx`:

- Modify theme colors in `styles.css`
- Add custom components in `src/components/`
- Customize message rendering and tool confirmation dialogs
- Extend the UI with additional features like search, filters, or navigation

## 💡 How It Works

1. **Visitor asks a question** - "What experience do you have with TypeScript?"
2. **AI agent processes** - Understands the intent and determines what information is needed
3. **Tools retrieve content** - Fetches relevant projects, experience, or articles
4. **AI synthesizes response** - Combines retrieved content with natural language understanding
5. **Visitor gets answer** - Receives a direct, conversational answer

This creates a more engaging and efficient way for recruiters, colleagues, or collaborators to learn about your background.

## 📝 License

MIT
