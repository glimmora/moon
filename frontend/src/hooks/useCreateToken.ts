import { useCallback } from "react";
import { moonFactoryAbi } from "@/abi/MoonFactory";
import { getContracts } from "@/config/contracts";
import { useTxLifecycle } from "@/hooks/useTxLifecycle";

export interface CreateTokenForm {
  name: string;
  symbol: string;
  imageUrl: string;
  description: string;
  maxTxBps: number; // 0..500
  maxHoldBps: number; // 0..1000
  cooldownSeconds: number; // 0..3600
  supplyTier: 0 | 1 | 2; // 1B / 10B / 100B
  curveShape: 0 | 1 | 2; // LINEAR / EXPONENTIAL / LOGARITHMIC
}

const ZERO = "0x0000000000000000000000000000000000000000";

/** Client-side validation mirroring the contract's constraints. Returns null when valid. */
export function validateCreateForm(form: CreateTokenForm): string | null {
  if (!form.name.trim()) return "Token name is required.";
  if (form.name.length > 32) return "Token name must be 32 characters or fewer.";
  if (!form.symbol.trim()) return "Symbol is required.";
  if (form.symbol.length > 11) return "Symbol must be 11 characters or fewer.";
  if (form.maxTxBps < 0 || form.maxTxBps > 500) return "Max Tx must be between 0% and 5%.";
  if (form.maxHoldBps < 0 || form.maxHoldBps > 1000) return "Max Hold must be between 0% and 10%.";
  if (form.cooldownSeconds < 0 || form.cooldownSeconds > 3600) return "Cooldown must be between 0 and 3600 seconds.";
  return null;
}

/**
 * Launch a new token via the factory, powered by the shared transaction lifecycle
 * with a gas-limit fallback for wallets that cannot auto-estimate createToken.
 */
export function useCreateToken(chainId: number) {
  const contracts = getContracts(chainId);
  const tx = useTxLifecycle({
    chainId,
    confirmations: 1,
    invalidateKeys: [["tokens-v3"]],
    label: "Launch",
  });

  const create = useCallback(
    async (form: CreateTokenForm) => {
      if (!contracts?.factory || contracts.factory === ZERO) {
        throw new Error("Factory contract not found on this network.");
      }
      const createArgs = {
        name: form.name,
        symbol: form.symbol,
        imageUrl: form.imageUrl || "",
        description: form.description || "",
        maxTxBps: BigInt(form.maxTxBps),
        maxHoldBps: BigInt(form.maxHoldBps),
        cooldownSeconds: BigInt(form.cooldownSeconds),
        supplyTier: form.supplyTier,
        curveShape: form.curveShape,
      };
      return tx.execute({
        abi: moonFactoryAbi,
        address: contracts.factory,
        functionName: "createToken",
        args: [createArgs],
        gasFallback: 5_000_000n,
      });
    },
    [contracts, tx],
  );

  return {
    create,
    lifecycle: tx,
    pending: tx.isBusy,
    error: tx.error?.message ?? null,
    confirmed: tx.isSuccess,
    lastTxHash: tx.hash,
    clearError: tx.reset,
    reset: tx.reset,
  };
}
