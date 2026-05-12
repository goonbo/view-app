"use client";

import * as React from "react";

type Options<T> = {
  intervalMs?: number;
  /** Initial data — skip the first fetch if provided. */
  initial?: T;
  /** Pause polling (e.g., when tab hidden). Default: true. */
  pauseWhenHidden?: boolean;
};

export type LiveDataState<T> = {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  /** Increments each time a poll completes. UI can use this to flash changes. */
  tick: number;
  refetch: () => Promise<void>;
};

/**
 * Polls `fetcher` on a fixed interval. Used pervasively across the
 * bidirectional surfaces (campaign progress, shared event notes, the
 * workbench feed) — anywhere we'd otherwise need WebSockets.
 *
 * Default interval is 2000ms per <build_phases> Phase 5 "Real-time
 * updates via 2-second polling" guidance.
 */
export function useLiveData<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: Options<T> = {},
): LiveDataState<T> {
  const { intervalMs = 2000, initial, pauseWhenHidden = true } = options;
  const [data, setData] = React.useState<T | undefined>(initial);
  const [loading, setLoading] = React.useState<boolean>(initial === undefined);
  const [error, setError] = React.useState<Error | null>(null);
  const [tick, setTick] = React.useState(0);

  // Keep fetcher in a ref but update via effect (not during render) so the
  // poll loop always calls the most recent closure without re-running the
  // effect on every parent render.
  const fetcherRef = React.useRef(fetcher);
  React.useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const refetch = React.useCallback(async () => {
    try {
      const next = await fetcherRef.current();
      setData(next);
      setError(null);
      setTick((t) => t + 1);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const hadInitial = React.useRef(initial !== undefined);

  React.useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const isVisible = () =>
      !pauseWhenHidden || document.visibilityState === "visible";

    const tickFn = async () => {
      if (cancelled) return;
      if (isVisible()) await refetch();
      if (cancelled) return;
      timer = window.setTimeout(tickFn, intervalMs);
    };

    if (!hadInitial.current) {
      void refetch().then(() => {
        if (!cancelled) timer = window.setTimeout(tickFn, intervalMs);
      });
    } else {
      timer = window.setTimeout(tickFn, intervalMs);
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    if (pauseWhenHidden) document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      if (pauseWhenHidden) document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [key, intervalMs, pauseWhenHidden, refetch]);

  return { data, loading, error, tick, refetch };
}
