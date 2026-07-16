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

      // Build the args object — must match CreateParams struct on-chain.
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

      // Use a high gas limit to avoid estimation failures — the factory
      // createToken() does multiple external calls (clone + init + role grants)
      // which can confuse gas estimation in some wallets.
      const hash = await writeContractAsync({
        abi: moonFactoryAbi,
        address: contracts.factory,
        functionName: "createToken",
        args: [createArgs],
        chainId,
        gas: 5_000_000n, // 5M gas — well above the ~2.5M actual usage
      });
      setLastTxHash(hash);
    } catch (e) {
      const msg = parseContractError(e);
      // If the error mentions gasLimit or estimation, suggest manual gas.
      if (msg.includes("gasLimit") || msg.includes("gas") || msg.includes("destructure")) {
        setError("Gas estimation failed. Please try again — if the error persists, the factory may need ADMIN_ROLE on infra contracts. Run the post-deploy setup in DEPLOYMENT.md.");
      } else {
        setError(msg);
      }
    } finally {
      setPending(false);
    }
  }

  return { create, pending, error, confirmed, lastTxHash, clearError: () => setError(null) };
}
