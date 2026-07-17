import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Link } from "react-router-dom";
import { Trophy, Users, Coins, Flame, Crown, Medal, ArrowUpRight, Loader2 } from "lucide-react";
import { formatUsd, shortenAddress, formatMarketCap, timeAgo } from "@/lib/format";
import { chainMeta } from "@/config/chains";
import { cn } from "@/lib/cn";
import { ErrorState } from "@/components/feedback/ErrorState";

type Tab = "traders" | "creators" | "tokens";

export function Leaderboard() {
  const [tab, setTab] = useState<Tab>("traders");
  const [tokenSort, setTokenSort] = useState<"volume" | "holders" | "marketcap">("volume");

  const traders = useQuery({
    queryKey: ["leaderboard", "traders"],
    queryFn: () => api.getTopTraders(50),
    refetchInterval: 60_000,
    enabled: tab === "traders",
  });

  const creators = useQuery({
    queryKey: ["leaderboard", "creators"],
    queryFn: () => api.getTopCreators(50),
    refetchInterval: 60_000,
    enabled: tab === "creators",
  });

  const tokens = useQuery({
    queryKey: ["leaderboard", "tokens", tokenSort],
    queryFn: () => api.getTopTokens(tokenSort, 50),
    refetchInterval: 60_000,
    enabled: tab === "tokens",
  });

  const tabs = [
    { key: "traders" as const, label: "Top Traders", icon: Trophy },
    { key: "creators" as const, label: "Top Creators", icon: Users },
    { key: "tokens" as const, label: "Top Tokens", icon: Coins },
  ];

  return (
    <div className="space-y-6 py-6 animate-fade-in-up">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-moon-gradient shadow-glow mb-3">
          <Trophy className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-3xl font-bold font-display">Leaderboard</h1>
        <p className="mt-2 text-neutral-400">The moon.fun hall of fame — top traders, creators, and tokens.</p>
      </div>

      {/* Tab switcher */}
      <div role="tablist" aria-label="Leaderboard category" className="flex gap-1 rounded-xl bg-white/[0.04] border border-white/[0.06] p-1 max-w-md mx-auto">
        {tabs.map((t) => {
          const active = tab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all",
                active ? "bg-white/[0.08] text-white shadow-inner-glow" : "text-neutral-400 hover:text-neutral-200",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.label.split(" ")[1]}</span>
            </button>
          );
        })}
      </div>

      {/* Traders */}
      {tab === "traders" && (
        <LeaderboardTable
          loading={traders.isLoading}
          isError={traders.isError}
          error={traders.error}
          onRetry={() => traders.refetch()}
          data={traders.data ?? []}
          columns={["Rank", "Trader", "Volume", "Trades"]}
          renderRow={(row) => (
            <TradersRow key={row.address} row={row} />
          )}
        />
      )}

      {/* Creators */}
      {tab === "creators" && (
        <LeaderboardTable
          loading={creators.isLoading}
          isError={creators.isError}
          error={creators.error}
          onRetry={() => creators.refetch()}
          data={creators.data ?? []}
          columns={["Rank", "Creator", "Tokens", "24h Volume", "Holders"]}
          renderRow={(row) => (
            <CreatorsRow key={row.address} row={row} />
          )}
        />
      )}

      {/* Tokens */}
      {tab === "tokens" && (
        <>
          <div role="tablist" aria-label="Sort tokens by" className="flex justify-center gap-1 rounded-xl bg-white/[0.04] border border-white/[0.06] p-1 max-w-sm mx-auto">
            {(["volume", "holders", "marketcap"] as const).map((s) => (
              <button
                key={s}
                role="tab"
                aria-selected={tokenSort === s}
                onClick={() => setTokenSort(s)}
                className={cn(
                  "flex-1 rounded-lg py-1.5 text-xs font-medium capitalize transition-all",
                  tokenSort === s ? "bg-moon-500/20 text-moon-300 shadow-glow" : "text-neutral-400 hover:text-neutral-200",
                )}
              >
                {s === "marketcap" ? "Mkt Cap" : s}
              </button>
            ))}
          </div>
          {tokens.isError ? (
            <ErrorState error={tokens.error} title="Couldn't load top tokens" onRetry={() => tokens.refetch()} />
          ) : tokens.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading tokens">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="shimmer h-40" />
              ))}
            </div>
          ) : (tokens.data ?? []).length === 0 ? (
            <div className="card p-12 text-center text-sm text-neutral-500">No tokens yet.</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(tokens.data ?? []).map((t) => (
                <TokenRankCard key={`${t.chainId}-${t.address}`} token={t} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LeaderboardTable<T>({
  loading,
  isError,
  error,
  onRetry,
  data,
  columns,
  renderRow,
}: {
  loading: boolean;
  isError?: boolean;
  error?: unknown;
  onRetry?: () => void;
  data: T[];
  columns: string[];
  renderRow: (row: T) => React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="card-elevated p-8 flex justify-center" role="status" aria-label="Loading leaderboard">
        <Loader2 className="h-6 w-6 animate-spin text-moon-400" />
      </div>
    );
  }
  if (isError) {
    return <ErrorState error={error} title="Couldn't load the leaderboard" onRetry={onRetry} />;
  }
  if (data.length === 0) {
    return <div className="card p-12 text-center text-sm text-neutral-500">No data yet.</div>;
  }
  return (
    <div className="card-elevated overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.02] text-xs text-neutral-500 uppercase tracking-wider">
            <tr>
              {columns.map((c, i) => (
                <th key={c} scope="col" className={cn("px-4 py-3 font-medium", i === 0 ? "text-left w-16" : i === 1 ? "text-left" : "text-right")}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {data.map((row) => renderRow(row))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-4 w-4 text-amber-400" />;
  if (rank === 2) return <Medal className="h-4 w-4 text-neutral-300" />;
  if (rank === 3) return <Medal className="h-4 w-4 text-orange-400" />;
  return <span className="tabular text-neutral-500">{rank}</span>;
}

function TradersRow({ row }: { row: { rank: number; address: string; volumeUsd: number; trades: number } }) {
  return (
    <tr className="hover:bg-white/[0.02] transition-colors">
      <td className="px-4 py-3"><div className="flex items-center gap-1.5"><RankBadge rank={row.rank} /></div></td>
      <td className="px-4 py-3">
        <Link to={`/portfolio/${row.address}`} className="font-mono text-moon-400 hover:underline">
          {shortenAddress(row.address, 6)}
        </Link>
      </td>
      <td className="px-4 py-3 text-right font-semibold tabular">{formatUsd(row.volumeUsd)}</td>
      <td className="px-4 py-3 text-right tabular text-neutral-400">{row.trades.toLocaleString()}</td>
    </tr>
  );
}

function CreatorsRow({ row }: { row: { rank: number; address: string; tokensCreated: number; totalVolume24h: number; totalHolders: number } }) {
  return (
    <tr className="hover:bg-white/[0.02] transition-colors">
      <td className="px-4 py-3"><RankBadge rank={row.rank} /></td>
      <td className="px-4 py-3">
        <Link to={`/portfolio/${row.address}`} className="font-mono text-moon-400 hover:underline">
          {shortenAddress(row.address, 6)}
        </Link>
      </td>
      <td className="px-4 py-3 text-right tabular">{row.tokensCreated}</td>
      <td className="px-4 py-3 text-right font-semibold tabular">{formatUsd(row.totalVolume24h)}</td>
      <td className="px-4 py-3 text-right tabular text-neutral-400">{row.totalHolders.toLocaleString()}</td>
    </tr>
  );
}

function TokenRankCard({ token }: { token: { rank: number; chainId: number; address: string; name: string; symbol: string; imageUrl: string; priceUsd: number; marketCapUsd: number; holderCount: number; volume24h: number; graduated: boolean; createdAt: number } }) {
  const meta = chainMeta[token.chainId];
  return (
    <Link
      to={`/token/${token.chainId}/${token.address}`}
      className="card-hover group relative block p-4 overflow-hidden"
    >
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <div className="absolute -top-1 -left-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-moon-gradient text-[10px] font-bold text-white shadow-glow">
            {token.rank}
          </div>
          <div className="h-12 w-12 overflow-hidden rounded-full border border-white/[0.08] bg-ink-900">
            {token.imageUrl ? (
              <img src={token.imageUrl} alt={token.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-gradient">
                {token.symbol.slice(0, 2)}
              </div>
            )}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="truncate font-semibold text-sm">{token.name}</h3>
            <span className="chip-neutral text-[10px]">${token.symbol}</span>
            {token.graduated && (
              <span className="chip-moon text-[10px]"><Flame className="h-2.5 w-2.5" /> Grad</span>
            )}
          </div>
          <p className="text-[10px] text-neutral-500 mt-0.5">
            {meta?.shortLabel} · {timeAgo(token.createdAt)}
          </p>
        </div>
        <ArrowUpRight className="h-3.5 w-3.5 text-neutral-600 group-hover:text-moon-300 transition-colors" />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <p className="text-neutral-500 text-[10px] uppercase">Price</p>
          <p className="font-semibold tabular">${token.priceUsd.toFixed(6)}</p>
        </div>
        <div>
          <p className="text-neutral-500 text-[10px] uppercase">Mkt Cap</p>
          <p className="font-semibold tabular">{formatMarketCap(token.marketCapUsd)}</p>
        </div>
        <div>
          <p className="text-neutral-500 text-[10px] uppercase">Holders</p>
          <p className="font-semibold tabular">{token.holderCount.toLocaleString()}</p>
        </div>
      </div>
    </Link>
  );
}
