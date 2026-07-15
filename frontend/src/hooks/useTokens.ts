import { useQuery } from "@tanstack/react-query";
import { useAccount, useReadContract } from "wagmi";
import { getContracts } from "@/config/contracts";
import { moonFactoryAbi } from "@/abi/MoonFactory";
import { api } from "@/services/api";

export interface TokenListItem {
  address: string;
  chainId: number;
  name: string;
  symbol: string;
  imageUrl: string;
  description: string;
  supplyTier: number;
  curveShape: number;
  totalSupply: string;
  priceUsd: number;
  marketCapUsd: number;
  holders: number;
  volume24h: number;
  createdAt: number;
  graduated: boolean;
  creator: string;
}

/**
 * Fetch the global token feed from the backend (aggregated across chains).
 */
export function useTokens(chainId?: number) {
  return useQuery<TokenListItem[]>({
    queryKey: ["tokens", chainId],
    queryFn: () => api.getTokens(chainId),
    refetchInterval: 15_000,
  });
}

/**
 * Read the on-chain count of tokens created on a given factory.
 */
export function useTokensLength(chainId: number) {
  const contracts = getContracts(chainId);
  return useReadContract({
    abi: moonFactoryAbi,
    address: contracts?.factory,
    functionName: "allTokensLength",
    chainId,
    query: { enabled: Boolean(contracts?.factory) },
  });
}

/**
 * Read token address by index from a factory.
 */
export function useTokenByIndex(chainId: number, index: number) {
  const contracts = getContracts(chainId);
  return useReadContract({
    abi: moonFactoryAbi,
    address: contracts?.factory,
    functionName: "allTokens",
    args: [BigInt(index)],
    chainId,
    query: { enabled: Boolean(contracts?.factory) && index >= 0 },
  });
}

/**
 * Watchlist stored in localStorage.
 */
const WATCH_KEY = "moon.fun.watchlist";

export function useWatchlist() {
  const { address } = useAccount();
  const key = `${WATCH_KEY}:${address ?? "anon"}`;
  return useQuery<string[]>({
    queryKey: ["watchlist", address],
    queryFn: () => {
      if (typeof window === "undefined") return [];
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as string[]) : [];
    },
    staleTime: Infinity,
  });
}

export function toggleWatchlist(address: string, owner?: string): string[] {
  const key = `${WATCH_KEY}:${owner ?? "anon"}`;
  const raw = window.localStorage.getItem(key);
  const list: string[] = raw ? JSON.parse(raw) : [];
  const next = list.includes(address) ? list.filter((a) => a !== address) : [...list, address];
  window.localStorage.setItem(key, JSON.stringify(next));
  return next;
}
