import { retryWithExponentialBackoff } from "@/utils/retry";
import { createLogger, type Logger } from "@/utils/logger";
import {
  DEFAULT_MAX_RETRIES,
  DEFAULT_BASE_DELAY_MS,
  DEFAULT_GLOBAL_RATE_LIMIT,
  DEFAULT_SESSION_RATE_LIMIT,
  DEFAULT_EMAIL_RATE_LIMIT,
  ONE_HOUR_MS,
  ONE_MINUTE_MS
} from "@/config/constants";
import type {
  GlobalRateLimitCheckResult,
  SessionRateLimitCheckResult,
  CountResult
} from "@/types";

/**
 * ContactService handles all contact form submissions with multi-level rate limiting.
 *
 * Rate limiting strategy:
 * 1. Global rate limit: Protects against system-wide abuse (default: 100/hour)
 * 2. Session rate limit: Prevents spam from individual sessions (default: 3/hour)
 * 3. Email rate limit: Prevents abuse from specific email addresses (default: 3/hour)
 *
 * All limits are configurable via environment variables.
 */
export class ContactService {
  private db: D1Database;
  private contactSubmissions: number[] = []; // Timestamps of submissions in current session
  private env: Env;
  private logger: Logger;

  constructor(db: D1Database, env: Env) {
    this.db = db;
    this.env = env;
    this.logger = createLogger('contact', env);
  }

  /**
   * Execute a database query with exponential backoff retry logic
   */
  private async executeDBQuery<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    return retryWithExponentialBackoff(operation, {
      maxAttempts: DEFAULT_MAX_RETRIES,
      baseDelayMs: DEFAULT_BASE_DELAY_MS,
      onRetry: (attempt, error, delayMs) => {
        this.logger.warn(
          'db_retry',
          `Database operation retry`,
          {
            operationName,
            attempt,
            maxAttempts: DEFAULT_MAX_RETRIES,
            delayMs,
            errorMessage: error.message
          },
          'database'
        );
      }
    });
  }

  /**
   * Clean up expired submissions from session rate limit tracking
   */
  private cleanupExpiredSubmissions(): void {
    const oneHourAgo = Date.now() - ONE_HOUR_MS;
    this.contactSubmissions = this.contactSubmissions.filter(
      (timestamp) => timestamp > oneHourAgo
    );
  }

  /**
   * Check if global rate limit has been exceeded
   */
  private async checkGlobalRateLimit(
    globalLimit: number
  ): Promise<GlobalRateLimitCheckResult> {
    const oneHourAgo = Date.now() - ONE_HOUR_MS;
    const oneHourAgoISO = new Date(oneHourAgo).toISOString();

    const result = await this.executeDBQuery(async () => {
      const { results } = await this.db
        .prepare(
          "SELECT COUNT(*) as count FROM contact_messages WHERE timestamp > ?"
        )
        .bind(oneHourAgoISO)
        .all();

      return results[0] as unknown as CountResult;
    }, "checkGlobalRateLimit");

    return {
      exceeded: result.count >= globalLimit,
      count: result.count
    };
  }

  /**
   * Check if session-based rate limit has been exceeded
   */
  private checkSessionRateLimit(
    sessionLimit: number
  ): SessionRateLimitCheckResult {
    if (this.contactSubmissions.length < sessionLimit) {
      return { exceeded: false };
    }

    const oldestSubmission = Math.min(...this.contactSubmissions);
    const minutesUntilAvailable = Math.ceil(
      (oldestSubmission + ONE_HOUR_MS - Date.now()) / ONE_MINUTE_MS
    );

    return {
      exceeded: true,
      minutesUntilAvailable
    };
  }

  /**
   * Check if email-based rate limit has been exceeded
   */
  private async checkEmailRateLimit(
    email: string,
    emailLimit: number
  ): Promise<{ exceeded: boolean; count: number }> {
    const oneHourAgo = Date.now() - ONE_HOUR_MS;
    const oneHourAgoISO = new Date(oneHourAgo).toISOString();

    const result = await this.executeDBQuery(async () => {
      const { results } = await this.db
        .prepare(
          "SELECT COUNT(*) as count FROM contact_messages WHERE email = ? AND timestamp > ?"
        )
        .bind(email, oneHourAgoISO)
        .all();

      return results[0] as unknown as CountResult;
    }, "checkEmailRateLimit");

    return {
      exceeded: result.count >= emailLimit,
      count: result.count
    };
  }

  /**
   * Save a contact message to the database with comprehensive rate limiting
   *
   * @param email - Sender's email address
   * @param name - Sender's name
   * @param message - Contact message content
   * @returns Promise resolving to success status and optional error message
   */
  async saveContactMessage(
    email: string,
    name: string,
    message: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Clean up expired submissions from session tracking
      this.cleanupExpiredSubmissions();
      this.logger.debug(
        'rate_limit_check',
        'Checking rate limits for contact submission',
        {
          email,
          sessionSubmissionsCount: this.contactSubmissions.length
        },
        'ratelimit'
      );

      // Get rate limit values from environment variables with defaults
      const globalLimit = Number.parseInt(
        this.env?.RATE_LIMIT_GLOBAL_PER_HOUR ||
          String(DEFAULT_GLOBAL_RATE_LIMIT),
        10
      );
      const sessionLimit = Number.parseInt(
        this.env?.RATE_LIMIT_SESSION_PER_HOUR ||
          String(DEFAULT_SESSION_RATE_LIMIT),
        10
      );
      const emailLimit = Number.parseInt(
        this.env?.RATE_LIMIT_EMAIL_PER_HOUR || String(DEFAULT_EMAIL_RATE_LIMIT),
        10
      );

      // 1. Check global rate limit (across all sessions and emails)
      const globalCheck = await this.checkGlobalRateLimit(globalLimit);
      if (globalCheck.exceeded) {
        this.logger.error(
          'rate_limit_exceeded',
          'Global rate limit reached',
          undefined,
          {
            limitType: 'global',
            currentCount: globalCheck.count,
            limit: globalLimit
          },
          'ratelimit'
        );
        return {
          success: false,
          error:
            "Service is currently experiencing high traffic. Please try again later."
        };
      }
      this.logger.info(
        'rate_limit_check',
        'Global rate limit check passed',
        {
          limitType: 'global',
          currentCount: globalCheck.count,
          limit: globalLimit,
          remaining: globalLimit - globalCheck.count,
          status: 'pass'
        },
        'ratelimit'
      );

      // 2. Check session-based rate limit
      const sessionCheck = this.checkSessionRateLimit(sessionLimit);
      if (sessionCheck.exceeded) {
        this.logger.error(
          'rate_limit_exceeded',
          'Session rate limit reached',
          undefined,
          {
            limitType: 'session',
            currentCount: this.contactSubmissions.length,
            limit: sessionLimit,
            retryAfter: sessionCheck.minutesUntilAvailable
          },
          'ratelimit'
        );
        return {
          success: false,
          error: `Rate limit reached. Please try again in ${sessionCheck.minutesUntilAvailable} minute${sessionCheck.minutesUntilAvailable !== 1 ? "s" : ""}.`
        };
      }

      // 3. Check email-based rate limit
      const emailCheck = await this.checkEmailRateLimit(email, emailLimit);
      if (emailCheck.exceeded) {
        this.logger.error(
          'rate_limit_exceeded',
          'Email rate limit reached',
          undefined,
          {
            limitType: 'email',
            email,
            currentCount: emailCheck.count,
            limit: emailLimit
          },
          'ratelimit'
        );
        return {
          success: false,
          error: "Rate limit reached. Please try again later."
        };
      }

      // Generate ID and timestamp
      const id = crypto.randomUUID();
      const timestamp = new Date().toISOString();

      // Insert into database
      await this.executeDBQuery(async () => {
        await this.db
          .prepare(
            "INSERT INTO contact_messages (id, email, name, message, timestamp) VALUES (?, ?, ?, ?, ?)"
          )
          .bind(id, email, name, message, timestamp)
          .run();
      }, "insertContactMessage");

      // Add to session rate limit tracking
      this.contactSubmissions.push(Date.now());

      this.logger.info(
        'contact_saved',
        'Contact message saved successfully',
        {
          messageId: id,
          email,
          messageLength: message.length
        },
        'database'
      );
      return { success: true };
    } catch (error) {
      this.logger.error(
        'contact_save_failed',
        'Failed to save contact message',
        error,
        { email },
        'database'
      );
      return {
        success: false,
        error: "Failed to save message. Please try again later."
      };
    }
  }
}
