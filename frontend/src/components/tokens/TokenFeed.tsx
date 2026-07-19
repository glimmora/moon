import { useTokens } from "@/hooks/useTokens";
import { TokenCard } from "./TokenCard";
import { TokenRow } from "./TokenRow";
import { useNetworkMode } from "@/stores/networkMode";
import { useBackendHealth } from "@/hooks/useBackendHealth";
import { useEffect, useMemo, useState } from "react";
import { Flame, Clock, TrendingUp, Crown, WifiOff, Rocket } from "lucide-react";
import { cn } from "@/lib/cn";
import { Link } from "react-router-dom";
import { formatMarketCap, shortenAddress, formatPriceUsd } from "@/lib/format";
import { chainMeta } from "@/config/chains";
import { useTheme } from "@/stores/theme";
import { Avatar } from "@/components/ui/Avatar";
import { Tabs } from "@/components/ui/Tabs";
import { ViewToggle } from "@/components/ui/ViewToggle";
import { Pagination } from "@/components/ui/Pagination";
import { useListPrefs } from "@/hooks/useListPrefs";

type Sort = "trending" | "new" | "graduated";

const feedTabs = [
  { key: "trending" as const, label: <span className="hidden sm:inline">Trending</span>, icon: TrendingUp },
  { key: "new" as const, label: <span className="hidden sm:inline">New</span>, icon: Clock },
  { key: "graduated" as const, label: <span className="hidden sm:inline">Graduated</span>, icon: Flame },
];

export function TokenFeed() {
  const { mode } = useNetworkMode();
  const { isOnline } = useBackendHealth();
  const { theme } = useTheme();
  const isLight = theme === "light";
  const [sort, setSort] = useState<Sort>("new");
  const { view, setView, pageSize, setPageSize } = useListPrefs();
  const [page, setPage] = useState(1);

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

  useEffect(() => {
    setPage(1);
  }, [sort, pageSize]);

  const paged = useMemo(
    () => sorted.slice((page - 1) * pageSize, page * pageSize),
    [sorted, page, pageSize],
  );

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
               <Avatar
                 src={spotlight.imageUrl}
                 alt={spotlight.name}
                 size={80}
                 className={cn(isLight ? "border-neutral-200" : "border-white/[0.1]")}
               />
             </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl sm:text-2xl font-bold font-display truncate">{spotlight.name}</h3>
                <span className="chip-neutral">${spotlight.symbol}</span>
                <span className="chip-neutral">{chainMeta[spotlight.chainId]?.shortLabel}</span>
              </div>
               <p className={cn("mt-1 text-sm", isLight ? "text-neutral-500" : "text-neutral-400")}>
                 by <span className="font-mono">{shortenAddress(spotlight.creator)}</span> ·{" "}
                 {spotlight.holderCount.toLocaleString()} holders
               </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                 <div>
                   <span className="text-neutral-500 text-xs">Mkt Cap </span>
                   <span className={cn("font-semibold tabular", isLight ? "text-neutral-900" : "text-neutral-100")}>{formatMarketCap(spotlight.marketCapUsd)}</span>
                 </div>
                 <div>
                   <span className="text-neutral-500 text-xs">Price </span>
                   <span className={cn("font-semibold tabular", isLight ? "text-neutral-900" : "text-neutral-100")}>{formatPriceUsd(spotlight.priceUsd)}</span>
                 </div>
                 <div className={cn("font-semibold flex items-center gap-0.5", isLight ? "text-neutral-600" : "text-neutral-400")}>
                   <span className="tabular text-xs">Vol ${spotlight.volume24h.toLocaleString()}</span>
                 </div>
               </div>
            </div>
          </div>
        </Link>
      )}

      {/* Tabs + grid */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold font-display">
          {mode === "mainnet" ? "Live Tokens" : "Testnet Tokens"}
        </h2>
        <div className="flex items-center gap-2">
          <ViewToggle value={view} onChange={setView} />
          <Tabs tabs={feedTabs} value={sort} onChange={(k) => setSort(k as Sort)} ariaLabel="Sort tokens" />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: Math.min(pageSize, 6) }).map((_, i) => (
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
      ) : view === "list" ? (
        <>
          <div className="space-y-2">
            {paged.map((t, i) => (
              <div key={`${t.chainId}-${t.address}`} className="animate-fade-in-up" style={{ animationDelay: `${i * 30}ms` }}>
                <TokenRow token={t} />
              </div>
            ))}
          </div>
          <Pagination page={page} pageSize={pageSize} total={sorted.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {paged.map((t, i) => (
              <div key={`${t.chainId}-${t.address}`} className="animate-fade-in-up" style={{ animationDelay: `${i * 40}ms` }}>
                <TokenCard token={t} />
              </div>
            ))}
          </div>
          <Pagination page={page} pageSize={pageSize} total={sorted.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </>
      )}
    </section>
  );
}


