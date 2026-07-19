import { useWatchlist, useTokens } from "@/hooks/useTokens";
import { TokenCard } from "@/components/tokens/TokenCard";
import { TokenRow } from "@/components/tokens/TokenRow";
import { Star, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/feedback/Skeleton";
import { ErrorState } from "@/components/feedback/ErrorState";
import { ViewToggle } from "@/components/ui/ViewToggle";
import { Pagination } from "@/components/ui/Pagination";
import { useListPrefs } from "@/hooks/useListPrefs";
import { useSelectedChainId } from "@/stores/networkMode";
import { useEffect, useMemo, useState } from "react";

export function Watchlist() {
  const { data: watched } = useWatchlist();
  const selectedChainId = useSelectedChainId();
  const { data: tokens, isLoading, isError, error, refetch } = useTokens({ chainId: selectedChainId });
  const { view, setView, pageSize, setPageSize } = useListPrefs();
  const [page, setPage] = useState(1);

  const list = (tokens ?? []).filter((t) => (watched ?? []).includes(`${t.chainId}-${t.address}`));

  useEffect(() => {
    setPage(1);
  }, [pageSize, list.length]);

  const paged = useMemo(
    () => list.slice((page - 1) * pageSize, page * pageSize),
    [list, page, pageSize],
  );

  return (
    <div className="space-y-6 py-8 animate-fade-in-up">
      <div className="flex items-center gap-2">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/20">
          <Star className="h-5 w-5 text-amber-400" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold font-display">Watchlist</h1>
          <p className="text-xs text-neutral-500">
            {isLoading ? "Loading…" : `${list.length} token${list.length === 1 ? "" : "s"} starred`}
          </p>
        </div>
        {list.length > 0 && <ViewToggle value={view} onChange={setView} className="ml-auto" />}
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading watchlist">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
          <span className="sr-only">Loading watchlist…</span>
        </div>
      ) : isError ? (
        <ErrorState error={error} title="Couldn't load your watchlist" onRetry={() => refetch()} />
      ) : list.length === 0 ? (
        <div className="card p-12 text-center">
          <Star className="mx-auto mb-3 h-10 w-10 text-neutral-600" />
          <p className="text-sm text-neutral-400">No tokens in your watchlist yet.</p>
          <p className="mt-1 text-xs text-neutral-600">Tap the ★ on any token to add it.</p>
          <Link to="/" className="btn-primary mt-4 inline-flex">
            Explore Tokens <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : view === "list" ? (
        <>
          <div className="space-y-2">
            {paged.map((t, i) => (
              <div key={`${t.chainId}-${t.address}`} className="animate-fade-in-up" style={{ animationDelay: `${i * 30}ms` }}>
                <TokenRow token={t} defaultWatched />
              </div>
            ))}
          </div>
          <Pagination page={page} pageSize={pageSize} total={list.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {paged.map((t, i) => (
              <div key={`${t.chainId}-${t.address}`} className="animate-fade-in-up" style={{ animationDelay: `${i * 40}ms` }}>
                <TokenCard token={t} defaultWatched />
              </div>
            ))}
          </div>
          <Pagination page={page} pageSize={pageSize} total={list.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </>
      )}
    </div>
  );
}
