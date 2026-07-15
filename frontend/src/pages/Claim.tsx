import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Gift, Loader2 } from "lucide-react";
import { formatUsd, shortenAddress } from "@/lib/format";

export function Claim() {
  const { address } = useAccount();

  const { data, isLoading } = useQuery({
    queryKey: ["creator-fees", address],
    queryFn: () => (address ? api.getCreatorFees(address) : Promise.resolve([])),
    enabled: Boolean(address),
    refetchInterval: 20_000,
  });

  const total = (data ?? []).reduce((sum, r) => sum + Number(r.amount) / 1e18, 0);

  return (
    <div className="mx-auto max-w-2xl py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Gift className="h-6 w-6 text-moon-400" />
        <h1 className="text-2xl font-bold">Claim Creator Fees</h1>
      </div>

      {!address ? (
        <div className="card p-8 text-center text-sm text-neutral-500">
          Connect your wallet to view and claim your creator fee earnings.
        </div>
      ) : isLoading ? (
        <div className="card flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-moon-400" />
        </div>
      ) : (
        <>
          <div className="card p-6 text-center">
            <p className="text-xs text-neutral-500">Total Claimable</p>
            <p className="mt-1 text-3xl font-bold text-moon-400">{formatUsd(total)}</p>
            <p className="mt-1 text-xs text-neutral-600">Wallet: {shortenAddress(address)}</p>
            <button className="btn-primary mt-4 w-full" disabled={total === 0}>
              Claim All
            </button>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-neutral-800 p-4">
              <h3 className="font-semibold">Per Quote Asset</h3>
            </div>
            <div className="divide-y divide-neutral-800/50">
              {(data ?? []).map((row, i) => (
                <div key={i} className="flex items-center justify-between p-4 text-sm">
                  <span className="font-mono text-xs text-neutral-400">
                    {row.quoteAsset === "0x0000000000000000000000000000000000000000" ? "ETH" : shortenAddress(row.quoteAsset)}
                  </span>
                  <span className="font-semibold">{formatUsd(Number(row.amount) / 1e18)}</span>
                </div>
              ))}
              {(!data || data.length === 0) && (
                <div className="p-6 text-center text-sm text-neutral-500">No fees accrued yet.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
