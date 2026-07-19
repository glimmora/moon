import { Link } from "react-router-dom";
import { Star, Flame } from "lucide-react";
import { type TokenListItem } from "@/hooks/useTokens";
import { formatMarketCap, shortenAddress, timeAgo, formatPriceUsd } from "@/lib/format";
import { chainMeta } from "@/config/chains";
import { cn } from "@/lib/cn";
import { useState, memo } from "react";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { toggleWatchlist } from "@/hooks/useTokens";
import { useToast } from "@/stores/toast";
import { useTheme } from "@/stores/theme";
import { Avatar } from "@/components/ui/Avatar";

interface TokenRowProps {
  token: TokenListItem;
  defaultWatched?: boolean;
}

function areEqual(prev: TokenRowProps, next: TokenRowProps) {
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

export const TokenRow = memo(function TokenRow({ token, defaultWatched = false }: TokenRowProps) {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { theme } = useTheme();
  const isLight = theme === "light";
  const [watched, setWatched] = useState(defaultWatched);
  const watchId = `${token.chainId}-${token.address}`;
  const meta = chainMeta[token.chainId];

  function handleToggleWatch(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
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
    <div className="card-hover group relative grid grid-cols-[auto_1fr_auto] items-center gap-3 p-3 overflow-hidden">
      <Link
        to={`/token/${token.chainId}/${token.address}`}
        className="absolute inset-0 z-0"
        aria-label={`${token.name} (${token.symbol}) details`}
      />

      {/* Avatar */}
      <div className="relative z-10 pointer-events-none shrink-0">
        <Avatar
          src={token.imageUrl}
          alt={token.name}
          size={40}
          shape="circle"
          className={cn(isLight ? "border-neutral-200" : "border-white/[0.08]")}
        />
      </div>

      {/* Name + meta */}
      <div className="relative z-10 pointer-events-none min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className={cn("truncate font-semibold text-sm", isLight ? "text-neutral-900" : "text-neutral-100")}>
            {token.name}
          </h3>
          <span className="chip-neutral shrink-0">${token.symbol}</span>
          {token.graduated && (
            <span className="chip-moon shrink-0">
              <Flame className="h-3 w-3" /> Grad
            </span>
          )}
        </div>
        <p className={cn("mt-0.5 text-[11px] flex items-center gap-1 min-w-0", isLight ? "text-neutral-500" : "text-neutral-500")}>
          <span className="shrink-0">{meta?.shortLabel ?? `#${token.chainId}`}</span>
          <span className={isLight ? "text-neutral-300" : "text-neutral-700"}>·</span>
          <span className="font-mono truncate">{shortenAddress(token.creator)}</span>
          <span className={cn("shrink-0", isLight ? "text-neutral-300" : "text-neutral-700")}>·</span>
          <span className="shrink-0">{timeAgo(token.createdAt)}</span>
        </p>
      </div>

      {/* Stats + actions */}
      <div className="relative z-10 flex items-center gap-3 sm:gap-5 shrink-0">
        <div className="hidden sm:block text-right">
          <p className="text-neutral-500 text-[10px] uppercase tracking-wider">Mkt Cap</p>
          <p className={cn("font-semibold tabular text-xs", isLight ? "text-neutral-900" : "text-neutral-100")}>
            {formatMarketCap(token.marketCapUsd)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-neutral-500 text-[10px] uppercase tracking-wider">Price</p>
          <p className={cn("font-semibold tabular text-xs", isLight ? "text-neutral-900" : "text-neutral-100")}>
            {formatPriceUsd(token.priceUsd)}
          </p>
        </div>
        <div className="hidden md:block text-right">
          <p className="text-neutral-500 text-[10px] uppercase tracking-wider">24h Vol</p>
          <p className={cn("font-semibold tabular text-xs", isLight ? "text-neutral-900" : "text-neutral-100")}>
            {formatMarketCap(token.volume24h)}
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggleWatch}
          aria-pressed={watched}
          className={cn(
            "pointer-events-auto rounded-lg p-1.5 transition-colors shrink-0",
            isLight ? "text-neutral-400 hover:bg-neutral-200 hover:text-amber-500" : "text-neutral-500 hover:bg-white/[0.06] hover:text-amber-400",
          )}
          aria-label={watched ? `Remove ${token.symbol} from watchlist` : `Add ${token.symbol} to watchlist`}
        >
          <Star className={cn("h-4 w-4 transition-all", watched && "fill-amber-400 text-amber-400 scale-110")} />
        </button>
      </div>
    </div>
  );
}, areEqual);
