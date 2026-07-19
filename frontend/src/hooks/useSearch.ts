import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useBackendHealth } from "@/hooks/useBackendHealth";
import type { TokenListItem } from "@/hooks/useTokens";

/** Debounce a rapidly-changing value so we don't fire a request per keystroke. */
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Backend-backed token search with a debounce. Returns matching tokens from the
 * `/search` endpoint (which covers the whole index, not just the loaded page).
 * When the backend is offline or the query is too short, callers should fall
 * back to a client-side filter on the already-loaded token list.
 */
export function useSearch(query: string, delayMs = 300) {
  const debounced = useDebounced(query.trim(), delayMs);
  const { isOnline } = useBackendHealth();
  const enabled = isOnline && debounced.length >= 2;

  const result = useQuery<TokenListItem[]>({
    queryKey: ["search", debounced],
    queryFn: () => api.search(debounced),
    enabled,
    staleTime: 10_000,
    retry: 1,
  });

  return {
    results: result.data ?? [],
    isSearching: enabled && result.isFetching,
    isBackendSearch: enabled,
    error: result.error,
  };
}
