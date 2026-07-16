import { useHolders, type Holder } from "@/hooks/useHolders";
import { formatToken, shortenAddress } from "@/lib/format";
import { chainMeta } from "@/config/chains";
import { ExternalLink, Users2 } from "lucide-react";

interface HolderTableProps {
  chainId: number;
  tokenAddress: string;
}

export function HolderTable({ chainId, tokenAddress }: HolderTableProps) {
  const { data, isLoading } = useHolders(chainId, tokenAddress);
  const meta = chainMeta[chainId];

  if (isLoading) {
    return (
      <div className="card p-4">
        <div className="h-8 w-32 animate-pulse rounded bg-neutral-800" />
      </div>
    );
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
          <thead className="sticky top-0 bg-neutral-900 text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2 text-left font-medium">#</th>
              <th className="px-4 py-2 text-left font-medium">Address</th>
              <th className="px-4 py-2 text-right font-medium">Balance</th>
              <th className="px-4 py-2 text-right font-medium">%</th>
              <th className="px-4 py-2 text-right font-medium">Type</th>
            </tr>
          </thead>
          <tbody>
            {data.map((h, i) => (
              <HolderRow key={h.address} holder={h} rank={i + 1} explorer={meta?.explorer ?? ""} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HolderRow({ holder, rank, explorer }: { holder: Holder; rank: number; explorer: string }) {
  return (
    <tr className="border-t border-neutral-800/50 hover:bg-neutral-900/50">
      <td className="px-4 py-2.5 text-neutral-500">{rank}</td>
      <td className="px-4 py-2.5">
        <a
          href={`${explorer}/address/${holder.address}`}
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
        <span className={holder.percentage > 10 ? "text-yellow-400" : "text-neutral-300"}>
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
