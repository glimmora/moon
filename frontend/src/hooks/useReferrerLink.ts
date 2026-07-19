import { useCallback, useMemo } from "react";
import { useAccount, useChainId, useReadContract } from "wagmi";
import { getAddress, isAddress, type Address } from "viem";
import { referralRegistryAbi } from "@/abi/ReferralRegistry";
import { getContracts } from "@/config/contracts";
import { useTxLifecycle } from "@/hooks/useTxLifecycle";
import { REFERRER_STORAGE_KEY } from "@/hooks/useReferrer";

const ZERO = "0x0000000000000000000000000000000000000000";

/** Read the pending referrer captured from a `?ref=` link (first-touch). */
function readStoredReferrer(): Address | undefined {
  try {
    const stored = localStorage.getItem(REFERRER_STORAGE_KEY);
    if (stored && isAddress(stored)) return getAddress(stored);
  } catch {
    /* ignore */
  }
  return undefined;
}

/**
 * Establish the permanent on-chain referral link. Reads the trader's current
 * on-chain referrer from `ReferralRegistry.referrerOf`; if unset and a pending
 * referrer was captured from a `?ref=` link, exposes `linkReferrer()` to call
 * `setReferrer` (a one-time, user-initiated transaction).
 */
export function useReferrerLink() {
  const { address } = useAccount();
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const registry = contracts?.referralRegistry;

  const pendingReferrer = useMemo(() => {
    const stored = readStoredReferrer();
    if (!stored || !address) return undefined;
    // Never self-refer.
    if (stored.toLowerCase() === address.toLowerCase()) return undefined;
    return stored;
  }, [address]);

  const { data: onChainReferrer, refetch } = useReadContract({
    abi: referralRegistryAbi,
    address: registry,
    functionName: "referrerOf",
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: Boolean(registry) && Boolean(address) },
  });

  const isLinked = Boolean(onChainReferrer && (onChainReferrer as string).toLowerCase() !== ZERO);

  const tx = useTxLifecycle({
    chainId,
    confirmations: 1,
    label: "Link referrer",
    invalidateKeys: [["referral-stats"]],
    onSuccess: () => {
      refetch();
    },
  });

  const linkReferrer = useCallback(async () => {
    if (!registry || !pendingReferrer || isLinked) return;
    return tx.execute({
      abi: referralRegistryAbi,
      address: registry,
      functionName: "setReferrer",
      args: [pendingReferrer],
    });
  }, [registry, pendingReferrer, isLinked, tx]);

  return {
    pendingReferrer,
    onChainReferrer: isLinked ? (onChainReferrer as Address) : undefined,
    isLinked,
    /** True when there's a pending referrer to link and none is set on-chain yet. */
    canLink: Boolean(registry && pendingReferrer && !isLinked),
    linkReferrer,
    lifecycle: tx,
    isLinking: tx.isBusy,
  };
}
