import { useCallback, useEffect, useRef, useState } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { formatEther, type Abi } from "viem";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/stores/toast";
import { explainError } from "@/lib/txErrors";
import { txUrl, explorerName } from "@/lib/explorer";

/** Stages of a blockchain write, surfaced to the UI for real-time feedback. */
export type TxStage =
  | "idle"
  | "switching-chain"
  | "estimating"
  | "awaiting-signature"
  | "broadcasting"
  | "pending"
  | "success"
  | "error";

export interface TxWriteParams {
  abi: Abi;
  address: `0x${string}`;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
  /** Explicit gas limit. If omitted, the wallet auto-estimates. */
  gas?: bigint;
  /**
   * Fallback gas limit retried once if the initial (auto-estimated) write fails
   * with a non-revert, non-rejection error. Useful for multi-call functions some
   * wallets cannot estimate (e.g. the factory's createToken).
   */
  gasFallback?: bigint;
}

export interface UseTxLifecycleOptions {
  chainId: number;
  /** How many confirmations to wait for before declaring success. */
  confirmations?: number;
  /** react-query keys to invalidate on success (plus wagmi read caches). */
  invalidateKeys?: readonly (readonly unknown[])[];
  /** Human label used in toasts, e.g. "Buy", "Launch", "Claim". */
  label?: string;
  /** Fired once the tx reaches the requested confirmation count. */
  onSuccess?: (hash: `0x${string}`) => void;
}

const WAGMI_READ_KEYS: readonly (readonly unknown[])[] = [
  ["readContract"],
  ["readContracts"],
  ["balance"],
];

/**
 * Centralized transaction lifecycle: chain-switch -> gas estimate -> signature ->
 * broadcast -> pending (confirmations) -> success/error. Drives a loading->result
 * toast (with explorer link + retry action), exposes granular stage/estimate/error
 * for inline steppers, and invalidates the relevant caches on success.
 */
export function useTxLifecycle(opts: UseTxLifecycleOptions) {
  const { chainId, confirmations = 1, invalidateKeys = [], label = "Transaction", onSuccess } = opts;
  const { address } = useAccount();
  const activeChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient({ chainId });
  const queryClient = useQueryClient();
  const toast = useToast();
  const { writeContractAsync } = useWriteContract();

  const [stage, setStage] = useState<TxStage>("idle");
  const [error, setError] = useState<ReturnType<typeof explainError> | null>(null);
  const [hash, setHash] = useState<`0x${string}` | null>(null);
  const [gasEstimate, setGasEstimate] = useState<{ gas: bigint; feeEth: string } | null>(null);

  const toastIdRef = useRef<number | null>(null);
  const lastParamsRef = useRef<TxWriteParams | null>(null);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const receipt = useWaitForTransactionReceipt({
    hash: hash ?? undefined,
    chainId,
    confirmations,
    query: { enabled: Boolean(hash) },
  });

  const explorerUrl = hash ? txUrl(chainId, hash) : undefined;

  // React to receipt resolution: success or on-chain revert.
  useEffect(() => {
    if (!hash) return;
    if (receipt.isSuccess) {
      setStage("success");
      // Refresh on-chain reads + caller-supplied backend queries.
      for (const key of [...WAGMI_READ_KEYS, ...invalidateKeys]) {
        queryClient.invalidateQueries({ queryKey: key });
      }
      if (toastIdRef.current !== null) {
        toast.update(toastIdRef.current, {
          type: "success",
          title: `${label} confirmed`,
          description: "Your transaction is confirmed on-chain.",
          action: explorerUrl
            ? { label: `View on ${explorerName(chainId)}`, onClick: () => true, href: explorerUrl }
            : undefined,
        });
      }
      onSuccessRef.current?.(hash);
    } else if (receipt.isError) {
      const ex = explainError(receipt.error);
      setStage("error");
      setError(ex);
      if (toastIdRef.current !== null) {
        toast.update(toastIdRef.current, {
          type: "error",
          title: `${label} failed`,
          description: ex.message,
          action: explorerUrl
            ? { label: `View on ${explorerName(chainId)}`, onClick: () => true, href: explorerUrl }
            : undefined,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.isSuccess, receipt.isError, hash]);

  const reset = useCallback(() => {
    setStage("idle");
    setError(null);
    setHash(null);
    setGasEstimate(null);
    toastIdRef.current = null;
  }, []);

  /** Estimate gas for a prospective write (best-effort; never throws). */
  const estimate = useCallback(
    async (params: TxWriteParams): Promise<{ gas: bigint; feeEth: string } | null> => {
      if (!publicClient || !address) return null;
      try {
        const gas = await publicClient.estimateContractGas({
          abi: params.abi,
          address: params.address,
          functionName: params.functionName,
          args: params.args as never,
          value: params.value,
          account: address,
        });
        const gasPrice = await publicClient.getGasPrice().catch(() => 0n);
        const feeWei = gas * gasPrice;
        const est = { gas, feeEth: formatEther(feeWei) };
        setGasEstimate(est);
        return est;
      } catch {
        return null;
      }
    },
    [publicClient, address],
  );

  /** Full lifecycle execution for a contract write. Returns the tx hash or null. */
  const execute = useCallback(
    async (params: TxWriteParams): Promise<`0x${string}` | null> => {
      lastParamsRef.current = params;
      setError(null);
      setHash(null);

      if (!address) {
        const ex = explainError(new Error("Connect your wallet to continue."));
        setStage("error");
        setError({ ...ex, title: "Wallet not connected", message: "Connect your wallet to continue.", recovery: "Click Connect Wallet." });
        return null;
      }

      const toastId = toast.loading(`${label} in progress`, { description: "Preparing transaction…" });
      toastIdRef.current = toastId;

      try {
        // 1. Ensure the wallet is on the right chain.
        if (activeChainId !== chainId) {
          setStage("switching-chain");
          toast.update(toastId, { description: "Switch to the correct network in your wallet…" });
          await switchChainAsync({ chainId });
        }

        // 2. Best-effort gas estimate (informational).
        setStage("estimating");
        toast.update(toastId, { description: "Estimating gas…" });
        await estimate(params).catch(() => null);

        // 3. Request signature (with optional gas-limit fallback for wallets that
        // cannot auto-estimate multi-call functions).
        setStage("awaiting-signature");
        toast.update(toastId, { description: "Confirm the transaction in your wallet…" });
        let txHash: `0x${string}`;
        try {
          txHash = await writeContractAsync({
            abi: params.abi,
            address: params.address,
            functionName: params.functionName,
            args: params.args as never,
            value: params.value,
            gas: params.gas,
            chainId,
          });
        } catch (signErr) {
          const ex = explainError(signErr);
          // Don't retry on user rejection or a genuine contract revert — only on
          // opaque estimation/RPC failures where an explicit gas limit may help.
          const isRevert = ["contract-revert", "slippage", "limits", "cooldown", "graduated"].includes(ex.kind);
          if (params.gasFallback === undefined || ex.kind === "rejected" || isRevert) {
            throw signErr;
          }
          txHash = await writeContractAsync({
            abi: params.abi,
            address: params.address,
            functionName: params.functionName,
            args: params.args as never,
            value: params.value,
            gas: params.gasFallback,
            chainId,
          });
        }

        // 4. Broadcast + pending.
        setHash(txHash);
        setStage("pending");
        const url = txUrl(chainId, txHash);
        toast.update(toastId, {
          description: `Broadcasting — waiting for ${confirmations} confirmation${confirmations > 1 ? "s" : ""}…`,
          action: url ? { label: `View on ${explorerName(chainId)}`, onClick: () => true, href: url } : undefined,
        });
        return txHash;
      } catch (e) {
        const ex = explainError(e);
        setStage("error");
        setError(ex);
        toast.update(toastId, {
          type: "error",
          title: `${label} failed`,
          description: ex.recovery ? `${ex.message} ${ex.recovery}` : ex.message,
        });
        return null;
      }
    },
    [address, activeChainId, chainId, confirmations, estimate, label, switchChainAsync, toast, writeContractAsync],
  );

  /** Retry the last attempted write. */
  const retry = useCallback(async () => {
    if (lastParamsRef.current) return execute(lastParamsRef.current);
    return null;
  }, [execute]);

  const isBusy = stage !== "idle" && stage !== "success" && stage !== "error";

  return {
    execute,
    estimate,
    retry,
    reset,
    stage,
    isBusy,
    error,
    hash,
    explorerUrl,
    gasEstimate,
    confirmations,
    /** Live confirmation count once mined (0 while pending). */
    confirmationCount: receipt.data ? confirmations : 0,
    isSuccess: stage === "success",
    isError: stage === "error",
  };
}
