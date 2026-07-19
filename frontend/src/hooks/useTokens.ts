import { useQuery } from "@tanstack/react-query";
import { useAccount, useReadContract } from "wagmi";
import { getContracts } from "@/config/contracts";
import { moonFactoryAbi } from "@/abi/MoonFactory";
import { moonTokenAbi } from "@/abi/MoonToken";
import { api } from "@/services/api";
import { useBackendHealth } from "@/hooks/useBackendHealth";
import { moonChains } from "@/config/chains";
import { createPublicClient, http, parseEventLogs, type Log, type PublicClient } from "viem";

// Cache one public client per chain so the on-chain fallback path doesn't
// recreate a client (and transport) on every poll.
const clientCache = new Map<number, PublicClient>();
function getPublicClient(chain: (typeof moonChains)[number]): PublicClient {
  const cached = clientCache.get(chain.id);
  if (cached) return cached;
  const client = createPublicClient({
    chain: {
      id: chain.id,
      name: chain.name,
      nativeCurrency: chain.nativeCurrency as { name: string; symbol: string; decimals: number },
      rpcUrls: chain.rpcUrls as { default: { http: string[] } },
    },
    transport: http(),
  }) as PublicClient;
  clientCache.set(chain.id, client);
  return client;
}

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
  holderCount: number;
  volume24h: number;
  createdAt: number;
  graduated: boolean;
  creator: string;
  curve?: string;
  realTokenReserves?: string;
  isGraduated?: boolean;
}

/**
 * Fetch tokens — tries backend API first, falls back to on-chain reads.
 */
export function useTokens(opts?: { sort?: string; chainId?: number; includeGraduated?: boolean }) {
  const chainId = opts?.chainId;
  const { isOnline } = useBackendHealth();

  return useQuery<TokenListItem[]>({
    queryKey: ["tokens-v3", chainId, isOnline],
    queryFn: async () => {
      let backendErrored = false;
      if (isOnline) {
        try {
          const tokens = await api.getTokens(chainId);
          if (tokens && tokens.length > 0) return tokens;
        } catch {
          backendErrored = true;
        }
      }

      const onChainTokens = await fetchTokensOnChain(chainId);
      if (onChainTokens.length === 0 && backendErrored) {
        throw new Error("Unable to fetch tokens — backend and on-chain fallback both failed.");
      }
      return onChainTokens;
    },
    refetchInterval: 15_000,
    retry: 1,
  });
}

/** Read tokens from factory contracts — events first, then per-index reads. */
async function fetchTokensOnChain(filterChainId?: number): Promise<TokenListItem[]> {
  const tokens: TokenListItem[] = [];

  const chainsToScan = filterChainId
    ? moonChains.filter((c) => c.id === filterChainId)
    : moonChains;

  await Promise.allSettled(
    chainsToScan.map(async (chain) => {
      const contracts = getContracts(chain.id);
      if (!contracts?.factory || contracts.factory === "0x0000000000000000000000000000000000000000") return;

      const client = getPublicClient(chain);

      // 1. Get token count
      const length = (await client.readContract({
        address: contracts.factory as `0x${string}`,
        abi: moonFactoryAbi,
        functionName: "allTokensLength",
      })) as bigint;

      if (length === 0n) return;

      // 2. Try TokenCreated events (fast, gets all metadata)
      let eventSuccess = false;
      try {
        const currentBlock = await client.getBlockNumber();
        // Use smaller range to avoid RPC limits (5000 blocks)
        const fromBlock = currentBlock > 5000n ? currentBlock - 5000n : 0n;

        const logs = await client.getLogs({
          address: contracts.factory as `0x${string}`,
          event: moonFactoryAbi.find((a) => a.type === "event" && a.name === "TokenCreated"),
          fromBlock,
          toBlock: "latest",
        });

          const parsed = parseEventLogs({ abi: moonFactoryAbi, logs: logs as Log[] });

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
            holderCount: 0,
            volume24h: 0,
            createdAt: Date.now(),
            graduated: false,
            creator: args.creator,
            curve: args.curve,
          });
        }
        eventSuccess = tokens.length > 0;
      } catch {
        // Event query failed — use per-index reads below
      }

      // 3. Fallback: read allTokens(i) + fetch metadata per token
      if (!eventSuccess) {
        const maxRead = Math.min(Number(length), 50);
        const tokenAddresses: string[] = [];
        for (let i = Number(length) - 1; i >= Math.max(0, Number(length) - maxRead); i--) {
          try {
            const tokenAddr = (await client.readContract({
              address: contracts.factory as `0x${string}`,
              abi: moonFactoryAbi,
              functionName: "allTokens",
              args: [BigInt(i)],
            })) as string;
            tokenAddresses.push(tokenAddr);
          } catch { break; }
        }

        // Batch: read name, symbol, supplyTier from each token contract
        await Promise.allSettled(tokenAddresses.map(async (tokenAddr) => {
          try {
            const [name, symbol, totalSupplyInit, supplyTier, curveShape] = await Promise.all([
              client.readContract({ address: tokenAddr as `0x${string}`, abi: moonTokenAbi, functionName: "name" }),
              client.readContract({ address: tokenAddr as `0x${string}`, abi: moonTokenAbi, functionName: "symbol" }),
              client.readContract({ address: tokenAddr as `0x${string}`, abi: moonTokenAbi, functionName: "totalSupplyInit" }),
              client.readContract({ address: tokenAddr as `0x${string}`, abi: moonTokenAbi, functionName: "supplyTier" }),
              client.readContract({ address: tokenAddr as `0x${string}`, abi: moonTokenAbi, functionName: "curveShape" }),
            ]);

            tokens.push({
              address: tokenAddr,
              chainId: chain.id,
              name: name as string,
              symbol: symbol as string,
              imageUrl: "",
              description: "",
              supplyTier: supplyTier as number,
              curveShape: curveShape as number,
              totalSupply: (totalSupplyInit as bigint).toString(),
              priceUsd: 0,
              marketCapUsd: 0,
              holderCount: 0,
              volume24h: 0,
              createdAt: Date.now(),
              graduated: false,
              creator: "",
              curve: "",
            });
          } catch {
            // skip this token
          }
        }));
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

const WATCH_KEY = "Moon.watchlist";

export function useWatchlist() {
  const { address } = useAccount();
  const key = `${WATCH_KEY}:${address ?? "anon"}`;
  return useQuery<string[]>({
    queryKey: ["watchlist", address],
    queryFn: () => {
      if (typeof window === "undefined") return [];
      try {
        const raw = window.localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as string[]) : [];
      } catch {
        return [];
      }
    },
    staleTime: Infinity,
  });
}

export function toggleWatchlist(address: string, owner?: string): string[] {
  const key = `${WATCH_KEY}:${owner ?? "anon"}`;
  try {
    const raw = window.localStorage.getItem(key);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const next = list.includes(address) ? list.filter((a) => a !== address) : [...list, address];
    window.localStorage.setItem(key, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}
