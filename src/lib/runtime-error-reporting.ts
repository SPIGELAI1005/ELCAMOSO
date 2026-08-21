/**
 * Optional preview-editor telemetry hooks (injected only in some host environments).
 * App code never depends on them; calls are no-ops in production standalone.
 */
type RuntimeErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

type PreviewTelemetry = {
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: RuntimeErrorOptions,
  ) => void;
};

declare global {
  interface Window {
    __previewTelemetry?: PreviewTelemetry;
    __reportRuntimeError?: (payload: {
      message: string;
      stack?: string;
      filename?: string;
    }) => void;
    /** @deprecated host-injected alias; prefer __previewTelemetry */
    __lovableEvents?: PreviewTelemetry;
    /** @deprecated host-injected alias; prefer __reportRuntimeError */
    __lovableReportRuntimeError?: (payload: {
      message: string;
      stack?: string;
      filename?: string;
    }) => void;
  }
}

/** Report a caught error to optional host telemetry without leaking motion data. */
export function reportRuntimeError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;

  const capture =
    window.__previewTelemetry?.captureException ?? window.__lovableEvents?.captureException;
  capture?.(
    error,
    {
      source: "react_error_boundary",
      route: window.location.pathname,
      ...context,
    },
    {
      mechanism: "react_error_boundary",
      handled: false,
      severity: "error",
    },
  );

  const message =
    error instanceof Response
      ? `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`
      : error instanceof Error
        ? error.message
        : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  const report = window.__reportRuntimeError ?? window.__lovableReportRuntimeError;
  report?.({
    message,
    ...(stack !== undefined && { stack }),
    filename: window.location.pathname,
  });
}
