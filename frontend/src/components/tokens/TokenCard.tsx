import { Link } from "react-router-dom";
import { Star, Flame, TrendingUp, TrendingDown } from "lucide-react";
import { type TokenListItem } from "@/hooks/useTokens";
import { formatMarketCap, formatPercent, shortenAddress, timeAgo } from "@/lib/format";
import { chainMeta } from "@/config/chains";
import { cn } from "@/lib/cn";
import { useState } from "react";

interface TokenCardProps {
  token: TokenListItem;
  defaultWatched?: boolean;
}

export function TokenCard({ token, defaultWatched = false }: TokenCardProps) {
  const [watched, setWatched] = useState(defaultWatched);
  const meta = chainMeta[token.chainId];
  const change = token.volume24h > 0 ? (token.priceUsd > 0 ? 12.4 : 0) : 0; // placeholder delta
  const positive = change >= 0;

  return (
    <Link
      to={`/token/${token.chainId}/${token.address}`}
      className="card group p-4 transition-colors hover:border-neutral-700 block"
    >
      <div className="flex items-start gap-3">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-neutral-800">
          {token.imageUrl ? (
            <img
              src={token.imageUrl}
              alt={token.name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg font-bold text-neutral-500">
              {token.symbol.slice(0, 2)}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-semibold text-neutral-100">{token.name}</h3>
            <span className="chip bg-neutral-800 text-neutral-400">${token.symbol}</span>
            {token.graduated && (
              <span className="chip bg-moon-600/20 text-moon-300">
                <Flame className="h-3 w-3" /> Graduated
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500">
            {meta?.shortLabel ?? `#${token.chainId}`} · {shortenAddress(token.creator)} ·{" "}
            {timeAgo(token.createdAt)}
          </p>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setWatched((w) => !w);
          }}
          className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-yellow-400"
          aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
        >
          <Star className={cn("h-4 w-4", watched && "fill-yellow-400 text-yellow-400")} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-neutral-500">Mkt Cap</p>
          <p className="font-semibold text-neutral-100">{formatMarketCap(token.marketCapUsd)}</p>
        </div>
        <div>
          <p className="text-neutral-500">Price</p>
          <p className="font-semibold text-neutral-100">${token.priceUsd.toFixed(6)}</p>
        </div>
        <div>
          <p className="text-neutral-500">24h</p>
          <p
            className={cn(
              "flex items-center gap-0.5 font-semibold",
              positive ? "text-green-400" : "text-red-400",
            )}
          >
            {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {formatPercent(change)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
        <span>{token.holders.toLocaleString()} holders</span>
        <span>Vol 24h: ${token.volume24h.toLocaleString()}</span>
      </div>
    </Link>
  );
}
