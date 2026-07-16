import { useQuery } from "@tanstack/react-query";
import { useAccount, useReadContract } from "wagmi";
import { getContracts } from "@/config/contracts";
import { moonFactoryAbi } from "@/abi/MoonFactory";
import { api } from "@/services/api";
import { useBackendHealth } from "@/hooks/useBackendHealth";
import type { Log } from "viem";

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
  curve?: string;
  realTokenReserves?: string;
  isGraduated?: boolean;
  holderCount?: number;
}

/**
 * Fetch tokens — tries backend API first, falls back to on-chain reads
 * from the factory contract if backend is offline or returns empty.
 */
export function useTokens(opts?: { sort?: string; chainId?: number; includeGraduated?: boolean }) {
  const chainId = opts?.chainId;
  const { isOnline } = useBackendHealth();

  return useQuery<TokenListItem[]>({
    queryKey: ["tokens", chainId, opts?.sort, opts?.includeGraduated, isOnline],
    queryFn: async () => {
      // Try backend API first
      if (isOnline) {
        try {
          const tokens = await api.getTokens(chainId);
          if (tokens && tokens.length > 0) return tokens;
        } catch {
          // Backend failed — fall through to on-chain
        }
      }

      // Fallback: read tokens directly from factory contracts on-chain
      return await fetchTokensOnChain(chainId);
    },
    refetchInterval: 15_000,
    retry: 1,
  });
}

/**
 * Read tokens directly from factory contracts via viem public client.
 * This works even when backend is offline.
 */
async function fetchTokensOnChain(filterChainId?: number): Promise<TokenListItem[]> {
  const { moonChains } = await import("@/config/chains");
  const { getContracts } = await import("@/config/contracts");
  const viem = await import("viem");
  const { createPublicClient, http, parseEventLogs } = viem;

  const tokens: TokenListItem[] = [];

  // Determine which chains to scan
  const chainsToScan = filterChainId
    ? moonChains.filter((c) => c.id === filterChainId)
    : moonChains;

  for (const chain of chainsToScan) {
    const contracts = getContracts(chain.id);
    if (!contracts?.factory || contracts.factory === "0x0000000000000000000000000000000000000000") continue;

    const client = createPublicClient({
      chain: { id: chain.id, name: chain.name, nativeCurrency: chain.nativeCurrency, rpcUrls: chain.rpcUrls },
      transport: http(),
    });

    try {
      // Read allTokensLength
      const length = await client.readContract({
        address: contracts.factory as `0x${string}`,
        abi: moonFactoryAbi,
        functionName: "allTokensLength",
      }) as bigint;

      if (length === 0n) continue;

      // Fetch TokenCreated events from recent blocks (last ~10000 blocks)
      const currentBlock = await client.getBlockNumber();
      const fromBlock = currentBlock > 10000n ? currentBlock - 10000n : 0n;

      const logs = await client.getLogs({
        address: contracts.factory as `0x${string}`,
        event: moonFactoryAbi.find((a) => a.type === "event" && a.name === "TokenCreated"),
        fromBlock,
        toBlock: "latest",
      }) as Log[];

      const parsed = parseEventLogs({ abi: moonFactoryAbi, logs: logs as never });

      for (const log of parsed) {
        if (log.eventName !== "TokenCreated") continue;
        const args = log.args as unknown as {
          token: string;
          curve: string;
          creator: string;
          name: string;
          symbol: string;
          supplyTier: number;
          curveShape: number;
          totalSupply: bigint;
          imageUrl: string;
          description: string;
        };
        tokens.push({
          address: args.token,
          chainId: chain.id,
          name: args.name,
          symbol: args.symbol,
          imageUrl: args.imageUrl,
          description: args.description,
          supplyTier: args.supplyTier,
          curveShape: args.curveShape,
          totalSupply: args.totalSupply.toString(),
          priceUsd: 0,
          marketCapUsd: 0,
          holders: 0,
          volume24h: 0,
          createdAt: Date.now(),
          graduated: false,
          creator: args.creator,
          curve: args.curve,
        });
      }
    } catch {
      // Skip this chain if RPC fails
    }
  }

  return tokens;
}

export type TokenSort = "newest" | "trending" | "gainers" | "volume" | "graduated";

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
