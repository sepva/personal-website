/**
 * Configuration Constants
 * Centralizes magic numbers and configuration values to avoid duplication
 * and provide a single source of truth for application settings.
 */

// ===== Cache Configuration =====

/**
 * Time-to-live for cached content in milliseconds (5 minutes)
 */
export const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Maximum number of entries to store in the content cache
 */
export const MAX_CACHE_ENTRIES = 100;

// ===== Database Connection Health =====

/**
 * Interval for checking database connection health (30 seconds)
 */
export const CONNECTION_HEALTH_CHECK_INTERVAL_MS = 30 * 1000;

/**
 * Timeout before considering a database connection idle (5 minutes)
 */
export const CONNECTION_IDLE_TIMEOUT_MS = 5 * 60 * 1000;

// ===== Retry Configuration =====

/**
 * Default maximum number of retry attempts for failed operations
 */
export const DEFAULT_MAX_RETRIES = 3;

/**
 * Base delay in milliseconds before first retry attempt
 */
export const DEFAULT_BASE_DELAY_MS = 100;

/**
 * Backoff multiplier for exponential retry delays
 */
export const DEFAULT_BACKOFF_MULTIPLIER = 2;

/**
 * Maximum delay in milliseconds between retry attempts
 */
export const MAX_RETRY_DELAY_MS = 2000;

// ===== Rate Limiting =====

/**
 * Default global rate limit for contact form submissions (per hour)
 * Protects against system-wide abuse
 */
export const DEFAULT_GLOBAL_RATE_LIMIT = 100;

/**
 * Default session rate limit for contact form submissions (per hour)
 * Prevents spam from individual sessions
 */
export const DEFAULT_SESSION_RATE_LIMIT = 3;

/**
 * Default email rate limit for contact form submissions (per hour)
 * Prevents abuse from specific email addresses
 */
export const DEFAULT_EMAIL_RATE_LIMIT = 3;

/**
 * One hour in milliseconds (used for rate limit windows)
 */
export const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * One minute in milliseconds (used for rate limit calculations)
 */
export const ONE_MINUTE_MS = 60 * 1000;

// ===== Message History =====

/**
 * Default maximum number of messages to keep in chat history
 * Uses sliding window to drop oldest conversation turns
 */
export const DEFAULT_MAX_HISTORY_MESSAGES = 20;

// ===== Component Names =====

/**
 * Component names used for routing and rendering
 * Centralizes component name strings to avoid duplication and typos
 */
export const COMPONENT_NAMES = {
  ACADEMIC_OVERVIEW: "AcademicOverviewPage",
  PERSONAL_PROJECTS_OVERVIEW: "PersonalProjectsOverviewPage",
  PROFESSIONAL_PROJECTS_OVERVIEW: "ProfessionalProjectsOverviewPage",
  CONTACT_FORM: "ContactForm"
} as const;

/**
 * Type for component names
 */
export type ComponentName =
  (typeof COMPONENT_NAMES)[keyof typeof COMPONENT_NAMES];

/**
 * Maps data type strings to their corresponding component names
 * Used by ContentRepository for shareable link resolution
 */
export const DATA_TYPE_TO_COMPONENT: Record<string, ComponentName> = {
  academic: COMPONENT_NAMES.ACADEMIC_OVERVIEW,
  work: COMPONENT_NAMES.PROFESSIONAL_PROJECTS_OVERVIEW,
  projects: COMPONENT_NAMES.PERSONAL_PROJECTS_OVERVIEW
} as const;

// ===== API Endpoints =====

/**
 * API endpoint paths used throughout the application
 */
export const API_ENDPOINTS = {
  CONTENT: "/api/content",
  CONTACT: "/api/contact"
} as const;

/**
 * Type for API endpoint keys
 */
export type APIEndpoint = (typeof API_ENDPOINTS)[keyof typeof API_ENDPOINTS];
