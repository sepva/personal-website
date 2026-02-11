/**
 * Tool definitions for the AI chat agent
 * Tools can either require human confirmation or execute automatically
 */
import { tool, type ToolSet } from "ai";
import { z } from "zod/v3";
import { COMPONENT_NAMES } from "@/constants";

/**
 * Type definition for the fetch content function
 */
type FetchContent = (dataType: string, id?: string) => Promise<any[]>;

/**
 * Type definition for the vector search function
 */
type VectorSearch = (query: string, topK?: number) => Promise<any[]>;

/**
 * Export tools as a function that accepts a fetch content function and vector search function
 * This allows dependency injection for database access with caching
 */
export function tools(fetchContent: FetchContent, vectorSearch: VectorSearch) {
  /**
   * Academic information tool: Displays a comprehensive UI overview of Seppe's academic background
   */
  const getAcademicOverviewPage = tool({
    description: `Displays an interactive UI component showing Seppe Vanswegenoven's academic work, including:
    - Educational background (Bachelor's and Master's degrees from KU Leuven)
    - Academic achievements and distinctions
    - Relevant coursework and research projects
    - Master's thesis on personalized humor generation using LLMs
    
    WHEN TO USE:
    - User asks about Seppe's education, academic background, or university experience
    - Questions like "What did Seppe study?" or "Tell me about his education"
    - When browsing or exploring Seppe's academic credentials
    
    MESSAGE PARAMETER:
    - Provide a brief contextual message that will appear ABOVE the UI component
    - Keep it concise (1-2 sentences) - it's just an introduction to the component
    - Example: "Here's an overview of Seppe's academic background and achievements."
    
    IMPORTANT - AVOIDING REPETITION:
    - The message appears ABOVE the component automatically - don't repeat it
    - The UI component displays ALL academic details - don't summarize them
    - After calling this tool, you MAY add a brief follow-up for engagement only
    - Valid follow-up: "What interests you most?" or "Feel free to ask about any of these!"
    - Invalid follow-up: Repeating the message or listing what's already visible in the UI`,
    inputSchema: z.object({
      message: z
        .string()
        .describe(
          "Brief introduction message (1-2 sentences) that appears above the academic overview component"
        )
    }),
    execute: async ({ message }) => {
      const data = await fetchContent("academic");
      // Return a serializable object that indicates a component should be rendered
      return {
        type: "react-component",
        data,
        componentName: COMPONENT_NAMES.ACADEMIC_OVERVIEW,
        message: message
      };
    }
  });

  /**
   * Professional projects tool: Displays a comprehensive UI overview of Seppe's professional work experience
   */
  const getProfessionalProjects = tool({
    description: `Displays an interactive UI component showing Seppe Vanswegenoven's professional projects, including:
    - Work at Mediagenix as AI Analyst/Pilot Engineer
    - Internships and professional experiences
    - Real-time telemetry dashboard and other professional achievements
    - Technologies used, challenges solved, and measurable impact
    
    WHEN TO USE:
    - User asks about Seppe's work experience, professional projects, or career
    - Questions like "Where does Seppe work?" or "What professional experience does he have?"
    - When exploring his professional achievements and business impact
    
    MESSAGE PARAMETER:
    - Provide a brief contextual message that will appear ABOVE the UI component
    - Keep it concise (1-2 sentences) - it's just an introduction to the component
    - Example: "Here's an overview of Seppe's professional projects and work experience."
    
    IMPORTANT - AVOIDING REPETITION:
    - The message appears ABOVE the component automatically - don't repeat it
    - The UI component displays ALL professional project details - don't summarize them
    - After calling this tool, you MAY add a brief follow-up for engagement only
    - Valid follow-up: "What interests you most?" or "Want to hear more about any specific project?"
    - Invalid follow-up: Repeating the message or listing projects already visible in the UI`,
    inputSchema: z.object({
      message: z
        .string()
        .describe(
          "Brief introduction message (1-2 sentences) that appears above the professional projects component"
        )
    }),
    execute: async ({ message }) => {
      const data = await fetchContent("work");
      // Return a serializable object that indicates a component should be rendered
      return {
        type: "react-component",
        data,
        componentName: COMPONENT_NAMES.PROFESSIONAL_PROJECTS_OVERVIEW,
        message: message
      };
    }
  });

  /**
   * Personal projects tool: Displays a comprehensive UI overview of Seppe's personal side projects
   */
  const getPersonalProjects = tool({
    description: `Displays an interactive UI component showing Seppe Vanswegenoven's personal side projects, including:
    - Self-initiated projects demonstrating creativity and technical skills
    - Open-source contributions and hobby projects
    - Technologies explored, problems solved, and learning outcomes
    - Links to repositories, demos, or detailed project pages
    
    WHEN TO USE:
    - User asks about Seppe's personal projects, side projects, or hobby work
    - Questions like "What projects has Seppe built?" or "Show me his personal work"
    - When exploring his technical skills through self-initiated projects
    
    MESSAGE PARAMETER:
    - Provide a brief contextual message that will appear ABOVE the UI component
    - Keep it concise (1-2 sentences) - it's just an introduction to the component
    - Example: "Here are Seppe's personal projects that showcase his skills and creativity."
    
    IMPORTANT - AVOIDING REPETITION:
    - The message appears ABOVE the component automatically - don't repeat it
    - The UI component displays ALL personal project details - don't summarize them
    - After calling this tool, you MAY add a brief follow-up for engagement only
    - Valid follow-up: "Which one catches your eye?" or "Seppe's always open to collaboration!"
    - Invalid follow-up: Repeating the message or listing projects already visible in the UI`,
    inputSchema: z.object({
      message: z
        .string()
        .describe(
          "Brief introduction message (1-2 sentences) that appears above the personal projects component"
        )
    }),
    execute: async ({ message }) => {
      const data = await fetchContent("projects");
      // Return a serializable object that indicates a component should be rendered
      return {
        type: "react-component",
        data,
        componentName: COMPONENT_NAMES.PERSONAL_PROJECTS_OVERVIEW,
        message: message
      };
    }
  });

  /**
   * Vector search tool: Performs semantic search across all documents about Seppe Vanswegenoven
   */
  const vectorSearchTool = tool({
    description: `Performs semantic vector search across a comprehensive database of documents containing detailed information about Seppe Vanswegenoven.
    This includes text from his CV, project descriptions, academic work, and other portfolio content. Results often include images, screenshots, and demo links.
    
    WHEN TO USE:
    - User asks specific questions about Seppe's skills, experiences, or achievements
    - Questions like "Does Seppe know Python?" or "Tell me about his experience with RAG", FAQ-style queries
    - When you need to find detailed information not immediately visible in overview components
    - For answering targeted questions that require searching through content
    - When exploring ambiguous topics that might span multiple categories
    - When users ask to see images, screenshots, or visual examples of projects
    
    HOW IT WORKS:
    - Takes a natural language query and finds semantically similar content
    - Returns relevant document chunks with content and metadata
    - Results may include image URLs, demo links, and screenshots - ALWAYS check for these and include them in your response
    - Can be called multiple times with different queries to gather comprehensive information
    
    PARAMETERS:
    - query: Natural language search query (be specific and descriptive)
    - topK: Number of results to return (default: 3, max: 10)
      * Use 3-5 for focused queries
      * Use 5-10 for broad exploratory queries or when you need comprehensive coverage
    
    AFTER CALLING:
    - **Check results for images, screenshots, or demo links** - include these in your response using markdown
    - Synthesize the results into a natural, conversational answer
    - Cite specific achievements, projects, or experiences found in the results
    - If results are insufficient, you can call again with a refined query
    - If no relevant results found, be honest and offer to explore related topics`,
    inputSchema: z.object({
      query: z
        .string()
        .min(1, "Query must be at least 1 character long")
        .describe(
          "Natural language search query to find relevant information about Seppe"
        ),
      topK: z
        .number()
        .min(1)
        .max(10)
        .default(3)
        .describe(
          "Number of relevant documents to return (3-5 for focused queries, 5-10 for comprehensive coverage)"
        )
    }),
    execute: async ({ query, topK }) => {
      const results = await vectorSearch(query, topK);
      return {
        type: "vector-search-results",
        data: results,
        message: `Found ${results.length} relevant documents for query: "${query}"`
      };
    }
  });

  /**
   * Contact form tool: Displays an interactive contact form for users to send messages directly to Seppe
   */
  const contactForm = tool({
    description: `Displays an interactive contact form UI where users can send a message directly to Seppe Vanswegenoven.
    The form is stored in the database and Seppe will receive the message.
    
    WHEN TO USE (be proactive but judicious):
    1. User explicitly asks how to contact Seppe or requests to send him a message
    2. User asks a valuable, thoughtful question that cannot be answered from available information
    3. Conversation is naturally wrapping up and user has shown genuine interest in:
       - Collaboration opportunities
       - Job/project opportunities
       - Interesting technical discussions
       - Feedback or suggestions
    4. User has something specific to share with Seppe (opportunities, feedback, ideas)
    
    WHEN NOT TO USE:
    - User is just casually browsing or asking basic questions
    - Information is readily available through other tools
    - Very early in the conversation without establishing context
    - User hasn't shown genuine engagement or interest
    
    FORM DETAILS:
    - Collects: name (required), email (required), message (required)
    - Rate limiting: Maximum 3 submissions per hour per session AND per email address
    - After successful submission: In your NEXT message (when user responds), acknowledge that "Your message has been saved to the database and Seppe will get back to you soon."
    
    MESSAGE PARAMETER:
    - Provide brief context explaining why you're showing the form
    - Example: "I'd be happy to connect you with Seppe. Here's a contact form where you can send him a message directly:"
    - The message appears ABOVE the form automatically - don't repeat it after calling the tool`,
    inputSchema: z.object({
      message: z
        .string()
        .describe(
          "Brief contextual message (1-2 sentences) explaining why you're showing the contact form. Appears above the form automatically."
        )
    }),
    execute: async ({ message }) => {
      return {
        type: "react-component",
        data: {},
        componentName: COMPONENT_NAMES.CONTACT_FORM,
        message: message
      };
    }
  });

  /**
   * Return all available tools
   * These will be provided to the AI model to describe available capabilities
   */
  return {
    getAcademicOverviewPage,
    getProfessionalProjects,
    getPersonalProjects,
    vectorSearchTool,
    contactForm
  } satisfies ToolSet;
}
