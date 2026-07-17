import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Gift, Loader2, Wallet, ArrowDownToLine } from "lucide-react";
import { formatUsd, shortenAddress } from "@/lib/format";
import { getContracts } from "@/config/contracts";
import { creatorFeeVaultAbi } from "@/abi/CreatorFeeVault";
import { useToast } from "@/stores/toast";
import { useTxLifecycle } from "@/hooks/useTxLifecycle";
import { TxProgress } from "@/components/tx/TxProgress";
import { chainMeta } from "@/config/chains";

const ZERO = "0x0000000000000000000000000000000000000000";

export function Claim() {
  const { address, chainId } = useAccount();
  const toast = useToast();

  const claimTx = useTxLifecycle({
    chainId: chainId ?? 0,
    confirmations: 1,
    invalidateKeys: [["creator-fees", address]],
    label: "Claim",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["creator-fees", address],
    queryFn: () => (address ? api.getCreatorFees(address) : Promise.resolve([])),
    enabled: Boolean(address),
    refetchInterval: 20_000,
  });

  const claiming = claimTx.isBusy;
  const total = (data ?? []).reduce((sum, r) => sum + Number(r.amount) / 1e18, 0);

  async function claimAll() {
    if (!address || !chainId) return;
    const contracts = getContracts(chainId);
    if (!contracts?.creatorFeeVault || contracts.creatorFeeVault === ZERO) {
      toast.error("Creator fee vault is not configured on this network.");
      return;
    }
    await claimTx.execute({
      abi: creatorFeeVaultAbi,
      address: contracts.creatorFeeVault as `0x${string}`,
      functionName: "claimAllFees",
      args: [],
    });
  }

  return (
    <div className="mx-auto max-w-3xl py-8 space-y-6 animate-fade-in-up">
      <div className="text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-moon-gradient shadow-glow mb-3">
          <Gift className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-3xl font-bold font-display">Creator Fees</h1>
        <p className="mt-2 text-neutral-400">Claim your 20% share of trade fees from tokens you launched.</p>
      </div>

      {!address ? (
        <div className="card p-12 text-center">
          <Wallet className="mx-auto mb-3 h-10 w-10 text-neutral-600" />
          <p className="text-sm text-neutral-500">Connect your wallet to view and claim your creator fee earnings.</p>
        </div>
      ) : isLoading ? (
        <div className="card flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-moon-400" />
        </div>
      ) : (
        <>
          {/* Total card */}
          <div className="card-elevated p-8 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-moon-700/10 via-transparent to-transparent pointer-events-none" />
            <div className="relative">
              <p className="text-xs uppercase tracking-wider text-neutral-500">Total Claimable</p>
              <p className="mt-2 text-5xl font-bold text-gradient tabular">{formatUsd(total)}</p>
              <p className="mt-2 text-xs text-neutral-600 font-mono">{shortenAddress(address)}</p>
              <button className="btn-primary mt-6 w-full sm:w-auto !px-8" disabled={total === 0 || claiming} onClick={claimAll}>
                {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}
                {claiming ? "Claiming…" : "Claim All"}
              </button>
              {chainId && (
                <div className="mt-4 text-left">
                  <TxProgress
                    stage={claimTx.stage}
                    chainId={chainId}
                    confirmations={claimTx.confirmations}
                    confirmationCount={claimTx.confirmationCount}
                    explorerUrl={claimTx.explorerUrl}
                    gasEstimate={claimTx.gasEstimate}
                    nativeSymbol={chainMeta[chainId]?.nativeSymbol ?? "ETH"}
                    error={claimTx.error}
                    onRetry={claimTx.retry}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Per asset breakdown */}
          <div className="card overflow-hidden">
            <div className="border-b border-white/[0.06] p-4">
              <h3 className="font-semibold">Per Quote Asset</h3>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {(data ?? []).map((row, i) => (
                <div key={i} className="flex items-center justify-between p-4 text-sm hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-xs font-bold">
                      {row.quoteAsset === "0x0000000000000000000000000000000000000000" ? "ETH" : "ERC"}
                    </div>
                    <span className="font-mono text-xs text-neutral-400">
                      {row.quoteAsset === "0x0000000000000000000000000000000000000000" ? "Native" : shortenAddress(row.quoteAsset)}
                    </span>
                  </div>
                  <span className="font-semibold tabular">{formatUsd(Number(row.amount) / 1e18)}</span>
                </div>
              ))}
              {(!data || data.length === 0) && (
                <div className="p-8 text-center text-sm text-neutral-500">No fees accrued yet.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
