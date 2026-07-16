import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, useChainId } from "wagmi";
import { moonFactoryAbi } from "@/abi/MoonFactory";
import { getContracts } from "@/config/contracts";
import { parseContractError } from "@/lib/error";

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

export function useCreateToken(chainId: number) {
  const { address } = useAccount();
  const activeChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const contracts = getContracts(chainId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<`0x${string}` | null>(null);

  const { writeContractAsync } = useWriteContract();

  const { isSuccess: confirmed } = useWaitForTransactionReceipt({
    hash: lastTxHash ?? undefined,
    chainId,
    query: { enabled: Boolean(lastTxHash) },
  });

  async function create(form: CreateTokenForm) {
    if (!address) {
      setError("Connect wallet first.");
      return;
    }
    if (!contracts?.factory || contracts.factory === "0x0000000000000000000000000000000000000000") {
      setError("Factory not configured for this chain.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      // Auto-switch chain if wallet is on a different chain
      if (activeChainId !== chainId) {
        try {
          await switchChainAsync({ chainId });
        } catch (switchErr) {
          setError(`Please switch your wallet to the target network. ${switchErr instanceof Error ? switchErr.message : ""}`);
          setPending(false);
          return;
        }
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

      // Step 1: Try wagmi's auto gas estimation (no gas param = auto-estimate)
      try {
        const hash = await writeContractAsync({
          abi: moonFactoryAbi,
          address: contracts.factory,
          functionName: "createToken",
          args: [createArgs],
          chainId,
          // No gas param → wagmi auto-estimates via eth_estimateGas
        });
        setLastTxHash(hash);
        return;
      } catch (estErr) {
        const estMsg = parseContractError(estErr);
        // If it's a user rejection or a real contract revert, don't retry
        if (/reject|denied|cancel/i.test(estMsg) || /EmptyName|EmptySymbol|InvalidMaxTx|InvalidMaxHold|InvalidCooldown|InvalidSupplyTier|InvalidCurveShape/.test(estMsg)) {
          throw estErr;
        }
        // If gas estimation failed (null/destructure error), retry with explicit gas
        // This happens with some wallets that can't estimate multi-call factory functions
      }

      // Step 2: Fallback — send with explicit high gas limit
      const hash = await writeContractAsync({
        abi: moonFactoryAbi,
        address: contracts.factory,
        functionName: "createToken",
        args: [createArgs],
        chainId,
        gas: 5_000_000n, // fallback: 5M gas (actual usage ~2.5M)
      });
      setLastTxHash(hash);
    } catch (e) {
      setError(parseContractError(e));
    } finally {
      setPending(false);
    }
  }

  return { create, pending, error, confirmed, lastTxHash, clearError: () => setError(null) };
}
