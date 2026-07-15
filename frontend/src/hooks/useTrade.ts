import { useState } from "react";
import { useAccount, useSimulateContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, type Address } from "viem";
import { bondingCurveAbi } from "@/abi/BondingCurve";
import { parseContractError } from "@/lib/error";

export interface UseTradeArgs {
  chainId: number;
  curveAddress: Address;
}

export type TradeSide = "buy" | "sell";

export function useTrade({ chainId, curveAddress }: UseTradeArgs) {
  const { address } = useAccount();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<`0x${string}` | null>(null);

  const { writeContractAsync } = useWriteContract();

  const { isSuccess: confirmed } = useWaitForTransactionReceipt({
    hash: lastTxHash ?? undefined,
    chainId,
    query: { enabled: Boolean(lastTxHash) },
  });

  async function buy(quoteAmountIn: string, minTokensOut: bigint, referrer?: Address) {
    if (!address) {
      setError("Connect wallet first.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const value = parseEther(quoteAmountIn);
      const hash = await writeContractAsync({
        abi: bondingCurveAbi,
        address: curveAddress,
        functionName: "buy",
        args: [value, minTokensOut, referrer ?? "0x0000000000000000000000000000000000000000"],
        value,
        chainId,
      });
      setLastTxHash(hash);
    } catch (e) {
      setError(parseContractError(e));
    } finally {
      setPending(false);
    }
  }

  async function sell(tokenAmountIn: bigint, minQuoteOut: bigint) {
    if (!address) {
      setError("Connect wallet first.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const hash = await writeContractAsync({
        abi: bondingCurveAbi,
        address: curveAddress,
        functionName: "sell",
        args: [tokenAmountIn, minQuoteOut],
        chainId,
      });
      setLastTxHash(hash);
    } catch (e) {
      setError(parseContractError(e));
    } finally {
      setPending(false);
    }
  }

  return { buy, sell, pending, error, confirmed, lastTxHash, clearError: () => setError(null) };
}
