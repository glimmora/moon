import { useQuery } from "@tanstack/react-query";

export interface BackendHealth {
  status: "online" | "offline";
  latency?: number;
  checkedAt: number;
}

/**
 * Polls the backend health endpoint every 10 seconds.
 * Tries /api/health first, then /health as fallback.
 * Returns online/offline status + latency.
 */
export function useBackendHealth() {
  const query = useQuery({
    queryKey: ["backend-health"],
    queryFn: async (): Promise<BackendHealth> => {
      const BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
      const start = performance.now();
      try {
        // Try /api/health first, then /health
        let res: Response | null = null;
        try {
          res = await fetch(`${BASE}/api/health`, {
            signal: AbortSignal.timeout(5000),
          });
        } catch {
          // Fallback to /health
          res = await fetch(`${BASE}/health`, {
            signal: AbortSignal.timeout(5000),
          });
        }
        const latency = Math.round(performance.now() - start);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return { status: "online", latency, checkedAt: Date.now() };
      } catch {
        return { status: "offline", checkedAt: Date.now() };
      }
    },
    refetchInterval: 10_000,
    staleTime: 5_000,
    retry: false,
  });

  return {
    health: query.data ?? { status: "offline" as const, checkedAt: 0 },
    isOnline: query.data?.status === "online",
    isOffline: query.data?.status === "offline",
  };
}
