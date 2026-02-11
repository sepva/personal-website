import { retryWithExponentialBackoff } from "@/utils/retry";
import {
  DEFAULT_MAX_RETRIES,
  DEFAULT_BASE_DELAY_MS,
  DEFAULT_GLOBAL_RATE_LIMIT,
  DEFAULT_SESSION_RATE_LIMIT,
  DEFAULT_EMAIL_RATE_LIMIT,
  ONE_HOUR_MS,
  ONE_MINUTE_MS
} from "@/config/constants";

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
  private env: unknown; // Environment variables containing rate limit configs

  constructor(db: D1Database, env: unknown) {
    this.db = db;
    this.env = env;
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
        console.warn(
          `${operationName} failed (attempt ${attempt}/${DEFAULT_MAX_RETRIES}), retrying in ${delayMs}ms:`,
          error.message
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
  ): Promise<{ exceeded: boolean; count: number }> {
    const oneHourAgo = Date.now() - ONE_HOUR_MS;
    const oneHourAgoISO = new Date(oneHourAgo).toISOString();

    const result = await this.executeDBQuery(async () => {
      const { results } = await this.db
        .prepare(
          "SELECT COUNT(*) as count FROM contact_messages WHERE timestamp > ?"
        )
        .bind(oneHourAgoISO)
        .all();

      return results[0] as { count: number };
    }, "checkGlobalRateLimit");

    return {
      exceeded: result.count >= globalLimit,
      count: result.count
    };
  }

  /**
   * Check if session-based rate limit has been exceeded
   */
  private checkSessionRateLimit(sessionLimit: number): {
    exceeded: boolean;
    minutesUntilAvailable?: number;
  } {
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

      return results[0] as { count: number };
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
      console.log(
        `Current session submissions in last hour: ${this.contactSubmissions.length}`
      );

      // Get rate limit values from environment variables with defaults
      const env = this.env as any;
      const globalLimit = Number.parseInt(
        env?.RATE_LIMIT_GLOBAL_PER_HOUR || String(DEFAULT_GLOBAL_RATE_LIMIT),
        10
      );
      const sessionLimit = Number.parseInt(
        env?.RATE_LIMIT_SESSION_PER_HOUR || String(DEFAULT_SESSION_RATE_LIMIT),
        10
      );
      const emailLimit = Number.parseInt(
        env?.RATE_LIMIT_EMAIL_PER_HOUR || String(DEFAULT_EMAIL_RATE_LIMIT),
        10
      );

      // 1. Check global rate limit (across all sessions and emails)
      const globalCheck = await this.checkGlobalRateLimit(globalLimit);
      if (globalCheck.exceeded) {
        console.warn(
          `Global rate limit reached: ${globalCheck.count} submissions in last hour`
        );
        return {
          success: false,
          error:
            "Service is currently experiencing high traffic. Please try again later."
        };
      }
      console.log(
        `Global submissions in last hour: ${globalCheck.count}/${globalLimit}`
      );

      // 2. Check session-based rate limit
      const sessionCheck = this.checkSessionRateLimit(sessionLimit);
      if (sessionCheck.exceeded) {
        return {
          success: false,
          error: `Rate limit reached. Please try again in ${sessionCheck.minutesUntilAvailable} minute${sessionCheck.minutesUntilAvailable !== 1 ? "s" : ""}.`
        };
      }

      // 3. Check email-based rate limit
      const emailCheck = await this.checkEmailRateLimit(email, emailLimit);
      if (emailCheck.exceeded) {
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

      console.log(`Contact message saved: ${id} from ${email}`);
      return { success: true };
    } catch (error) {
      console.error("Failed to save contact message:", error);
      return {
        success: false,
        error: "Failed to save message. Please try again later."
      };
    }
  }
}
