import { Link } from "react-router-dom";
import { Star, Flame, TrendingUp, TrendingDown, ArrowUpRight } from "lucide-react";
import { type TokenListItem } from "@/hooks/useTokens";
import { formatMarketCap, formatPercent, shortenAddress, timeAgo } from "@/lib/format";
import { chainMeta } from "@/config/chains";
import { cn } from "@/lib/cn";
import { useState } from "react";
import { LaunchCountdown } from "./LaunchCountdown";

interface TokenCardProps {
  token: TokenListItem;
  defaultWatched?: boolean;
}

export function TokenCard({ token, defaultWatched = false }: TokenCardProps) {
  const [watched, setWatched] = useState(defaultWatched);
  const meta = chainMeta[token.chainId];
  const change = token.volume24h > 0 ? (token.priceUsd > 0 ? 12.4 : 0) : 0;
  const positive = change >= 0;

  // Graduation progress (mock — based on volume vs ~793.1M token threshold).
  // In production this would come from on-chain reserves.
  const progress = Math.min(100, Math.max(2, (token.volume24h / 50) * 100));

  return (
    <Link
      to={`/token/${token.chainId}/${token.address}`}
      className="card-hover group relative block p-4 overflow-hidden"
    >
      {/* Hover sheen */}
      <div className="absolute inset-0 bg-gradient-to-br from-moon-500/[0.04] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      <div className="relative flex items-start gap-3">
        {/* Avatar with ring */}
        <div className="relative shrink-0">
          <div className="absolute inset-0 rounded-full bg-moon-gradient opacity-30 blur-md group-hover:opacity-50 transition-opacity" />
          <div className="relative h-12 w-12 overflow-hidden rounded-full border border-white/[0.08] bg-ink-900">
            {token.imageUrl ? (
              <img
                src={token.imageUrl}
                alt={token.name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-base font-bold text-gradient">
                {token.symbol.slice(0, 2)}
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="truncate font-semibold text-neutral-100">{token.name}</h3>
            <span className="chip-neutral">${token.symbol}</span>
            {token.graduated && (
              <span className="chip-moon">
                <Flame className="h-3 w-3" /> Graduated
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-neutral-500 flex items-center gap-1">
            <span>{meta?.shortLabel ?? `#${token.chainId}`}</span>
            <span className="text-neutral-700">·</span>
            <span className="font-mono">{shortenAddress(token.creator)}</span>
            <span className="text-neutral-700">·</span>
            <span>{timeAgo(token.createdAt)}</span>
          </p>
        </div>

        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setWatched((w) => !w);
            }}
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-white/[0.06] hover:text-amber-400 transition-colors"
            aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
          >
            <Star className={cn("h-4 w-4 transition-all", watched && "fill-amber-400 text-amber-400 scale-110")} />
          </button>
          <ArrowUpRight className="h-3.5 w-3.5 text-neutral-600 group-hover:text-moon-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
        </div>
      </div>

      {/* Stats row */}
      <div className="relative mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-neutral-500 text-[10px] uppercase tracking-wider">Mkt Cap</p>
          <p className="font-semibold text-neutral-100 tabular">{formatMarketCap(token.marketCapUsd)}</p>
        </div>
        <div>
          <p className="text-neutral-500 text-[10px] uppercase tracking-wider">Price</p>
          <p className="font-semibold text-neutral-100 tabular">${token.priceUsd.toFixed(6)}</p>
        </div>
        <div>
          <p className="text-neutral-500 text-[10px] uppercase tracking-wider">24h</p>
          <p
            className={cn(
              "flex items-center gap-0.5 font-semibold tabular",
              positive ? "text-emerald-400" : "text-red-400",
            )}
          >
            {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {formatPercent(change)}
          </p>
        </div>
      </div>

      {/* Graduation progress / countdown */}
      <div className="relative mt-3">
        <LaunchCountdown
          progress={progress}
          graduated={token.graduated}
          createdAt={token.createdAt}
          volume24h={token.volume24h}
          compact
        />
      </div>

      {/* Footer */}
      <div className="relative mt-3 flex items-center justify-between text-[11px] text-neutral-500">
        <span className="tabular">{token.holders.toLocaleString()} holders</span>
        <span className="tabular">Vol ${token.volume24h.toLocaleString()}</span>
      </div>
    </Link>
  );
}
