import { useTokens } from "@/hooks/useTokens";
import { TokenCard } from "./TokenCard";
import { useNetworkMode } from "@/stores/networkMode";
import { useBackendHealth } from "@/hooks/useBackendHealth";
import { useMemo, useState } from "react";
import { Flame, Clock, TrendingUp, Crown, WifiOff, Rocket } from "lucide-react";
import { cn } from "@/lib/cn";
import { Link } from "react-router-dom";
import { formatMarketCap, shortenAddress } from "@/lib/format";
import { chainMeta } from "@/config/chains";

type Sort = "trending" | "new" | "graduated";

export function TokenFeed() {
  const { mode } = useNetworkMode();
  const { isOnline } = useBackendHealth();
  const [sort, setSort] = useState<Sort>("new");

  // useTokens now auto-falls back to on-chain reads if backend is offline
  const { data, isLoading, isError } = useTokens();

  const sorted = useMemo(() => {
    if (!data) return [];
    const list = [...data];
    if (sort === "new") list.sort((a, b) => b.createdAt - a.createdAt);
    else if (sort === "graduated") list.sort((a, b) => Number(b.graduated) - Number(a.graduated));
    else list.sort((a, b) => b.volume24h - a.volume24h);
    return list;
  }, [data, sort]);

  // Trending spotlight — top token
  const spotlight = useMemo(() => {
    if (!data || data.length === 0) return null;
    const trending = [...data].sort((a, b) => b.volume24h - a.volume24h);
    return trending[0];
  }, [data]);

  return (
    <section className="space-y-5">
      {/* Trending spotlight */}
      {spotlight && !isLoading && (
        <Link
          to={`/token/${spotlight.chainId}/${spotlight.address}`}
          className="card-hover group relative block overflow-hidden p-5 sm:p-6"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-moon-700/20 via-pink-600/10 to-transparent pointer-events-none" />
          <div className="absolute top-4 right-4 flex items-center gap-1.5 rounded-full bg-moon-500/20 border border-moon-500/30 px-3 py-1 text-xs font-medium text-moon-200 backdrop-blur-sm">
            <Crown className="h-3.5 w-3.5" />
            Trending #1
          </div>
          <div className="relative flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-2xl bg-moon-gradient opacity-40 blur-lg group-hover:opacity-60 transition-opacity" />
              <div className="relative h-16 w-16 sm:h-20 sm:w-20 overflow-hidden rounded-2xl border border-white/[0.1] bg-ink-900">
                {spotlight.imageUrl ? (
                  <img src={spotlight.imageUrl} alt={spotlight.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xl font-bold text-gradient">
                    {spotlight.symbol.slice(0, 2)}
                  </div>
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl sm:text-2xl font-bold font-display truncate">{spotlight.name}</h3>
                <span className="chip-neutral">${spotlight.symbol}</span>
                <span className="chip-neutral">{chainMeta[spotlight.chainId]?.shortLabel}</span>
              </div>
              <p className="mt-1 text-sm text-neutral-400">
                by <span className="font-mono">{shortenAddress(spotlight.creator)}</span> ·{" "}
                {spotlight.holderCount.toLocaleString()} holders
              </p>
              <div className="mt-2 flex items-center gap-4 text-sm">
                <div>
                  <span className="text-neutral-500 text-xs">Mkt Cap </span>
                  <span className="font-semibold tabular">{formatMarketCap(spotlight.marketCapUsd)}</span>
                </div>
                <div>
                  <span className="text-neutral-500 text-xs">Price </span>
                  <span className="font-semibold tabular">${spotlight.priceUsd.toFixed(6)}</span>
                </div>
                <div className="text-neutral-400 font-semibold flex items-center gap-0.5">
                  <span className="tabular text-xs">Vol ${spotlight.volume24h.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* Tabs + grid */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold font-display">
          {mode === "mainnet" ? "Live Tokens" : "Testnet Tokens"}
        </h2>
        <div className="flex gap-1 rounded-xl bg-white/[0.04] border border-white/[0.06] p-1">
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
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200",
                sort === tab.key
                  ? "bg-white/[0.08] text-white shadow-inner-glow"
                  : "text-neutral-400 hover:text-neutral-200",
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="shimmer h-52" />
          ))}
        </div>
      ) : isError ? (
        <div className="card p-12 text-center text-sm text-neutral-500">
          <WifiOff className="mx-auto mb-3 h-10 w-10 text-red-400/50" />
          <p className="font-medium text-neutral-400">
            {isOnline
              ? "Backend is online but returned an error."
              : "Backend is offline."}
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            {isOnline
              ? "Check backend logs: tail -f .dev-logs/backend.log"
              : "Start the backend: ./scripts/dev.sh backend"}
          </p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="card p-12 text-center">
          <Rocket className="mx-auto mb-3 h-10 w-10 text-moon-400/60" />
          <p className="text-sm text-neutral-400">No tokens yet. Be the first to launch one!</p>
          <Link to="/create" className="btn-primary mt-4 inline-flex">
            Launch Token
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((t, i) => (
            <div key={`${t.chainId}-${t.address}`} className="animate-fade-in-up" style={{ animationDelay: `${i * 40}ms` }}>
              <TokenCard token={t} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}


