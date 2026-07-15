import { useTokens } from "@/hooks/useTokens";
import { TokenCard } from "./TokenCard";
import { useNetworkMode } from "@/stores/networkMode";
import { useMemo, useState } from "react";
import { Flame, Clock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/cn";

type Sort = "trending" | "new" | "graduated";

export function TokenFeed() {
  const { mode } = useNetworkMode();
  const [sort, setSort] = useState<Sort>("trending");

  // Pass undefined to fetch across all active chains for the current mode.
  const { data, isLoading, isError } = useTokens();

  const sorted = useMemo(() => {
    if (!data) return [];
    const list = [...data];
    if (sort === "new") list.sort((a, b) => b.createdAt - a.createdAt);
    else if (sort === "graduated") list.sort((a, b) => Number(b.graduated) - Number(a.graduated));
    else list.sort((a, b) => b.volume24h - a.volume24h);
    return list;
  }, [data, sort]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {mode === "mainnet" ? "Live Tokens" : "Testnet Tokens"}
        </h2>
        <div className="flex gap-1 rounded-lg bg-neutral-900 p-1">
          {(
            [
              { key: "trending" as const, label: "Trending", icon: TrendingUp },
              { key: "new" as const, label: "New", icon: Clock },
              { key: "graduated" as const, label: "Graduated", icon: Flame },
            ]
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSort(tab.key)}
              className={cn(
                "flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                sort === tab.key ? "bg-neutral-700 text-white" : "text-neutral-400 hover:text-neutral-100",
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card h-44 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="card p-8 text-center text-sm text-neutral-500">
          Failed to load tokens. The backend may not be running.
        </div>
      ) : sorted.length === 0 ? (
        <div className="card p-8 text-center text-sm text-neutral-500">
          No tokens yet. Be the first to launch one!
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((t) => (
            <TokenCard key={`${t.chainId}-${t.address}`} token={t} />
          ))}
        </div>
      )}
    </section>
  );
}
