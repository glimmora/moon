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
      <div className="card p-8 text-center text-sm text-neutral-500">
        <Users2 className="mx-auto mb-2 h-8 w-8 opacity-50" />
        No holders data yet.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-neutral-800 p-4">
        <h3 className="font-semibold">Top Holders</h3>
        <span className="text-xs text-neutral-500">{data.length} total</span>
      </div>
      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Top token holders with balance, share of supply, and account type</caption>
          <thead className="sticky top-0 bg-neutral-100 dark:bg-neutral-900 text-xs text-neutral-500">
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
  );
}

function HolderRow({ holder, rank, chainId }: { holder: Holder; rank: number; chainId: number }) {
  const isWhale = holder.percentage > 10;
  return (
    <tr className="border-t border-neutral-800/50 hover:bg-neutral-900/50">
      <td className="px-4 py-2.5 text-neutral-500 tabular">{rank}</td>
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
      <td className="px-4 py-2.5 text-right font-mono text-xs">{formatToken(BigInt(holder.balance))}</td>
      <td className="px-4 py-2.5 text-right">
        <span className={isWhale ? "inline-flex items-center gap-1 font-semibold text-amber-300" : "text-neutral-300"}>
          {isWhale && <span title="Whale — holds over 10% of supply" aria-label="Whale">🐋</span>}
          {holder.percentage.toFixed(2)}%
        </span>
      </td>
      <td className="px-4 py-2.5 text-right">
        <span className={holder.isContract ? "chip bg-blue-950/60 text-blue-300" : "chip bg-neutral-800 text-neutral-400"}>
          {holder.isContract ? "Contract" : "EOA"}
        </span>
      </td>
    </tr>
  );
}
