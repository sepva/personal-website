/**
 * Tool definitions for the AI chat agent
 * Tools can either require human confirmation or execute automatically
 */
import { tool, type ToolSet } from "ai";
import { z } from "zod/v3";

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
   * Academic information tool: when called, provides the relevant academic details
   */
  const getAcademicOverviewPage = tool({
    description: `Calling this tool will provide a UI component in the chat that shows an overview of academic work Seppe Vanswegenoven has done. 
    Use the message input to send a message before the UI component is shown. The data part of the return value contains all academic items that are shown in the UI.`,
    inputSchema: z.object({message: z.string()}),
    execute: async ({ message }) => {
      const data = await fetchContent('academic');
      // Return a serializable object that indicates a component should be rendered
      return {
        type: 'react-component',
        data,
        componentName: 'AcademicOverviewPage',
        message: message
      };
    }
  });

  /**
   * Professional projects tool: when called, provides relevant professional project details
   */
  const getProfessionalProjects = tool({
    description: `Calling this tool will provide a UI component in the chat that shows an overview of professional projects Seppe Vanswegenoven has worked on.
    Use the message input to send a message before the UI component is shown. The data part of the return value contains all professional project items that are shown in the UI.`,
    inputSchema: z.object({message: z.string()}),
    execute: async ({ message }) => {
      const data = await fetchContent('work');
      // Return a serializable object that indicates a component should be rendered
      return {
        type: 'react-component',
        data,
        componentName: 'ProfessionalProjectsOverviewPage',
        message: message
      };
    }
  });

  /**
   * Personal projects tool: when called, provides relevant personal project details
   */
  const getPersonalProjects = tool({
    description: `Calling this tool will provide a UI component in the chat that shows an overview of personal projects Seppe Vanswegenoven has developed.
    Use the message input to send a message before the UI component is shown. The data part of the return value contains all personal project items that are shown in the UI.`,
    inputSchema: z.object({message: z.string()}),
    execute: async ({ message }) => {
      const data = await fetchContent('projects');
      // Return a serializable object that indicates a component should be rendered
      return {
        type: 'react-component',
        data,
        componentName: 'PersonalProjectsOverviewPage',
        message: message
      };
    }
  });

  /**
   * Vector search tool: when called, performs a vector search on the documents in the vector database containing information about Seppe Vanswegenoven
   */
  const vectorSearchTool = tool({
    description: `Use this tool to perform a vector search on the documents in the vector database containing information about Seppe Vanswegenoven.
    The input is a text query and the number of relevant documents to return. The output is a list of documents with their content and metadata.`,
    inputSchema: z.object({
      query: z.string().min(1, "Query must be at least 1 character long"),
      topK: z.number().min(1).max(10).default(3)
    }),
    execute: async ({ query, topK }) => {
      const results = await vectorSearch(query, topK);
      return {
        type: 'vector-search-results',
        data: results,
        message: `Found ${results.length} relevant documents for query: "${query}"`
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
    vectorSearchTool
  } satisfies ToolSet;
}
