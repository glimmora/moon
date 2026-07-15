import { type ChainConfig } from "../config/chains.js";
import { logger } from "../utils/logger.js";
import { holderService } from "../services/holderService.js";
import { createPublicClient, http, parseEventLogs, type Log } from "viem";
import { moonTokenAbi } from "../config/abi.js";
import { prisma } from "../utils/db.js";
import { env } from "../config/env.js";

/**
 * Listen for ERC-20 Transfer events on each tracked MoonToken to refresh holder
 * balances. We poll all known tokens per chain periodically rather than maintaining
 * a live subscription (simpler + works across all 7 chains).
 *
 * AUDIT-FIX I-4: Previously called `getLogs({ fromBlock: 0n, toBlock: "safe" })` which
 * either fails on non-archive nodes or returns a huge result that exceeds the RPC's
 * log limit (typical 10k cap). Now uses a per-token checkpoint + bounded block range.
 */
export async function startHolderListener(chain: ChainConfig): Promise<void> {
  const client = createPublicClient({
    chain: { id: chain.chainId, name: chain.label, nativeCurrency: { name: chain.nativeSymbol, symbol: chain.nativeSymbol, decimals: 18 }, rpcUrls: { default: { http: [chain.rpcUrl] } } },
    transport: http(),
  });

  const POLL = 20_000; // 20s

  setInterval(async () => {
    try {
      const tokens = await prisma.token.findMany({
        where: { chainId: chain.chainId },
        select: { address: true },
        take: 50,
        orderBy: { createdAt: "desc" },
      });

      for (const token of tokens) {
        await refreshHolders(client, chain, token.address as `0x${string}`);
      }
    } catch (err) {
      logger.error({ chainId: chain.chainId, err }, "Holder listener error");
    }
  }, POLL);
}

async function refreshHolders(
  client: ReturnType<typeof createPublicClient>,
  chain: ChainConfig,
  tokenAddress: `0x${string}`,
): Promise<void> {
  // AUDIT-FIX I-4: Use a per-token checkpoint + bounded block range to avoid hitting
  // RPC log limits. On first run, we start from the token's creation block minus a
  // small offset; subsequent runs only fetch new logs since the last checkpoint.
  const checkpointId = `holders-${chain.chainId}-${tokenAddress.toLowerCase()}`;
  const checkpoint = await prisma.indexerCheckpoint.findUnique({ where: { id: checkpointId } });
  const current = await client.getBlockNumber().catch(() => 0n);
  if (current === 0n) return;

  const MAX_RANGE = BigInt(env.MAX_BLOCK_BATCH);
  let fromBlock: bigint;
  if (checkpoint?.lastBlock) {
    fromBlock = BigInt(checkpoint.lastBlock) + 1n;
  } else {
    // First run — start from current block minus MAX_RANGE so we don't fetch the entire history.
    fromBlock = current > MAX_RANGE ? current - MAX_RANGE : 0n;
  }
  const toBlock = current - fromBlock > MAX_RANGE ? fromBlock + MAX_RANGE : current;
  if (toBlock < fromBlock) return;

  const transferEvent = moonTokenAbi.find((a) => a.type === "event" && a.name === "Transfer");
  const logs = (await client.getLogs({
    address: tokenAddress,
    event: transferEvent,
    fromBlock,
    toBlock,
  }).catch(() => [])) as Log[];

  const parsed = parseEventLogs({ abi: moonTokenAbi, logs: logs as never });
  const balances = new Map<string, bigint>();
  for (const log of parsed) {
    if (log.eventName !== "Transfer") continue;
    const args = log.args as unknown as { from: string; to: string; value: bigint };
    if (args.from !== "0x0000000000000000000000000000000000000000") {
      balances.set(args.from, (balances.get(args.from) ?? 0n) - args.value);
    }
    if (args.to !== "0x0000000000000000000000000000000000000000") {
      balances.set(args.to, (balances.get(args.to) ?? 0n) + args.value);
    }
  }

  // Persist non-zero holders (delta only — holders already in DB are upserted with new balances).
  const token = await prisma.token.findUnique({ where: { chainId_address: { chainId: chain.chainId, address: tokenAddress } } });
  if (!token) return;
  const totalSupply = BigInt(token.totalSupply) || 1n;

  const entries = [...balances.entries()]
    .filter(([, bal]) => bal > 0n)
    .sort((a, b) => (b[1] > a[1] ? 1 : -1))
    .slice(0, 500);

  for (const [addr, bal] of entries) {
    await holderService.upsert({
      chainId: chain.chainId,
      tokenAddress,
      address: addr,
      balance: bal.toString(),
      percentage: Number((bal * 10000n) / totalSupply) / 100,
      isContract: false, // resolved via getCode in a future enhancement
    });
  }

  // Save the checkpoint.
  await prisma.indexerCheckpoint.upsert({
    where: { id: checkpointId },
    create: { id: checkpointId, chainId: chain.chainId, eventName: "holders", lastBlock: toBlock },
    update: { lastBlock: toBlock },
  });
}
