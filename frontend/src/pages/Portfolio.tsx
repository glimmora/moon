import { useAccount } from "wagmi";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Link } from "react-router-dom";
import { isAddress } from "viem";
import {
  Wallet,
  TrendingUp,
  Coins,
  Flame,
  ArrowDownToLine,
  ArrowUpFromLine,
  ExternalLink,
  Rocket,
  Activity,
  AlertCircle,
} from "lucide-react";
import { formatUsd, shortenAddress, formatToken, timeAgo, formatMarketCap, formatPriceUsd, formatPercent } from "@/lib/format";
import { chainMeta } from "@/config/chains";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/Avatar";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Skeleton } from "@/components/feedback/Skeleton";
import { useT } from "@/stores/i18n";

export function Portfolio() {
  const t = useT();
  const params = useParams<{ address: string }>();
  const { address: walletAddress } = useAccount();
  const address = params.address ? params.address.toLowerCase() : walletAddress;

  // Validate explicit address parameter.
  const invalidAddress = Boolean(params.address && address && !isAddress(address));

  const [showAllPositions, setShowAllPositions] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["portfolio", address],
    queryFn: () => (address ? api.getPortfolio(address) : Promise.resolve(null)),
    enabled: Boolean(address),
    refetchInterval: 30_000,
  });

  if (!address) {
    return (
      <div className="py-16 text-center animate-fade-in-up">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-moon-500/15 border border-moon-500/20 mb-4">
          <Wallet className="h-8 w-8 text-moon-400" />
        </div>
        <h1 className="text-3xl font-bold font-display">Your Portfolio</h1>
        <p className="mt-2 text-neutral-400">Connect your wallet to view positions, P&L, and trade history.</p>
      </div>
    );
  }

  if (invalidAddress) {
    return (
      <div className="py-16 text-center animate-fade-in-up">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 mb-4">
          <AlertCircle className="h-8 w-8 text-red-400" />
        </div>
        <h1 className="text-3xl font-bold font-display">Invalid Address</h1>
        <p className="mt-2 text-neutral-400">The address you entered is not a valid Ethereum address.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 py-6" role="status" aria-label="Loading portfolio">
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-80 lg:col-span-2" />
          <Skeleton className="h-80" />
        </div>
        <span className="sr-only">Loading portfolio…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-16">
        <ErrorState error={error} title="Couldn't load this portfolio" onRetry={() => refetch()} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-16 text-center animate-fade-in-up">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-moon-500/15 border border-moon-500/20 mb-4">
          <Wallet className="h-8 w-8 text-moon-400" />
        </div>
        <h1 className="text-3xl font-bold font-display">Your Portfolio</h1>
        <p className="mt-2 text-neutral-400">No portfolio data found. Try a different address.</p>
      </div>
    );
  }

  const totalValue = data.totalValueUsd;
  const unrealizedPnl = data.totalUnrealizedPnlUsd ?? 0;
  const unrealizedPnlPct = data.totalUnrealizedPnlPct ?? 0;
  const realizedPnl = data.totalRealizedPnlUsd ?? 0;
  const recentTrades = data.recentTrades.slice(0, 10);

  return (
    <div className="space-y-6 py-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-moon-500/15 border border-moon-500/20">
          <Wallet className="h-5 w-5 text-moon-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display">{t("portfolio.title")}</h1>
          <p className="text-xs text-neutral-500 font-mono">{shortenAddress(address)}</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Wallet}
          label={t("portfolio.value")}
          value={formatUsd(totalValue)}
          accent="purple"
          gradient
        />
        <StatCard
          icon={TrendingUp}
          label={t("portfolio.unrealizedPnl")}
          value={`${unrealizedPnl >= 0 ? "+" : "-"}${formatUsd(Math.abs(unrealizedPnl))}`}
          sub={`${formatPercent(unrealizedPnlPct)} · realized ${realizedPnl >= 0 ? "+" : "-"}${formatUsd(Math.abs(realizedPnl))}`}
          accent={unrealizedPnl >= 0 ? "green" : "amber"}
        />
        <StatCard
          icon={Activity}
          label={t("portfolio.totalTrades")}
          value={data.tradeCount.toLocaleString()}
          accent="amber"
        />
        <StatCard
          icon={Coins}
          label={t("portfolio.tokensCreated")}
          value={data.createdCount.toLocaleString()}
          sub={`${data.graduatedCount} graduated`}
          accent="green"
        />
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Positions */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold font-display">{t("portfolio.topPositions")}</h2>
            <span className="text-xs text-neutral-500">{data.positions.length} total</span>
          </div>
{data.positions.length === 0 ? (
            <div className="card p-8 text-center text-sm text-[var(--text-muted)]">
              No active positions. <Link to="/" className="text-moon-400 hover:underline">Start trading →</Link>
            </div>
          ) : (
                    <div className="card-elevated overflow-hidden">
                      <div className="divide-y divide-[var(--border-subtle)]">
                        {(showAllPositions ? data.positions : data.positions.slice(0, 10)).map((p) => {
                          const meta = chainMeta[p.chainId];
                          return (
                            <Link
                              key={`${p.chainId}-${p.tokenAddress}`}
                              to={`/token/${p.chainId}/${p.tokenAddress}`}
                              className="grid grid-cols-[auto_1fr_auto] items-center gap-3 p-4 hover:bg-[var(--surface-2)] transition-colors group overflow-hidden"
                            >
                              <Avatar src={p.imageUrl} alt={p.name} size={40} shape="circle" className="border-[var(--border-subtle)]" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-sm truncate min-w-0">{p.name}</span>
                                  <span className="chip-neutral text-[10px] shrink-0">{meta?.shortLabel}</span>
                                  {p.graduated && <span className="chip-moon text-[10px] shrink-0"><Flame className="h-2.5 w-2.5" /> Grad</span>}
                                </div>
                                <p className="text-xs text-[var(--text-muted)] tabular truncate">
                                  {formatToken(BigInt(p.balance))} {p.symbol} · {formatPriceUsd(p.priceUsd)}
                                </p>
                              </div>
                              <div className="text-right overflow-hidden">
                                <p className="font-semibold tabular text-sm truncate">{formatUsd(p.valueUsd)}</p>
                                {p.costBasisUsd > 0 ? (
                                  <p className={cn(
                                    "text-[10px] tabular truncate",
                                    p.unrealizedPnlUsd >= 0 ? "text-emerald-400" : "text-rose-400",
                                  )}>
                                    {p.unrealizedPnlUsd >= 0 ? "+" : "-"}{formatUsd(Math.abs(p.unrealizedPnlUsd))} ({formatPercent(p.unrealizedPnlPct)})
                                  </p>
                                ) : (
                                  <p className="text-[10px] text-[var(--text-muted)] tabular truncate">{p.percentage.toFixed(2)}% supply</p>
                                )}
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                      {data.positions.length > 10 && (
                        <button
                          onClick={() => setShowAllPositions((v) => !v)}
                          className="w-full border-t border-[var(--border-subtle)] py-2.5 text-xs font-medium text-moon-300 hover:bg-[var(--surface-2)] transition-colors"
                        >
                          {showAllPositions ? "Show less" : `Show all ${data.positions.length} positions`}
                        </button>
                      )}
                    </div>
                  )}

          {/* Recent trades */}
          <div className="flex items-center justify-between mt-6">
            <h2 className="text-lg font-semibold font-display">Recent Trades</h2>
            <span className="text-xs text-neutral-500">{data.tradeCount} total</span>
          </div>
          {recentTrades.length === 0 ? (
            <div className="card p-8 text-center text-sm text-neutral-500">No trades yet.</div>
          ) : (
<div className="card-elevated overflow-hidden">
              <div className="divide-y divide-[var(--border-subtle)]">
                {recentTrades.map((t, i) => {
                  const nativeSym = chainMeta[t.chainId]?.nativeSymbol ?? "ETH";
                  return (
                    <div key={`${t.txHash}-${i}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 p-3 hover:bg-[var(--surface-2)] transition-colors overflow-hidden">
                      <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg",
                        t.side === "buy" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400",
                      )}>
                        {t.side === "buy" ? <ArrowDownToLine className="h-4 w-4" /> : <ArrowUpFromLine className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <Link
                          to={`/token/${t.chainId}/${t.tokenAddress}`}
                          className="text-sm font-medium hover:text-moon-300 transition-colors truncate block"
                        >
                          {t.tokenName} <span className="text-[var(--text-muted)]">${t.tokenSymbol}</span>
                        </Link>
                        <p className="text-[10px] text-[var(--text-muted)] truncate">{timeAgo(t.timestamp)}</p>
                      </div>
                      <div className="text-right overflow-hidden">
                        <p className="text-xs font-medium tabular truncate">
                          {Number(t.quoteAmount) / 1e18 < 0.001
                            ? `${(Number(t.quoteAmount) / 1e18).toExponential(2)} ${nativeSym}`
                            : `${(Number(t.quoteAmount) / 1e18).toFixed(4)} ${nativeSym}`}
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)] tabular truncate">@ {formatPriceUsd(t.priceUsd)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Created tokens */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold font-display">Created Tokens</h2>
            <Link to="/create" className="btn-ghost text-xs !py-1 !px-2.5">
              <Rocket className="h-3 w-3" /> New
            </Link>
          </div>
          {data.createdTokens.length === 0 ? (
            <div className="card p-6 text-center text-xs text-[var(--text-muted)]">
              <Rocket className="mx-auto mb-2 h-8 w-8 opacity-30" />
              Haven't launched a token yet.
            </div>
          ) : (
            <div className="space-y-2">
              {data.createdTokens.slice(0, 8).map((t) => (
                <Link
                  key={`${t.chainId}-${t.address}`}
                  to={`/token/${t.chainId}/${t.address}`}
                  className="card-hover group block p-3"
                >
                  <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 overflow-hidden">
                    <Avatar src={t.imageUrl} alt={t.name} size={36} shape="circle" className="border-[var(--border-subtle)]" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium truncate min-w-0">{t.name}</span>
                        {t.graduated && <Flame className="h-3 w-3 text-moon-400 shrink-0" />}
                      </div>
                      <p className="text-[10px] text-[var(--text-muted)] tabular truncate">
                        Mkt {formatMarketCap(t.marketCapUsd)} · {t.holderCount} holders
                      </p>
                    </div>
                    <ExternalLink className="h-3 w-3 text-[var(--text-muted)] group-hover:text-moon-300 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  gradient,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  sub?: string;
  accent: "purple" | "cyan" | "amber" | "green";
  gradient?: boolean;
}) {
  const accentMap = {
    purple: "text-moon-300 bg-moon-500/15 border-moon-500/20",
    cyan: "text-cyan-300 bg-cyan-500/15 border-cyan-500/20",
    amber: "text-amber-300 bg-amber-500/15 border-amber-500/20",
    green: "text-emerald-300 bg-emerald-500/15 border-emerald-500/20",
  };
  return (
    <div className="card p-5 relative overflow-hidden">
      <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-gradient-to-br from-white/[0.04] to-transparent opacity-50" />
      <div className="relative">
        <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${accentMap[accent]} mb-3`}>
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-xs uppercase tracking-wider text-neutral-500">{label}</p>
        <p className={cn("mt-1 text-2xl font-bold tabular truncate", gradient && "text-gradient")}>{value}</p>
        {sub && <p className="mt-0.5 text-[10px] text-neutral-500">{sub}</p>}
      </div>
    </div>
  );
}
