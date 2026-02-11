/**
 * Centralized logging utility for Cloudflare Workers
 * 
 * Features:
 * - Environment-aware formatting (pretty console for dev, JSON for production)
 * - Configurable log levels via LOG_LEVEL env var
 * - Structured logging with correlation IDs for request tracing
 * - Performance timing helpers
 * - Error serialization with stack traces
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogContext {
  requestId?: string;
  sessionId?: string;
  connectionId?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  service: string;
  operation: string;
  category?: string;
  message: string;
  duration?: number;
  metadata?: Record<string, unknown>;
  error?: {
    type: string;
    message: string;
    code?: string;
    stack?: string;
  };
  requestId?: string;
  sessionId?: string;
  connectionId?: string;
}

interface Env {
  LOG_LEVEL?: string;
  LOG_FORMAT?: 'json' | 'pretty';
}

export class Logger {
  private service: string;
  private context: LogContext;
  private minLevel: LogLevel;
  private isPretty: boolean;

  constructor(service: string, env: Partial<Env> = {}, context: LogContext = {}) {
    this.service = service;
    this.context = context;
    this.minLevel = this.parseLogLevel(env.LOG_LEVEL);
    this.isPretty = this.shouldUsePrettyFormat(env.LOG_FORMAT);
  }

  private parseLogLevel(level?: string): LogLevel {
    const levelMap: Record<string, LogLevel> = {
      DEBUG: LogLevel.DEBUG,
      INFO: LogLevel.INFO,
      WARN: LogLevel.WARN,
      ERROR: LogLevel.ERROR,
    };
    return levelMap[level?.toUpperCase() || 'INFO'] ?? LogLevel.INFO;
  }

  private shouldUsePrettyFormat(format?: string): boolean {
    if (format) {
      return format === 'pretty';
    }
    // Auto-detect: use pretty for local development (when process is defined)
    // Cloudflare Workers don't have process in production
    return typeof process !== 'undefined';
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.minLevel;
  }

  withContext(context: LogContext): Logger {
    return new Logger(
      this.service,
      { LOG_LEVEL: LogLevel[this.minLevel], LOG_FORMAT: this.isPretty ? 'pretty' : 'json' },
      { ...this.context, ...context }
    );
  }

  private formatError(error: unknown): { type: string; message: string; code?: string; stack?: string } {
    if (error instanceof Error) {
      return {
        type: error.constructor.name,
        message: error.message,
        code: (error as any).code,
        stack: error.stack,
      };
    }
    return {
      type: 'Unknown',
      message: String(error),
    };
  }

  private createLogEntry(
    level: LogLevel,
    operation: string,
    message: string,
    metadata?: Record<string, unknown>,
    error?: unknown,
    category?: string
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      service: this.service,
      operation,
      message,
      ...this.context,
    };

    if (category) {
      entry.category = category;
    }

    if (metadata && Object.keys(metadata).length > 0) {
      entry.metadata = metadata;
    }

    if (error) {
      entry.error = this.formatError(error);
    }

    return entry;
  }

  private formatPretty(entry: LogEntry): void {
    const icons: Record<string, string> = {
      DEBUG: '⚫',
      INFO: '🔵',
      WARN: '🟡',
      ERROR: '🔴',
    };

    const time = new Date(entry.timestamp).toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3 
    });

    const icon = icons[entry.level] || '⚪';
    const header = `${icon} [${entry.level}] ${time} | ${entry.service}/${entry.operation}`;
    
    console.log(header);

    // Print context fields
    if (entry.requestId) console.log(`  requestId: ${entry.requestId}`);
    if (entry.sessionId) console.log(`  sessionId: ${entry.sessionId}`);
    if (entry.connectionId) console.log(`  connectionId: ${entry.connectionId}`);

    // Print message
    if (entry.message) console.log(`  ${entry.message}`);

    // Print metadata
    if (entry.metadata) {
      for (const [key, value] of Object.entries(entry.metadata)) {
        if (value !== undefined && value !== null) {
          const valueStr = typeof value === 'object' ? JSON.stringify(value, null, 2).replace(/\n/g, '\n  ') : String(value);
          console.log(`  ${key}: ${valueStr}`);
        }
      }
    }

    // Print duration if present
    if (entry.duration !== undefined) {
      console.log(`  duration: ${entry.duration}ms`);
    }

    // Print error if present
    if (entry.error) {
      console.log(`  Error: ${entry.error.message}`);
      if (entry.error.code) {
        console.log(`    code: ${entry.error.code}`);
      }
      if (entry.error.stack) {
        const stackLines = entry.error.stack.split('\n');
        stackLines.forEach(line => console.log(`    ${line}`));
      }
    }

    console.log(''); // Empty line for readability
  }

  private formatJson(entry: LogEntry): void {
    // Always use console.log for JSON output
    // Cloudflare captures all console output regardless of method
    console.log(JSON.stringify(entry));
  }

  private log(
    level: LogLevel,
    operation: string,
    message: string,
    metadata?: Record<string, unknown>,
    error?: unknown,
    category?: string
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry = this.createLogEntry(level, operation, message, metadata, error, category);

    if (this.isPretty) {
      this.formatPretty(entry);
    } else {
      this.formatJson(entry);
    }
  }

  debug(operation: string, message: string, metadata?: Record<string, unknown>, category?: string): void {
    this.log(LogLevel.DEBUG, operation, message, metadata, undefined, category);
  }

  info(operation: string, message: string, metadata?: Record<string, unknown>, category?: string): void {
    this.log(LogLevel.INFO, operation, message, metadata, undefined, category);
  }

  warn(operation: string, message: string, metadata?: Record<string, unknown>, category?: string): void {
    this.log(LogLevel.WARN, operation, message, metadata, undefined, category);
  }

  error(operation: string, message: string, error?: unknown, metadata?: Record<string, unknown>, category?: string): void {
    this.log(LogLevel.ERROR, operation, message, metadata, error, category);
  }

  startTimer(): LogTimer {
    return new LogTimer(this);
  }
}

export class LogTimer {
  private startTime: number;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
    this.startTime = Date.now();
  }

  end(
    level: 'debug' | 'info' | 'warn' | 'error',
    operation: string,
    message: string,
    metadata?: Record<string, unknown>,
    category?: string
  ): number {
    const duration = Date.now() - this.startTime;
    const metadataWithDuration = { ...metadata, duration };
    
    if (level === 'error') {
      this.logger[level](operation, message, undefined, metadataWithDuration, category);
    } else {
      this.logger[level](operation, message, metadataWithDuration, category);
    }
    
    return duration;
  }
}

/**
 * Factory function to create a logger instance
 */
export function createLogger(service: string, env: Partial<Env> = {}, context: LogContext = {}): Logger {
  return new Logger(service, env, context);
}
