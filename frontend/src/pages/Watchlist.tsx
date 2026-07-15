import { useWatchlist, useTokens } from "@/hooks/useTokens";
import { TokenCard } from "@/components/tokens/TokenCard";
import { Star } from "lucide-react";

export function Watchlist() {
  const { data: watched } = useWatchlist();
  const { data: tokens } = useTokens();

  const list = (tokens ?? []).filter((t) => (watched ?? []).includes(`${t.chainId}-${t.address}`));

  return (
    <div className="space-y-4 py-6">
      <div className="flex items-center gap-2">
        <Star className="h-5 w-5 text-yellow-400" />
        <h1 className="text-xl font-bold">Watchlist</h1>
      </div>

      {list.length === 0 ? (
        <div className="card p-8 text-center text-sm text-neutral-500">
          No tokens in your watchlist yet. Tap the ★ on any token to add it.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((t) => (
            <TokenCard key={`${t.chainId}-${t.address}`} token={t} defaultWatched />
          ))}
        </div>
      )}
    </div>
  );
}
