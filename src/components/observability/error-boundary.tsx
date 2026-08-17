"use client";

import { Component, type ReactNode } from "react";

/**
 * React error boundary that reports render-time exceptions to /api/errors and
 * shows a graceful fallback. Wrap route segments or risky widgets with it.
 *
 * Pairs with the global handlers in <AnalyticsProvider> (which catch errors
 * outside React's render path).
 */

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}
interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    try {
      const body = JSON.stringify({
        message: error.message,
        stack: error.stack ?? null,
        source: "react-error-boundary",
        path: typeof location !== "undefined" ? location.pathname : undefined,
        context: { componentStack: info.componentStack },
      });
      void fetch("/api/errors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
      });
    } catch {
      // swallow — reporting must not throw
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div role="alert" style={{ padding: 24 }}>
            <h2>Something went wrong.</h2>
            <p>The error was reported. Try refreshing the page.</p>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
