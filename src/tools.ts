/**
 * Tool definitions for the AI chat agent
 * Tools can either require human confirmation or execute automatically
 */
import { tool, type ToolSet } from "ai";
import { z } from "zod/v3";

/**
 * Academic information tool: when called, provides the relevant academic details
 */
const getAcademicOverviewPage = tool({
  description: "Provide a UI component that shows an overview of academic information about Seppe Vanswegenoven",
  inputSchema: z.object({}),
  execute: async () => {
    // Return a serializable object that indicates a component should be rendered
    return {
      type: 'react-component',
      componentName: 'AcademicOverviewPage',
      message: 'Here is the academic overview page:'
    };
  }
});

/**
 * Professional projects tool: when called, provides relevant professional project details
 */
const getProfessionalProjects = tool({
  description: "Provide information about Seppe Vanswegenoven's professional projects",
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    console.log(`Getting professional project information for query: ${query}`);
    return "Seppe Vanswegenoven has worked on several professional projects including a web application for managing tasks and a mobile app for fitness tracking.";
  }
});

/**
 * Personal projects tool: when called, provides relevant personal project details
 */
const getPersonalProjects = tool({
  description: "Provide information about Seppe Vanswegenoven's personal projects",
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    console.log(`Getting personal project information for query: ${query}`);
    return "Seppe Vanswegenoven has developed a personal blog platform and an open-source library for data visualization.";
  }
});

/**
 * Export all available tools
 * These will be provided to the AI model to describe available capabilities
 */
export const tools = {
  getAcademicOverviewPage,
  getProfessionalProjects,
  getPersonalProjects
} satisfies ToolSet;
