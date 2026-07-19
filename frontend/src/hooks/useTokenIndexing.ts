import { useCallback, useEffect, useState } from "react";
import { api, type TokenMeta } from "@/services/api";
import { fetchTokenMetaOnChain } from "@/services/onchain";

export type IndexingStatus = "idle" | "waiting" | "done" | "timeout";

export interface UseTokenIndexingOptions {
  chainId: number;
  /** Token address to poll for. Polling only runs when this is set + enabled. */
  address?: string | null;
  /** Gate polling on/off (e.g. only after a tx is confirmed). */
  enabled?: boolean;
  /** Poll cadence in ms (default 2000). */
  pollInterval?: number;
  /** Give up after this many ms (default 120000 — covers ~12 block confirmations). */
  timeout?: number;
}

export interface UseTokenIndexingResult {
  status: IndexingStatus;
  token: TokenMeta | null;
  attempts: number;
  /** Reset and resume polling (used by "Keep waiting" / "Retry" affordances). */
  retry: () => void;
}

/**
 * Poll the backend for a token that may not be indexed yet (freshly launched).
 *
 * The backend indexes TokenCreated events after a confirmation lag, so a token
 * can be confirmed on-chain but briefly absent from the API. This hook polls
 * `getTokenSafe` (which returns null on 404 rather than throwing) until the
 * token appears or the timeout elapses.
 *
 * If the backend is unavailable, falls back to on-chain reads so the modal can
 * transition to "done" as soon as the TokenCreated event is found on-chain.
 */
export function useTokenIndexing({
  chainId,
  address,
  enabled = true,
  pollInterval = 2000,
  timeout = 120_000,
}: UseTokenIndexingOptions): UseTokenIndexingResult {
  const [status, setStatus] = useState<IndexingStatus>("idle");
  const [token, setToken] = useState<TokenMeta | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [nonce, setNonce] = useState(0);

  const active = Boolean(enabled && address);

  const retry = useCallback(() => {
    setToken(null);
    setAttempts(0);
    setStatus("waiting");
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!active || !address) {
      setStatus("idle");
      return;
    }

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    const startedAt = Date.now();
    setStatus("waiting");

    const stop = () => {
      if (interval) clearInterval(interval);
      interval = undefined;
    };

    const poll = async () => {
      if (cancelled) return;
      setAttempts((n) => n + 1);

      // 1. Try backend first
      const found = await api.getTokenSafe(chainId, address);
      if (cancelled) return;
      if (found) {
        setToken(found);
        setStatus("done");
        stop();
        return;
      }

      // 2. Fall back to on-chain read (backend may be slow or unavailable)
      const onChain = await fetchTokenMetaOnChain(chainId, address);
      if (cancelled) return;
      if (onChain) {
        setToken(onChain);
        setStatus("done");
        stop();
        return;
      }

      if (Date.now() - startedAt > timeout) {
        setStatus("timeout");
        stop();
      }
    };

    void poll();
    interval = setInterval(() => void poll(), pollInterval);

    return () => {
      cancelled = true;
      stop();
    };
  }, [active, address, chainId, pollInterval, timeout, nonce]);

  return { status, token, attempts, retry };
}
