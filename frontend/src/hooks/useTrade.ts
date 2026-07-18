import { useCallback } from "react";
import { parseEther, type Address } from "viem";
import { bondingCurveAbi } from "@/abi/BondingCurve";
import { useTxLifecycle } from "@/hooks/useTxLifecycle";

export interface UseTradeArgs {
  chainId: number;
  curveAddress: Address;
}

export type TradeSide = "buy" | "sell";

const ZERO = "0x0000000000000000000000000000000000000000" as const;

const TRADE_INVALIDATE = [
  ["token-meta"],
  ["holders"],
  ["bubblemap"],
  ["tokens-v3"],
  ["price-history"],
] as const;

/**
 * Buy/sell against a bonding curve, powered by the shared transaction lifecycle
 * (chain-switch -> estimate -> sign -> confirm) with toast + query invalidation.
 * Exposes the full lifecycle object plus the legacy fields TradePanel relies on.
 */
export function useTrade({ chainId, curveAddress }: UseTradeArgs) {
  const tx = useTxLifecycle({
    chainId,
    confirmations: 1,
    invalidateKeys: TRADE_INVALIDATE,
    label: "Trade",
  });

  const buy = useCallback(
    async (quoteAmountIn: string, minTokensOut: bigint, referrer?: Address) => {
      const trimmed = quoteAmountIn.trim();
      if (!trimmed || !/^\d*\.?\d+$/.test(trimmed)) {
        throw new Error("Invalid amount format. Enter a number (e.g. 0.1).");
      }
      let value: bigint;
      try {
        value = parseEther(trimmed);
      } catch {
        throw new Error("Amount is too small or invalid.");
      }
      if (value <= 0n) throw new Error("Amount must be greater than 0.");
      return tx.execute({
        abi: bondingCurveAbi,
        address: curveAddress,
        functionName: "buy",
        args: [value, minTokensOut, referrer ?? ZERO],
        value,
      });
    },
    [curveAddress, tx],
  );

  const sell = useCallback(
    async (tokenAmountIn: bigint, minQuoteOut: bigint, referrer?: Address) => {
      if (tokenAmountIn <= 0n) throw new Error("Amount must be greater than 0.");
      return tx.execute({
        abi: bondingCurveAbi,
        address: curveAddress,
        functionName: "sell",
        args: [tokenAmountIn, minQuoteOut, referrer ?? ZERO],
      });
    },
    [curveAddress, tx],
  );

  return {
    buy,
    sell,
    // Full lifecycle surface for TxProgress rendering.
    lifecycle: tx,
    // Legacy-compatible fields.
    pending: tx.isBusy,
    error: tx.error?.message ?? null,
    confirmed: tx.isSuccess,
    lastTxHash: tx.hash,
    clearError: tx.reset,
  };
}
