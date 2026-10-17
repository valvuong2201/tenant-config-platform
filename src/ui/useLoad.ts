"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Loads data when mounted (and again on `reload()`). State is only set from promise callbacks,
 * never synchronously in the effect. Pass a stable `fetcher` (useCallback) so it re-runs only when its inputs change.
 */
export function useLoad<T>(fetcher: () => Promise<T>) {
  const [state, setState] = useState<{ data: T | null; error: string | null }>({ data: null, error: null });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetcher().then(
      (data) => !cancelled && setState({ data, error: null }),
      (error: unknown) => !cancelled && setState((s) => ({ data: s.data, error: error instanceof Error ? error.message : "Request failed" })),
    );
    return () => {
      cancelled = true;
    };
  }, [fetcher, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback((data: T) => setState({ data, error: null }), []);
  return { data: state.data, error: state.error, reload, setData };
}
