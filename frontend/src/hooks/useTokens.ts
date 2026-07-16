import { useQuery } from "@tanstack/react-query";
import { useAccount, useReadContract } from "wagmi";
import { getContracts } from "@/config/contracts";
import { moonFactoryAbi } from "@/abi/MoonFactory";
import { api } from "@/services/api";
import { useBackendHealth } from "@/hooks/useBackendHealth";
import { moonChains } from "@/config/chains";
import { createPublicClient, http, parseEventLogs } from "viem";

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
}

/**
 * Fetch tokens — tries backend API first, falls back to on-chain reads.
 */
export function useTokens(opts?: { sort?: string; chainId?: number; includeGraduated?: boolean }) {
  const chainId = opts?.chainId;
  const { isOnline } = useBackendHealth();

  return useQuery<TokenListItem[]>({
    queryKey: ["tokens-v2", chainId, isOnline],
    queryFn: async () => {
      // Try backend first
      if (isOnline) {
        try {
          const tokens = await api.getTokens(chainId);
          if (tokens && tokens.length > 0) return tokens;
        } catch {
          // fall through
        }
      }

      // On-chain fallback: read allTokensLength then allTokens(i) for each
      return await fetchTokensOnChain(chainId);
    },
    refetchInterval: 15_000,
    retry: 1,
  });
}

/** Read tokens directly from factory — uses allTokens(i) per index. */
async function fetchTokensOnChain(filterChainId?: number): Promise<TokenListItem[]> {
  const tokens: TokenListItem[] = [];

  const chainsToScan = filterChainId
    ? moonChains.filter((c) => c.id === filterChainId)
    : moonChains;

  await Promise.all(
    chainsToScan.map(async (chain) => {
      const contracts = getContracts(chain.id);
      if (!contracts?.factory || contracts.factory === "0x0000000000000000000000000000000000000000") return;

      const client = createPublicClient({
        chain: {
          id: chain.id,
          name: chain.name,
          nativeCurrency: chain.nativeCurrency as { name: string; symbol: string; decimals: number },
          rpcUrls: chain.rpcUrls as { default: { http: string[] } },
        },
        transport: http(),
      });

      try {
        // 1. Get token count
        const length = (await client.readContract({
          address: contracts.factory as `0x${string}`,
          abi: moonFactoryAbi,
          functionName: "allTokensLength",
        })) as bigint;

        if (length === 0n) return;

        // 2. Get TokenCreated events (more efficient than N readContract calls)
        try {
          const currentBlock = await client.getBlockNumber();
          const fromBlock = currentBlock > 50000n ? currentBlock - 50000n : 0n;

          const logs = await client.getLogs({
            address: contracts.factory as `0x${string}`,
            event: moonFactoryAbi.find((a) => a.type === "event" && a.name === "TokenCreated"),
            fromBlock,
            toBlock: "latest",
          });

          const parsed = parseEventLogs({ abi: moonFactoryAbi, logs: logs as never });

          for (const log of parsed) {
            if (log.eventName !== "TokenCreated") continue;
            const args = log.args as unknown as {
              token: string; curve: string; creator: string;
              name: string; symbol: string;
              supplyTier: number; curveShape: number;
              totalSupply: bigint; imageUrl: string; description: string;
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
          // Event query failed (RPC doesn't support logs or no archive) —
          // fallback: read allTokens(i) one by one
          const maxRead = Math.min(Number(length), 50);
          for (let i = 0; i < maxRead; i++) {
            try {
              const tokenAddr = (await client.readContract({
                address: contracts.factory as `0x${string}`,
                abi: moonFactoryAbi,
                functionName: "allTokens",
                args: [BigInt(i)],
              })) as string;

              tokens.push({
                address: tokenAddr,
                chainId: chain.id,
                name: `Token #${i}`,
                symbol: "???",
                imageUrl: "",
                description: "",
                supplyTier: 0,
                curveShape: 0,
                totalSupply: "0",
                priceUsd: 0,
                marketCapUsd: 0,
                holders: 0,
                volume24h: 0,
                createdAt: Date.now(),
                graduated: false,
                creator: "",
                curve: "",
              });
            } catch {
              break;
            }
          }
        }
      } catch {
        // RPC failed for this chain — skip
      }
    }),
  );

  return tokens;
}

export type TokenSort = "newest" | "trending" | "gainers" | "volume" | "graduated";

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
