import { useEffect, useRef } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { useNetworkMode } from "@/stores/networkMode";
import { useToast } from "@/stores/toast";
import { chainById, TESTNET_CHAIN_IDS, MAINNET_CHAIN_IDS } from "@/config/chains";

/**
 * Watches wallet connection, chain changes, and network mode changes.
 * Fires toast notifications on:
 *   - Wallet connect / disconnect
 *   - Chain change (e.g. user switches in wallet)
 *   - Network mode toggle (mainnet <-> testnet)
 *   - Wrong chain detection + auto-prompt to switch
 */
export function useWalletEvents() {
  const { address, isConnected, isReconnecting } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { mode } = useNetworkMode();
  const toast = useToast();

  // Track previous values to detect changes (not first-render)
  const prevAddress = useRef<string | undefined>(undefined);
  const prevChainId = useRef<number | undefined>(undefined);
  const prevMode = useRef(mode);
  const prevConnected = useRef(false);

  // Wallet connect / disconnect events
  useEffect(() => {
    if (isReconnecting) return;

    // Connect
    if (!prevConnected.current && isConnected && address) {
      toast.success("Wallet connected", `${address.slice(0, 6)}…${address.slice(-4)}`);
    }
    // Disconnect
    if (prevConnected.current && !isConnected) {
      toast.info("Wallet disconnected");
    }
    // Account changed (same connection, different address)
    if (
      prevConnected.current &&
      isConnected &&
      prevAddress.current &&
      address &&
      prevAddress.current.toLowerCase() !== address.toLowerCase()
    ) {
      toast.info("Account changed", `${address.slice(0, 6)}…${address.slice(-4)}`);
    }

    prevConnected.current = isConnected;
    prevAddress.current = address;
  }, [isConnected, address, isReconnecting, toast]);

  // Chain change events
  useEffect(() => {
    if (chainId === undefined || prevChainId.current === undefined) {
      prevChainId.current = chainId;
      return;
    }
    if (prevChainId.current !== chainId) {
      const oldChain = chainById(prevChainId.current);
      const newChain = chainById(chainId);
      const oldName = oldChain?.name ?? `Chain #${prevChainId.current}`;
      const newName = newChain?.name ?? `Chain #${chainId}`;
      toast.info("Network changed", `${oldName} → ${newName}`);
      prevChainId.current = chainId;
    }
  }, [chainId, toast]);

  // Network mode toggle events
  useEffect(() => {
    if (prevMode.current !== mode) {
      toast.info(
        mode === "testnet" ? "Switched to Testnet" : "Switched to Mainnet",
        mode === "testnet"
          ? "Tokens here have NO real value"
          : "Real funds in use — be careful",
      );
      prevMode.current = mode;

      // Auto-suggest chain switch if wallet is on a mismatched chain
      if (isConnected && chainId !== undefined) {
        const activeChainIds = mode === "testnet" ? TESTNET_CHAIN_IDS : MAINNET_CHAIN_IDS;
        if (!activeChainIds.includes(chainId)) {
          const targetId = activeChainIds[0];
          const targetChain = chainById(targetId);
          toast.loading(
            "Wrong network",
            `Please switch to ${targetChain?.name ?? "a supported chain"}`,
          );
        }
      }
    }
  }, [mode, isConnected, chainId, toast]);

  // Auto-switch helper (call from components)
  const ensureChain = async (targetChainId: number): Promise<boolean> => {
    if (chainId === targetChainId) return true;
    if (!isConnected) {
      toast.error("Wallet not connected", "Please connect your wallet first");
      return false;
    }
    try {
      toast.loading("Switching network…", `Target: ${chainById(targetChainId)?.name ?? "#" + targetChainId}`);
      await switchChainAsync({ chainId: targetChainId });
      toast.success("Network switched", chainById(targetChainId)?.name ?? `Chain #${targetChainId}`);
      return true;
    } catch (e) {
      toast.error("Failed to switch network", e instanceof Error ? e.message : "Unknown error");
      return false;
    }
  };

  return { ensureChain, isSwitching };
}
