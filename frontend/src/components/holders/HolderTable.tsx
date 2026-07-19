import { useHolders, type Holder } from "@/hooks/useHolders";
import { formatToken, shortenAddress } from "@/lib/format";
import { addressUrl } from "@/lib/explorer";
import { ExternalLink, Users2 } from "lucide-react";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Skeleton } from "@/components/feedback/Skeleton";

interface HolderTableProps {
  chainId: number;
  tokenAddress: string;
}

export function HolderTable({ chainId, tokenAddress }: HolderTableProps) {
  const { data, isLoading, isError, error, refetch } = useHolders(chainId, tokenAddress);

  if (isLoading) {
    return (
      <div className="card p-4 space-y-2" role="status" aria-label="Loading holders">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
        <span className="sr-only">Loading holders…</span>
      </div>
    );
  }

  if (isError) {
    return <ErrorState error={error} title="Couldn't load holders" onRetry={() => refetch()} />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-[var(--text-muted)]">
        <Users2 className="mx-auto mb-2 h-8 w-8 opacity-50" />
        No holders data yet.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] p-4">
        <h3 className="font-semibold">Top Holders</h3>
        <span className="text-xs text-[var(--text-muted)]">{data.length} total</span>
      </div>
      <div className="max-h-96 overflow-y-auto">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <caption className="sr-only">Top token holders with balance, share of supply, and account type</caption>
            <thead className="sticky top-0 bg-[var(--bg-elev)] text-xs text-[var(--text-muted)]">
              <tr>
                <th scope="col" className="px-4 py-2 text-left font-medium">#</th>
                <th scope="col" className="px-4 py-2 text-left font-medium">Address</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Balance</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">%</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Type</th>
              </tr>
            </thead>
            <tbody>
              {data.map((h, i) => (
                <HolderRow key={h.address} holder={h} rank={i + 1} chainId={chainId} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function HolderRow({ holder, rank, chainId }: { holder: Holder; rank: number; chainId: number }) {
  const isWhale = holder.percentage > 10;
  return (
    <tr className="border-t border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]">
      <td className="px-4 py-2.5 text-[var(--text-muted)] tabular">{rank}</td>
      <td className="px-4 py-2.5">
        <a
          href={addressUrl(chainId, holder.address)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-mono text-xs text-moon-400 hover:underline"
        >
          {shortenAddress(holder.address)}
          <ExternalLink className="h-3 w-3" />
        </a>
      </td>
      <td className="px-4 py-2.5 text-right font-mono text-xs text-[var(--text-primary)]">{formatToken(BigInt(holder.balance))}</td>
      <td className="px-4 py-2.5 text-right">
        <span className={isWhale ? "inline-flex items-center gap-1 font-semibold text-amber-300" : "text-[var(--text-secondary)]"}>
          {isWhale && <span title="Whale — holds over 10% of supply" aria-label="Whale">🐋</span>}
          {holder.percentage.toFixed(2)}%
        </span>
      </td>
      <td className="px-4 py-2.5 text-right">
        <span className={holder.isContract ? "badge-blue" : "badge bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border-subtle)]"}>
          {holder.isContract ? "Contract" : "EOA"}
        </span>
      </td>
    </tr>
  );
}
