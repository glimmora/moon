import { createPublicClient, http, parseEventLogs, type Log, type PublicClient } from "viem";
import { moonChains } from "@/config/chains";
import { moonFactoryAbi } from "@/abi/MoonFactory";
import { moonTokenAbi } from "@/abi/MoonToken";
import type { TokenMeta } from "@/services/api";

const clientCache = new Map<number, PublicClient>();

function getPublicClient(chainId: number): PublicClient | null {
  const cached = clientCache.get(chainId);
  if (cached) return cached;
  const chain = moonChains.find((c) => c.id === chainId);
  if (!chain) return null;
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

/**
 * Fetch basic token metadata from on-chain data.
 * Serves as a fallback when the backend hasn't indexed a token yet.
 *
 * Strategy:
 *   1. Try TokenCreated event (last 5000 blocks) — gives full metadata + curve.
 *   2. Fall back to direct token contract reads — always works for valid tokens.
 */
export async function fetchTokenMetaOnChain(chainId: number, tokenAddress: string): Promise<TokenMeta | null> {
  const client = getPublicClient(chainId);
  if (!client) return null;

  // Try 1: TokenCreated event (gives full metadata including curve address).
  const eventDef = moonFactoryAbi.find((a) => a.type === "event" && a.name === "TokenCreated");
  if (eventDef) {
    try {
      const currentBlock = await client.getBlockNumber();
      const fromBlock = currentBlock > 5000n ? currentBlock - 5000n : 0n;

      const logs = await client.getLogs({
        event: eventDef,
        args: { token: tokenAddress as `0x${string}` },
        fromBlock,
        toBlock: "latest",
      });

      if (logs.length > 0) {
        const parsed = parseEventLogs({ abi: moonFactoryAbi, logs: logs as Log[] });
        for (const log of parsed) {
          if (log.eventName !== "TokenCreated") continue;
          const args = log.args as unknown as {
            token: string; curve: string; creator: string;
            name: string; symbol: string;
            supplyTier: number; curveShape: number;
            totalSupply: bigint; imageUrl: string; description: string;
          };
          return {
            address: args.token,
            chainId,
            name: args.name,
            symbol: args.symbol,
            imageUrl: args.imageUrl,
            description: args.description,
            supplyTier: args.supplyTier,
            curveShape: args.curveShape,
            totalSupply: args.totalSupply.toString(),
            creator: args.creator,
            curve: args.curve,
            createdAt: Date.now(),
            graduated: false,
            priceUsd: 0,
            marketCapUsd: 0,
            holderCount: 0,
            volume24h: 0,
          };
        }
      }
    } catch {
      // event query failed — try direct reads below
    }
  }

  // Try 2: Read token contract directly (no curve address, but shows basic info).
  try {
    const [name, symbol, totalSupplyInit, supplyTier, curveShape] = await Promise.all([
      client.readContract({ address: tokenAddress as `0x${string}`, abi: moonTokenAbi, functionName: "name" }),
      client.readContract({ address: tokenAddress as `0x${string}`, abi: moonTokenAbi, functionName: "symbol" }),
      client.readContract({ address: tokenAddress as `0x${string}`, abi: moonTokenAbi, functionName: "totalSupplyInit" }),
      client.readContract({ address: tokenAddress as `0x${string}`, abi: moonTokenAbi, functionName: "supplyTier" }),
      client.readContract({ address: tokenAddress as `0x${string}`, abi: moonTokenAbi, functionName: "curveShape" }),
    ]);

    return {
      address: tokenAddress,
      chainId,
      name: name as string,
      symbol: symbol as string,
      imageUrl: "",
      description: "",
      supplyTier: supplyTier as number,
      curveShape: curveShape as number,
      totalSupply: (totalSupplyInit as bigint).toString(),
      creator: "",
      curve: "",
      createdAt: Date.now(),
      graduated: false,
      priceUsd: 0,
      marketCapUsd: 0,
      holderCount: 0,
      volume24h: 0,
    };
  } catch {
    // direct read also failed
  }

  return null;
}
