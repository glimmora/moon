import { Link } from "react-router-dom";
import { Star, Flame, ArrowUpRight } from "lucide-react";
import { type TokenListItem } from "@/hooks/useTokens";
import { formatMarketCap, shortenAddress, timeAgo, graduationProgress } from "@/lib/format";
import { chainMeta } from "@/config/chains";
import { cn } from "@/lib/cn";
import { useState, memo } from "react";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { toggleWatchlist } from "@/hooks/useTokens";
import { useToast } from "@/stores/toast";
import { LaunchCountdown } from "./LaunchCountdown";

interface TokenCardProps {
  token: TokenListItem;
  defaultWatched?: boolean;
}

function tokenCardAreEqual(prev: TokenCardProps, next: TokenCardProps) {
  return (
    prev.token.address === next.token.address &&
    prev.token.chainId === next.token.chainId &&
    prev.token.priceUsd === next.token.priceUsd &&
    prev.token.volume24h === next.token.volume24h &&
    prev.token.holderCount === next.token.holderCount &&
    prev.token.marketCapUsd === next.token.marketCapUsd &&
    prev.token.graduated === next.token.graduated &&
    prev.defaultWatched === next.defaultWatched
  );
}

export const TokenCard = memo(function TokenCard({ token, defaultWatched = false }: TokenCardProps) {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [watched, setWatched] = useState(defaultWatched);
  const watchId = `${token.chainId}-${token.address}`;
  const meta = chainMeta[token.chainId];

  // Graduation progress based on volume vs tier-specific threshold.
  const progress = graduationProgress(token.volume24h, token.supplyTier);

  function handleToggleWatch(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Result-aware: reflect what actually got persisted, and surface failures
    // (e.g. Safari private mode blocking localStorage) instead of silently lying.
    try {
      const next = toggleWatchlist(watchId, address);
      const nowWatched = next.includes(watchId);
      setWatched(nowWatched);
      queryClient.invalidateQueries({ queryKey: ["watchlist", address] });
      toast.success(nowWatched ? `Added ${token.symbol} to watchlist` : `Removed ${token.symbol} from watchlist`);
    } catch {
      toast.error("Couldn't update your watchlist", {
        description: "Your browser may be blocking local storage.",
      });
    }
  }

  return (
    <div className="card-hover group relative p-4 overflow-hidden">
      {/* Stretched navigation link — covers the whole card without wrapping the
          interactive star button (avoids nested interactive elements). */}
      <Link
        to={`/token/${token.chainId}/${token.address}`}
        className="absolute inset-0 z-0"
        aria-label={`${token.name} (${token.symbol}) details`}
      />

      {/* Hover sheen */}
      <div className="absolute inset-0 bg-gradient-to-br from-moon-500/[0.04] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      <div className="relative z-10 pointer-events-none flex items-start gap-3">
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
            onClick={handleToggleWatch}
            aria-pressed={watched}
            className="pointer-events-auto rounded-lg p-1.5 text-neutral-500 hover:bg-white/[0.06] hover:text-amber-400 transition-colors"
            aria-label={watched ? `Remove ${token.symbol} from watchlist` : `Add ${token.symbol} to watchlist`}
          >
            <Star className={cn("h-4 w-4 transition-all", watched && "fill-amber-400 text-amber-400 scale-110")} />
          </button>
          <ArrowUpRight className="h-3.5 w-3.5 text-neutral-600 group-hover:text-moon-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
        </div>
      </div>

      {/* Stats row */}
      <div className="relative z-10 pointer-events-none mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-neutral-500 text-[10px] uppercase tracking-wider">Mkt Cap</p>
          <p className="font-semibold text-neutral-100 tabular">{formatMarketCap(token.marketCapUsd)}</p>
        </div>
        <div>
          <p className="text-neutral-500 text-[10px] uppercase tracking-wider">Price</p>
          <p className="font-semibold text-neutral-100 tabular">${token.priceUsd.toFixed(6)}</p>
        </div>
        <div>
          <p className="text-neutral-500 text-[10px] uppercase tracking-wider">24h Vol</p>
          <p className="font-semibold text-neutral-100 tabular">{formatMarketCap(token.volume24h)}</p>
        </div>
      </div>

      {/* Graduation progress / countdown */}
      <div className="relative z-10 pointer-events-none mt-3">
        <LaunchCountdown
          progress={progress}
          graduated={token.graduated}
          createdAt={token.createdAt}
          volume24h={token.volume24h}
          supplyTier={token.supplyTier}
          compact
        />
      </div>

      {/* Footer */}
      <div className="relative z-10 pointer-events-none mt-3 flex items-center justify-between text-[11px] text-neutral-500">
        <span className="tabular">{token.holderCount.toLocaleString()} holders</span>
        <span className="tabular">{timeAgo(token.createdAt)}</span>
      </div>
    </div>
  );
}, tokenCardAreEqual);
