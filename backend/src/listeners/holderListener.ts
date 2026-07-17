import { type ChainConfig } from "../config/chains.js";
import { logger } from "../utils/logger.js";
import { createPublicClient, http, parseEventLogs, type Log, getAddress } from "viem";
import { Prisma } from "@prisma/client";
import { moonTokenAbi } from "../config/abi.js";
import { prisma } from "../utils/db.js";
import { env } from "../config/env.js";
import { tokenService } from "../services/tokenService.js";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

const holderIntervals = new Map<number, ReturnType<typeof setInterval>>();
const holderPolling = new Map<number, boolean>();

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

  const interval = setInterval(async () => {
    if (holderPolling.get(chain.chainId)) return;
    holderPolling.set(chain.chainId, true);
    try {
      // Process ALL tokens via cursor pagination instead of limiting to 50.
      let cursor: string | undefined;
      let hasMore = true;
      while (hasMore) {
        const batch = await prisma.token.findMany({
          where: { chainId: chain.chainId },
          select: { id: true, address: true, totalSupply: true },
          take: 200,
          orderBy: { id: "asc" },
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        });
        for (const token of batch) {
          await refreshHolders(client, chain, token.address as `0x${string}`, token.totalSupply);
        }
        hasMore = batch.length === 200;
        if (hasMore) cursor = batch[batch.length - 1].id;
      }
    } catch (err) {
      logger.error({ chainId: chain.chainId, err }, "Holder listener error");
    } finally {
      holderPolling.set(chain.chainId, false);
    }
    }, POLL);

  holderIntervals.set(chain.chainId, interval);
}

export function stopHolderListener(chainId: number): void {
  const intv = holderIntervals.get(chainId);
  if (intv) {
    clearInterval(intv);
    holderIntervals.delete(chainId);
  }
}

async function refreshHolders(
  client: ReturnType<typeof createPublicClient>,
  chain: ChainConfig,
  tokenAddress: `0x${string}`,
  totalSupplyStr?: string,
): Promise<void> {
  // AUDIT-FIX I-4: Use a per-token checkpoint + bounded block range to avoid hitting
  // RPC log limits. On first run, we start from the token's creation block minus a
  // small offset; subsequent runs only fetch new logs since the last checkpoint.
  if (!totalSupplyStr) {
    logger.warn({ chainId: chain.chainId, tokenAddress }, "Missing totalSupply — skipping holder refresh");
    return;
  }

  const checkpointId = `holders-${chain.chainId}-${tokenAddress.toLowerCase()}`;
  const checkpoint = await prisma.indexerCheckpoint.findUnique({ where: { id: checkpointId } });
  const head = await client.getBlockNumber().catch(() => 0n);
  if (head === 0n) return;

  // Confirmation lag so holder balances don't reflect reorg-able blocks.
  const confirmations = BigInt(env.CONFIRMATIONS);
  const safeHead = head > confirmations ? head - confirmations : 0n;
  if (safeHead === 0n) return;

  const MAX_RANGE = BigInt(env.MAX_BLOCK_BATCH);
  let fromBlock: bigint;
  if (checkpoint?.lastBlock) {
    fromBlock = BigInt(checkpoint.lastBlock) + 1n;
  } else {
    // Initial snapshot: fetch from a deeper offset (100k blocks ≈ 2 days).
    fromBlock = safeHead > 100_000n ? safeHead - 100_000n : 1n;
  }
  const toBlock = safeHead - fromBlock > MAX_RANGE ? fromBlock + MAX_RANGE : safeHead;
  if (toBlock < fromBlock) return;

  const transferEvent = moonTokenAbi.find((a) => a.type === "event" && a.name === "Transfer");
  const logs = (await client.getLogs({
    address: tokenAddress,
    event: transferEvent,
    fromBlock,
    toBlock,
  }).catch((err: unknown) => {
    logger.warn({ chainId: chain.chainId, tokenAddress, err }, "Holder getLogs failed — will retry next poll");
    return null;
  })) as Log[] | null;
  // Null = RPC failure. Do NOT advance the checkpoint, so we retry this range.
  if (logs === null) return;

  const parsed = parseEventLogs({ abi: moonTokenAbi, logs: logs as never });
  // Deltas within this window only.
  const deltas = new Map<string, bigint>();
  for (const log of parsed) {
    if (log.eventName !== "Transfer") continue;
    const args = log.args as unknown as { from: string; to: string; value: bigint };
    const from = getAddress(args.from);
    const to = getAddress(args.to);
    if (from !== ZERO_ADDR) deltas.set(from, (deltas.get(from) ?? 0n) - args.value);
    if (to !== ZERO_ADDR) deltas.set(to, (deltas.get(to) ?? 0n) + args.value);
  }

  const totalSupply = BigInt(totalSupplyStr);

  if (deltas.size > 0) {
    // Load existing balances for the touched addresses and apply deltas cumulatively.
    const touched = [...deltas.keys()];
    const existing = await prisma.holder.findMany({
      where: { chainId: chain.chainId, tokenAddress, address: { in: touched } },
      select: { address: true, balance: true, isContract: true },
    });
    const priorBalance = new Map<string, bigint>();
    const knownContract = new Map<string, boolean>();
    for (const h of existing) {
      priorBalance.set(h.address, BigInt(h.balance));
      knownContract.set(h.address, h.isContract);
    }

    // Compute the surviving (positive-balance) holders and the set of addresses
    // whose contract-status is still unknown, then probe getCode for all of them
    // in parallel (was an O(n) sequential RPC waterfall inside the loop).
    const nextBalance = new Map<string, bigint>();
    const toProbe: string[] = [];
    for (const [addr, delta] of deltas) {
      const next = (priorBalance.get(addr) ?? 0n) + delta;
      nextBalance.set(addr, next);
      if (next > 0n && knownContract.get(addr) === undefined) {
        toProbe.push(addr);
      }
    }

    const probed = new Map<string, boolean>();
    if (toProbe.length > 0) {
      const codes = await Promise.all(
        toProbe.map((addr) =>
          client.getCode({ address: addr as `0x${string}` }).catch(() => undefined),
        ),
      );
      toProbe.forEach((addr, i) => {
        probed.set(addr, !!codes[i] && codes[i] !== "0x");
      });
    }

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    for (const [addr, next] of nextBalance) {
      if (next <= 0n) {
        // Fully exited — remove the holder row so counts stay accurate.
        ops.push(
          prisma.holder.deleteMany({
            where: { chainId: chain.chainId, tokenAddress, address: addr },
          }),
        );
        continue;
      }
      const isContract = knownContract.get(addr) ?? probed.get(addr) ?? false;
      const percentage = Number((next * 10000n) / totalSupply) / 100;
      ops.push(
        prisma.holder.upsert({
          where: { chainId_tokenAddress_address: { chainId: chain.chainId, tokenAddress, address: addr } },
          create: { chainId: chain.chainId, tokenAddress, address: addr, balance: next.toString(), percentage, isContract },
          update: { balance: next.toString(), percentage, isContract },
        }),
      );
    }
    await prisma.$transaction(ops);
  }

  // Recompute accurate holder count (all non-zero rows for this token).
  const holderCount = await prisma.holder.count({ where: { chainId: chain.chainId, tokenAddress } });
  await tokenService.updateMarketStats(chain.chainId, tokenAddress, { holderCount }).catch(() => {
    /* token row may not exist yet if factory hasn't indexed it — ignore */
  });

  // Advance the checkpoint only after a fully successful pass.
  const eventName = `holders-${tokenAddress.toLowerCase()}`;
  await prisma.indexerCheckpoint.upsert({
    where: { id: checkpointId },
    create: { id: checkpointId, chainId: chain.chainId, eventName, lastBlock: toBlock },
    update: { lastBlock: toBlock },
  });
}
