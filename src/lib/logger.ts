/**
 * Application Logger
 * Centralized logging utility for consistent error tracking and debugging
 *
 * ⚠️ SERVER-SIDE ONLY - DO NOT USE IN CLIENT COMPONENTS
 * This logger is designed for server-side code (API routes, cron jobs, server components).
 * Client components should handle errors through UI state only.
 *
 * In production, errors are logged to help with debugging without exposing
 * sensitive data. In development, full console logging is available.
 */

// Ensure this is only used server-side
if (typeof window !== "undefined") {
  throw new Error(
    "Logger is server-side only. Do not import in client components."
  );
}

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogContext {
  userId?: string;
  organizationId?: string;
  resource?: string;
  action?: string;
  [key: string]: unknown;
}

/**
 * Core logging function
 * In production: logs to error tracking service (TODO: integrate Sentry/LogRocket/etc)
 * In development: logs to console
 */
function log(
  level: LogLevel,
  message: string,
  error?: unknown,
  context?: LogContext,
) {
  const isDev = process.env.NODE_ENV === "development";
  const timestamp = new Date().toISOString();

  // Sanitize error object to prevent sensitive data leakage
  const sanitizedError = error instanceof Error
    ? {
        name: error.name,
        message: error.message,
        stack: isDev ? error.stack : undefined, // Only include stack trace in dev
      }
    : error;

  const logData = {
    timestamp,
    level,
    message,
    error: sanitizedError,
    context: context ? sanitizeSensitiveData(context) : undefined,
  };

  // Development: full console logging
  if (isDev) {
    const consoleMethod = level === "error" ? console.error :
                         level === "warn" ? console.warn :
                         level === "debug" ? console.debug :
                         console.log;

    consoleMethod(`[${level.toUpperCase()}] ${message}`, logData);
    return;
  }

  // Production: structured logging
  // For now, log to console in JSON format (easy to parse by log aggregators)
  // TODO: Integrate with error tracking service (Sentry, LogRocket, etc.)
  console.error(JSON.stringify(logData));

  // TODO: Send to external service
  // Example: Sentry.captureException(error, { contexts: { custom: context } });
}

/**
 * Remove sensitive data from context before logging
 */
function sanitizeSensitiveData(context: LogContext): LogContext {
  const sanitized = { ...context };

  // Remove sensitive fields
  const sensitiveKeys = [
    "password",
    "currentPassword",
    "token",
    "apiKey",
    "secret",
    "accessToken",
    "refreshToken",
  ];

  for (const key of sensitiveKeys) {
    if (key in sanitized) {
      sanitized[key] = "[REDACTED]";
    }
  }

  return sanitized;
}

/**
 * Logger interface - use these throughout the application
 */
export const logger = {
  /**
   * Log informational messages (non-error events)
   */
  info: (message: string, context?: LogContext) => {
    log("info", message, undefined, context);
  },

  /**
   * Log warnings (potential issues that aren't errors)
   */
  warn: (message: string, context?: LogContext) => {
    log("warn", message, undefined, context);
  },

  /**
   * Log errors with full context
   * Use this instead of console.error
   */
  error: (message: string, error?: unknown, context?: LogContext) => {
    log("error", message, error, context);
  },

  /**
   * Log debug information (only shown in development)
   */
  debug: (message: string, data?: unknown) => {
    if (process.env.NODE_ENV === "development") {
      log("debug", message, data);
    }
  },

  /**
   * API error logging - specialized for API routes
   */
  apiError: (
    endpoint: string,
    error: unknown,
    context?: {
      method?: string;
      userId?: string;
      organizationId?: string;
      [key: string]: unknown;
    },
  ) => {
    log(
      "error",
      `API Error: ${endpoint}`,
      error,
      {
        resource: "api",
        endpoint,
        ...context,
      },
    );
  },

  /**
   * Client error logging - specialized for client-side errors
   */
  clientError: (
    component: string,
    error: unknown,
    context?: LogContext,
  ) => {
    log(
      "error",
      `Client Error: ${component}`,
      error,
      {
        resource: "client",
        component,
        ...context,
      },
    );
  },

  /**
   * Cron job logging - specialized for scheduled tasks
   */
  cronError: (
    jobName: string,
    error: unknown,
    context?: LogContext,
  ) => {
    log(
      "error",
      `Cron Job Error: ${jobName}`,
      error,
      {
        resource: "cron",
        job: jobName,
        ...context,
      },
    );
  },

  cronInfo: (
    jobName: string,
    message: string,
    context?: LogContext,
  ) => {
    log(
      "info",
      `Cron Job: ${jobName} - ${message}`,
      undefined,
      {
        resource: "cron",
        job: jobName,
        ...context,
      },
    );
  },
};

/**
 * Helper to safely stringify objects for logging
 */
export function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return "[Unable to stringify object]";
  }
}
