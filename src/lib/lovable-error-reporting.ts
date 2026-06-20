/**
 * Generic error reporting utility
 * Can be connected to external error tracking services (Sentry, LogRocket, etc.)
 */

type ErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

export function reportError(error: unknown, context: Record<string, unknown> = {}, options: ErrorOptions = {}) {
  // Log to console in development
  if (process.env.NODE_ENV === "development") {
    console.error("Application Error:", error, context);
  }

  // TODO: Connect to your error tracking service here (Sentry, LogRocket, etc.)
  // Example:
  // if (window.Sentry) {
  //   window.Sentry.captureException(error, { contexts: { app: context }, ...options });
  // }
}

/**
 * Alias for backward compatibility
 * @deprecated Use reportError instead
 */
export function reportLovableError(error: unknown, context: Record<string, unknown> = {}) {
  reportError(error, context, {
    mechanism: "react_error_boundary",
    handled: false,
    severity: "error",
  });
}
