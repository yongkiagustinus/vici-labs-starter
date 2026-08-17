"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

/**
 * Client analytics SDK.
 *
 * - Auto-captures `page_view` on navigation.
 * - Installs global handlers so unhandled errors / promise rejections are
 *   reported to /api/errors (error monitoring, client side).
 * - Exposes `useAnalytics().track(name, props)` for product events.
 *
 * All network calls are fire-and-forget with keepalive so they never block or
 * break the UI — the golden rule of instrumentation.
 */

interface AnalyticsApi {
  track: (name: string, props?: Record<string, unknown>) => void;
  captureError: (message: string, extra?: Record<string, unknown>) => void;
}

const AnalyticsContext = createContext<AnalyticsApi | null>(null);

function post(url: string, payload: unknown) {
  try {
    const body = JSON.stringify(payload);
    // navigator.sendBeacon survives page unload; fall back to fetch+keepalive.
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    // Never throw from instrumentation.
  }
}

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  const track = useCallback((name: string, props?: Record<string, unknown>) => {
    post("/api/track", { name, props: props ?? {} });
  }, []);

  const captureError = useCallback(
    (message: string, extra?: Record<string, unknown>) => {
      post("/api/errors", {
        message,
        source: "client",
        path: typeof location !== "undefined" ? location.pathname : undefined,
        context: extra ?? {},
      });
    },
    []
  );

  // Auto page_view on path change.
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    track("page_view", { path: pathname });
  }, [pathname, track]);

  // Global error + unhandled-rejection monitoring.
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      post("/api/errors", {
        message: e.message || "Unhandled error",
        stack: e.error?.stack ?? null,
        source: "client",
        path: location.pathname,
        context: {
          filename: e.filename,
          lineno: e.lineno,
          colno: e.colno,
          userAgent: navigator.userAgent,
        },
      });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      post("/api/errors", {
        message:
          (reason && (reason.message || String(reason))) ||
          "Unhandled promise rejection",
        stack: reason?.stack ?? null,
        source: "client",
        path: location.pathname,
        context: { kind: "unhandledrejection", userAgent: navigator.userAgent },
      });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return (
    <AnalyticsContext.Provider value={{ track, captureError }}>
      {children}
    </AnalyticsContext.Provider>
  );
}

/** Access the client analytics API. Safe no-op if used outside the provider. */
export function useAnalytics(): AnalyticsApi {
  const ctx = useContext(AnalyticsContext);
  if (ctx) return ctx;
  return { track: () => {}, captureError: () => {} };
}
