import type { ContentItem } from "@/shared";

/**
 * Type definitions for the personal website project.
 * Provides type safety across server, repositories, services, and hooks.
 */

// ============================================================================
// Database Types
// ============================================================================

/**
 * Result from D1Database queries with typed results and metadata
 */
export interface DatabaseQueryResult<T = unknown> {
  results: T[];
  success: boolean;
  meta?: {
    duration?: number;
    rows_read?: number;
    rows_written?: number;
    changes?: number;
    last_row_id?: number;
  };
}

/**
 * Generic database row type for count queries
 */
export interface CountResult {
  count: number;
}

// ============================================================================
// Chat and Message Types
// ============================================================================

// Note: We use the UIMessage and UIMessagePart types from @ai-sdk/react
// These types are already defined and should not be redefined here

// ============================================================================
// WebSocket Types
// ============================================================================

/**
 * WebSocket connection with typed attachment
 */
export interface WebSocketConnection {
  id?: string;
  serializeAttachment: (data: ConnectionAttachment) => void;
  deserializeAttachment: () => ConnectionAttachment | null;
}

/**
 * Data attached to WebSocket connection
 */
export interface ConnectionAttachment {
  connectionId: string;
}

// ============================================================================
// Rate Limiting Types
// ============================================================================

/**
 * Result of rate limit check
 */
export interface RateLimitCheckResult {
  allowed: boolean;
  remainingAttempts?: number;
  resetTime?: Date;
  reason?: string;
  minutesUntilAvailable?: number;
}

/**
 * Global rate limit check result
 */
export interface GlobalRateLimitCheckResult {
  exceeded: boolean;
  count: number;
}

/**
 * Session rate limit check result
 */
export interface SessionRateLimitCheckResult {
  exceeded: boolean;
  minutesUntilAvailable?: number;
}

/**
 * Email rate limit check result
 */
export interface EmailRateLimitCheckResult {
  exceeded: boolean;
  minutesUntilAvailable?: number;
}

// ============================================================================
// AI and Vector Types (Env type defined in env.d.ts)
// ============================================================================

/**
 * AI embedding result with multiple possible shapes
 */
export interface EmbeddingResult {
  data?: number[][];
  shape?: number[];
  embeddings?: number[][];
}

/**
 * Vectorize search result with metadata
 */
export interface VectorSearchMatch {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Shareable Link Types
// ============================================================================

/**
 * Shareable link API response
 */
export interface ShareableLinkResponse {
  success: boolean;
  contentItem?: ShareableContentItem;
  allItems?: ShareableContentItem[];
  error?: string;
}

/**
 * Content item from shareable link (alias for ContentItem for consistency)
 */
export type ShareableContentItem = ContentItem;

// ============================================================================
// Stream and Config Types
// ============================================================================

/**
 * Stream text configuration (from AI SDK)
 */
export interface StreamTextConfig {
  model: unknown;
  system: string;
  messages: unknown[];
  tools: unknown;
  stopWhen?: unknown;
  maxSteps?: number;
  maxTokens?: number;
  temperature?: number;
  onFinish?: unknown;
  experimental_repairToolCall?: unknown;
  providerOptions?: unknown;
}

/**
 * Chat stub for Durable Object access
 */
export interface ChatStub {
  fetch: (request: Request) => Promise<Response>;
  persistPendingMessages: () => Promise<void>;
  fetchContentByShareableLink?: (link: string) => Promise<unknown>;
  saveContactMessage?: (
    email: string,
    name: string,
    message: string
  ) => Promise<{ success: boolean; error?: string }>;
}
