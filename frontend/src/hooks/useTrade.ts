import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, useChainId } from "wagmi";
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
  const activeChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<`0x${string}` | null>(null);

  const { writeContractAsync } = useWriteContract();

  const { isSuccess: confirmed } = useWaitForTransactionReceipt({
    hash: lastTxHash ?? undefined,
    chainId,
    query: { enabled: Boolean(lastTxHash) },
  });

  /** Auto-switch the wallet to the target chain if mismatched. */
  async function ensureChain(): Promise<boolean> {
    if (activeChainId === chainId) return true;
    try {
      await switchChainAsync({ chainId });
      return true;
    } catch (e) {
      setError(`Please switch your wallet to the target network. ${e instanceof Error ? e.message : ""}`);
      return false;
    }
  }

  async function buy(quoteAmountIn: string, minTokensOut: bigint, referrer?: Address) {
    if (!address) {
      setError("Connect wallet first.");
      return;
    }
    // AUDIT-FIX I-2: Validate the input before calling parseEther.
    const trimmed = quoteAmountIn.trim();
    if (!trimmed || !/^\d*\.?\d+$/.test(trimmed)) {
      setError("Enter a valid amount.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const value = parseEther(trimmed);
      if (value <= 0n) {
        setError("Amount must be greater than 0.");
        setPending(false);
        return;
      }
      // Auto-switch chain if needed
      if (!(await ensureChain())) {
        setPending(false);
        return;
      }
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

  // AUDIT-FIX H-1/M-2: sell() now accepts referrer parameter
  async function sell(tokenAmountIn: bigint, minQuoteOut: bigint, referrer?: Address) {
    if (!address) {
      setError("Connect wallet first.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      // Auto-switch chain if needed
      if (!(await ensureChain())) {
        setPending(false);
        return;
      }
      const hash = await writeContractAsync({
        abi: bondingCurveAbi,
        address: curveAddress,
        functionName: "sell",
        args: [tokenAmountIn, minQuoteOut, referrer ?? "0x0000000000000000000000000000000000000000"],
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
