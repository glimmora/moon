import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";

export interface Holder {
  address: string;
  balance: string;
  percentage: number;
  isContract: boolean;
  firstSeen: number;
}

export function useHolders(chainId: number, tokenAddress: string) {
  return useQuery<Holder[]>({
    queryKey: ["holders", chainId, tokenAddress],
    queryFn: () => api.getHolders(chainId, tokenAddress),
    enabled: Boolean(tokenAddress),
    refetchInterval: 30_000,
  });
}

export interface BubblemapNode {
  id: string;
  address: string;
  balance: string;
  percentage: number;
  isContract: boolean;
  connections: string[];
}

export function useBubblemap(chainId: number, tokenAddress: string) {
  return useQuery<BubblemapNode[]>({
    queryKey: ["bubblemap", chainId, tokenAddress],
    queryFn: () => api.getBubblemap(chainId, tokenAddress),
    enabled: Boolean(tokenAddress),
    refetchInterval: 60_000,
  });
}
