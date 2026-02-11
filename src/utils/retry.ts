/**
 * Configuration options for retry behavior with exponential backoff
 */
export interface RetryOptions {
  /**
   * Maximum number of retry attempts (default: 3)
   */
  maxAttempts?: number;

  /**
   * Initial delay in milliseconds before first retry (default: 100)
   */
  baseDelayMs?: number;

  /**
   * Maximum delay in milliseconds between retries (default: 2000)
   */
  maxDelayMs?: number;

  /**
   * Multiplier for exponential backoff (default: 2)
   * Delay grows as: baseDelayMs * (backoffMultiplier ^ attempt)
   */
  backoffMultiplier?: number;

  /**
   * Optional callback invoked on each retry attempt
   * @param attempt Current attempt number (1-indexed)
   * @param error Error that triggered the retry
   * @param delayMs Delay before next retry in milliseconds
   */
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;

  /**
   * Optional predicate to determine if an error is retryable
   * If not provided, all errors are considered retryable
   * @param error The error to check
   * @returns true if the operation should be retried, false to throw immediately
   */
  isRetryable?: (error: Error) => boolean;
}

/**
 * Execute an async operation with exponential backoff retry logic
 *
 * @example
 * ```typescript
 * const result = await retryWithExponentialBackoff(
 *   async () => fetch('/api/data'),
 *   {
 *     maxAttempts: 3,
 *     baseDelayMs: 100,
 *     onRetry: (attempt, error, delay) => {
 *       console.warn(`Retry attempt ${attempt} after error: ${error.message}`);
 *     }
 *   }
 * );
 * ```
 *
 * @param operation Async function to execute with retry logic
 * @param options Configuration options for retry behavior
 * @returns Promise resolving to the operation result
 * @throws Error if all retry attempts fail
 */
export async function retryWithExponentialBackoff<T>(
  operation: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 100,
    maxDelayMs = 2000,
    backoffMultiplier = 2,
    onRetry,
    isRetryable
  } = options ?? {};

  let lastError: Error | null = null;
  let delay = baseDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      if (isRetryable && !isRetryable(lastError)) {
        throw lastError;
      }

      // Don't retry if this was the last attempt
      if (attempt >= maxAttempts) {
        break;
      }

      // Invoke retry callback if provided
      if (onRetry) {
        onRetry(attempt, lastError, delay);
      }

      // Wait with exponential backoff
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    }
  }

  throw new Error(
    `Operation failed after ${maxAttempts} attempts: ${lastError?.message}`
  );
}
