import { type ChainConfig } from "../config/chains.js";
import { logger } from "../utils/logger.js";
import { tokenService } from "../services/tokenService.js";
import { tradeService } from "../services/tradeService.js";
import { referralService } from "../services/referralService.js";
import { prisma } from "../utils/db.js";
import { env } from "../config/env.js";
import { moonFactoryAbi, bondingCurveAbi, referralRegistryAbi, creatorFeeVaultAbi } from "../config/abi.js";
import { createPublicClient, http, parseEventLogs, type Log, getAddress, type AbiEvent } from "viem";
import type { MoonIO } from "../sockets/server.js";

interface IndexerState {
  lastBlock: bigint;
  // Separate checkpoint for the TokenCreated fast-path (shallower confirmations).
  lastCreateBlock: bigint;
  running: boolean;
  interval?: ReturnType<typeof setInterval>;
  polling: boolean;
  backoffUntil: number;
  consecutiveErrors: number;
  referralRegistry?: `0x${string}`;
  creatorFeeVault?: `0x${string}`;
}

const states = new Map<number, IndexerState>();

/**
 * Start a polling indexer for a single chain. Watches the factory's TokenCreated
 * event and each curve's Bought / Sold / Graduated events.
 *
 * Idempotent: persists the last processed block per (chainId, eventName) and
 * resumes from there on restart.
 */
export async function startChainListener(chain: ChainConfig, io?: MoonIO): Promise<void> {
  if (!chain.factoryAddress) {
    logger.warn({ chainId: chain.chainId }, "No factory address — skipping chain listener");
    return;
  }

  const client = createPublicClient({
    chain: { id: chain.chainId, name: chain.label, nativeCurrency: { name: chain.nativeSymbol, symbol: chain.nativeSymbol, decimals: 18 }, rpcUrls: { default: { http: [chain.rpcUrl] } } },
    transport: http(),
  });

  // Resume from checkpoint or start from recent blocks.
  const checkpoint = await prisma.indexerCheckpoint.findUnique({
    where: { id: `factory-${chain.chainId}` },
  });
  const lastBlock = checkpoint?.lastBlock
    ? BigInt(checkpoint.lastBlock)
    : await getRecentBlock(client);

  // Resume the TokenCreated fast-path from its own checkpoint (or the same
  // starting point as the safe-head path on first run).
  const createCheckpoint = await prisma.indexerCheckpoint.findUnique({
    where: { id: `factory-create-${chain.chainId}` },
  });
  const lastCreateBlock = createCheckpoint?.lastBlock
    ? BigInt(createCheckpoint.lastBlock)
    : lastBlock;

  // Resolve the referral registry + creator fee vault addresses from the factory so
  // we can index ReferralRecorded / FeesAccrued without extra per-chain env vars.
  let referralRegistry: `0x${string}` | undefined;
  let creatorFeeVault: `0x${string}` | undefined;
  try {
    const [reg, vault] = await Promise.all([
      client.readContract({ address: chain.factoryAddress as `0x${string}`, abi: moonFactoryAbi, functionName: "referralRegistry" }) as Promise<`0x${string}`>,
      client.readContract({ address: chain.factoryAddress as `0x${string}`, abi: moonFactoryAbi, functionName: "creatorFeeVault" }) as Promise<`0x${string}`>,
    ]);
    const zero = "0x0000000000000000000000000000000000000000";
    if (reg && reg !== zero) referralRegistry = getAddress(reg);
    if (vault && vault !== zero) creatorFeeVault = getAddress(vault);
  } catch (err) {
    logger.warn({ chainId: chain.chainId, err }, "Could not resolve referral/fee addresses — those events won't be indexed");
  }

  states.set(chain.chainId, { lastBlock, lastCreateBlock, running: true, polling: false, backoffUntil: 0, consecutiveErrors: 0, referralRegistry, creatorFeeVault });
  logger.info({ chainId: chain.chainId, lastBlock: lastBlock.toString(), referralRegistry, creatorFeeVault }, "Chain listener started");

  // Poll loop with concurrency guard.
  const interval = setInterval(async () => {
    const state = states.get(chain.chainId);
    if (!state?.running || state.polling) return;
    // RPC error backoff — skip this tick until the cooldown elapses.
    if (Date.now() < state.backoffUntil) return;
    state.polling = true;
    try {
      const head = await client.getBlockNumber();

      // ── TokenCreated fast-path ──────────────────────────────────────
      // Index new tokens at a shallower confirmation depth so they appear in
      // lists/detail quickly. Idempotent upserts make this reorg-safe; the
      // reorg-heal rewind below still re-scans within the safe window.
      const createConfirmations = BigInt(env.BACKEND_CREATE_CONFIRMATIONS);
      const createSafeHead = head > createConfirmations ? head - createConfirmations : 0n;
      if (createSafeHead > state.lastCreateBlock) {
        const createFrom = state.lastCreateBlock + 1n;
        const createTo = createSafeHead > createFrom + BigInt(env.BACKEND_MAX_BLOCK_BATCH)
          ? createFrom + BigInt(env.BACKEND_MAX_BLOCK_BATCH)
          : createSafeHead;
        if (createTo >= createFrom) {
          await pollFactoryEvents(client, chain, createFrom, createTo);
          await prisma.indexerCheckpoint.upsert({
            where: { id: `factory-create-${chain.chainId}` },
            create: { id: `factory-create-${chain.chainId}`, chainId: chain.chainId, eventName: "factory-create", lastBlock: createTo },
            update: { lastBlock: createTo },
          });
          state.lastCreateBlock = createTo;
        }
      }

      // Confirmation lag: never index newer than (head - CONFIRMATIONS) so that
      // shallow reorgs never surface indexed data we'd have to undo.
      const confirmations = BigInt(env.BACKEND_CONFIRMATIONS);
      const safeHead = head > confirmations ? head - confirmations : 0n;
      if (safeHead === 0n || safeHead <= state.lastBlock - BigInt(env.BACKEND_REORG_REWIND_BLOCKS)) {
        // Nothing new past the safe head — but still allow rewind scan below only
        // if we have new safe blocks. If not, bail early.
        if (safeHead <= state.lastBlock) return;
      }

      // Reorg heal: re-scan the last REORG_REWIND_BLOCKS confirmed blocks. Upserts
      // are keyed by (chainId, txHash, tokenAddress) so re-processing is idempotent,
      // and a canonical reorg replacement will overwrite stale rows.
      const rewind = BigInt(env.BACKEND_REORG_REWIND_BLOCKS);
      const fromBlock = state.lastBlock + 1n > rewind ? state.lastBlock + 1n - rewind : 1n;
      const toBlock = safeHead > fromBlock + BigInt(env.BACKEND_MAX_BLOCK_BATCH)
        ? fromBlock + BigInt(env.BACKEND_MAX_BLOCK_BATCH)
        : safeHead;

      if (toBlock < fromBlock) return;

      await pollFactoryEvents(client, chain, fromBlock, toBlock);
      await pollCurveEvents(client, chain, fromBlock, toBlock, io);
      // Referral/fee accumulators use an in-memory dedup set to prevent
      // double-counting within a small safety overlap (CONFIRMATIONS blocks),
      // so they can also scan the reorg-rewind window like factory/curve events.
      // This catches crash-gap events that would otherwise be permanently lost.
      const feeRewind = BigInt(env.BACKEND_CONFIRMATIONS);
      const feeFrom = state.lastBlock + 1n > feeRewind ? state.lastBlock + 1n - feeRewind : 1n;
      if (toBlock >= feeFrom) {
        await pollReferralAndFeeEvents(client, chain, feeFrom, toBlock, state);
      }

      // Save checkpoint to DB FIRST, then update in-memory state.
      // This prevents blocks from being permanently skipped if crash occurs between them.
      const newLast = toBlock > state.lastBlock ? toBlock : state.lastBlock;
      await prisma.indexerCheckpoint.upsert({
        where: { id: `factory-${chain.chainId}` },
        create: { id: `factory-${chain.chainId}`, chainId: chain.chainId, eventName: "factory", lastBlock: newLast },
        update: { lastBlock: newLast },
      });
      state.lastBlock = newLast;
      state.consecutiveErrors = 0;
    } catch (err) {
      // Exponential backoff (capped at 60s) to avoid hammering a failing RPC.
      state.consecutiveErrors += 1;
      const delay = Math.min(60_000, env.BACKEND_POLL_INTERVAL_MS * 2 ** Math.min(state.consecutiveErrors, 5));
      state.backoffUntil = Date.now() + delay;
      logger.error({ chainId: chain.chainId, err, backoffMs: delay }, "Chain listener poll error — backing off");
    } finally {
      state.polling = false;
    }
  }, env.BACKEND_POLL_INTERVAL_MS);

  // Store ref for cleanup on shutdown.
  const s = states.get(chain.chainId);
  if (s) s.interval = interval;
}

async function getRecentBlock(client: ReturnType<typeof createPublicClient>): Promise<bigint> {
  const current = await client.getBlockNumber();
  return current > BigInt(env.BACKEND_START_BLOCK_OFFSET) ? current - BigInt(env.BACKEND_START_BLOCK_OFFSET) : 0n;
}

async function pollFactoryEvents(
  client: ReturnType<typeof createPublicClient>,
  chain: ChainConfig,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<void> {
  const logs = (await client.getLogs({
    address: chain.factoryAddress as `0x${string}`,
    event: moonFactoryAbi.find((a) => a.type === "event" && a.name === "TokenCreated"),
    fromBlock,
    toBlock,
  })) as Log[];

  const parsed = parseEventLogs({ abi: moonFactoryAbi, logs: logs as Log[] });
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
    await tokenService.upsert({
      chainId: chain.chainId,
      address: getAddress(args.token),
      curve: getAddress(args.curve),
      name: args.name,
      symbol: args.symbol,
      imageUrl: args.imageUrl,
      description: args.description,
      supplyTier: args.supplyTier,
      curveShape: args.curveShape,
      totalSupply: args.totalSupply.toString(),
      creator: getAddress(args.creator),
      creationBlock: log.blockNumber,
    });
    logger.info({ chainId: chain.chainId, token: args.token, symbol: args.symbol }, "TokenCreated indexed");
  }
}

async function pollCurveEvents(
  client: ReturnType<typeof createPublicClient>,
  chain: ChainConfig,
  fromBlock: bigint,
  toBlock: bigint,
  io?: MoonIO,
): Promise<void> {
  const eventDefs = bondingCurveAbi.filter((a) => a.type === "event" && ["Bought", "Sold", "Graduated"].includes(a.name)) as AbiEvent[];

  // Fetch all known curve addresses from the DB first, so getLogs is
  // scoped to curves we track (avoiding massive unfiltered log queries
  // across the entire chain that would exceed RPC limits).
  const knownCurves = await prisma.token.findMany({
    where: { chainId: chain.chainId, curve: { not: null } },
    select: { address: true, curve: true },
  });
  const knownCurveAddresses = knownCurves.map((t) => getAddress(t.curve!));
  if (knownCurveAddresses.length === 0) return;

  // Build curve→token lookup from the same DB batch (avoids a second query).
  const tokensByCurve = new Map<string, { address: string }>();
  for (const t of knownCurves) {
    if (t.curve) tokensByCurve.set(t.curve.toLowerCase(), { address: t.address });
  }

  const logs = (await client.getLogs({
    address: knownCurveAddresses,
    events: eventDefs,
    fromBlock,
    toBlock,
  })) as Log[];

  const parsed = parseEventLogs({ abi: bondingCurveAbi, logs: logs as Log[] });

  // Fetch block timestamps in batch for accurate trade times.
  const blockNumbers = [...new Set(parsed.map((l) => l.blockNumber).filter(Boolean))] as bigint[];
  const blockTimestamps = new Map<bigint, Date>();
  await Promise.all(
    blockNumbers.map(async (bn) => {
      try {
        const block = await client.getBlock({ blockNumber: bn });
        blockTimestamps.set(bn, new Date(Number(block.timestamp) * 1000));
      } catch { /* skip — fall back to new Date() */ }
    }),
  );

  for (const log of parsed) {
    if (log.eventName === "Bought" || log.eventName === "Sold") {
      const args = log.args as unknown as {
        buyer?: string;
        seller?: string;
        quoteIn?: bigint;
        tokensIn?: bigint;
        tokensOut?: bigint;
        quoteOut?: bigint;
        fee?: bigint;
        priceAfter?: bigint;
      };
      const curveKey = (log.address as string).toLowerCase();
      const token = tokensByCurve.get(curveKey);
      if (!token) {
        logger.warn({ chainId: chain.chainId, curve: log.address }, "Curve event for unknown token — skipping");
        continue;
      }
      await tradeService.record({
        chainId: chain.chainId,
        txHash: log.transactionHash ?? "0x0",
        tokenAddress: token.address,
        side: log.eventName === "Bought" ? "buy" : "sell",
        trader: (() => {
          const raw = args.buyer ?? args.seller;
          if (!raw || raw === "0x0") return "0x0000000000000000000000000000000000000000";
          return getAddress(raw);
        })(),
        quoteAmount: (args.quoteIn ?? args.quoteOut ?? 0n).toString(),
        tokenAmount: (args.tokensOut ?? args.tokensIn ?? 0n).toString(),
        priceUsd: Number(args.priceAfter ?? 0n) / 1e18,
        feeUsd: Number(args.fee ?? 0n) / 1e18,
        blockNumber: log.blockNumber,
        timestamp: blockTimestamps.get(log.blockNumber ?? 0n) ?? new Date(),
      });

      // BE-H1: Broadcast trade to connected clients.
      if (io) {
        const room = `token:${chain.chainId}:${token.address.toLowerCase()}`;
        io.to(room).emit("trade", {
          chainId: chain.chainId,
          tokenAddress: token.address,
          side: log.eventName === "Bought" ? "buy" : "sell",
          trader: args.buyer ?? args.seller,
          quoteAmount: (args.quoteIn ?? args.quoteOut ?? 0n).toString(),
          tokenAmount: (args.tokensOut ?? args.tokensIn ?? 0n).toString(),
          priceUsd: Number(args.priceAfter ?? 0n) / 1e18,
          timestamp: (blockTimestamps.get(log.blockNumber ?? 0n) ?? new Date()).getTime(),
        });
      }
    } else if (log.eventName === "Graduated") {
      const args = log.args as unknown as { token: string; pair: string };
      await tokenService.markGraduated(chain.chainId, getAddress(args.token), getAddress(args.pair));
      logger.info({ chainId: chain.chainId, token: args.token, pair: args.pair }, "Token graduated");
    }
  }
}

async function pollReferralAndFeeEvents(
  client: ReturnType<typeof createPublicClient>,
  chain: ChainConfig,
  fromBlock: bigint,
  toBlock: bigint,
  state: IndexerState,
): Promise<void> {
  // In-memory cache of recently processed event positions to guard against
  // double-counting when the same block range is polled again after a crash
  // (checkpoint saved AFTER processing). Key: "chainId:txHash:logIndex".
  const processed = new Set<string>();

  // Referral rewards — accumulate per referrer.
  if (state.referralRegistry) {
    const events = referralRegistryAbi.filter(
      (a) => a.type === "event" && a.name === "ReferralRecorded",
    ) as AbiEvent[];
    const logs = (await client.getLogs({
      address: state.referralRegistry,
      events,
      fromBlock,
      toBlock,
    })) as Log[];
    const parsed = parseEventLogs({ abi: referralRegistryAbi, logs: logs as Log[] });
    for (const log of parsed) {
      if (log.eventName !== "ReferralRecorded") continue;
      const key = `${chain.chainId}:${log.transactionHash ?? "0x0"}:${log.logIndex ?? 0}`;
      if (processed.has(key)) continue;
      processed.add(key);

      const args = log.args as unknown as {
        referrer: string;
        tradeVolume: bigint;
        rewardAmount: bigint;
      };
      if (!args.referrer || args.referrer === "0x0000000000000000000000000000000000000000") continue;
      await referralService.record(
        chain.chainId,
        getAddress(args.referrer),
        args.tradeVolume ?? 0n,
        args.rewardAmount ?? 0n,
      );
    }
  }

  // Creator fees — accumulate per (creator, quoteAsset).
  if (state.creatorFeeVault) {
    const events = creatorFeeVaultAbi.filter(
      (a) => a.type === "event" && a.name === "FeesAccrued",
    ) as AbiEvent[];
    const logs = (await client.getLogs({
      address: state.creatorFeeVault,
      events,
      fromBlock,
      toBlock,
    })) as Log[];
    const parsed = parseEventLogs({ abi: creatorFeeVaultAbi, logs: logs as Log[] });
    for (const log of parsed) {
      if (log.eventName !== "FeesAccrued") continue;
      const key = `${chain.chainId}:${log.transactionHash ?? "0x0"}:${log.logIndex ?? 0}`;
      if (processed.has(key)) continue;
      processed.add(key);

      const args = log.args as unknown as {
        creator: string;
        quoteAsset: string;
        amount: bigint;
      };
      if (!args.creator) continue;
      await referralService.recordCreatorFee(
        chain.chainId,
        getAddress(args.creator),
        getAddress(args.quoteAsset),
        args.amount ?? 0n,
      );
    }
  }
}

export function stopChainListener(chainId: number): void {
  const state = states.get(chainId);
  if (!state) return;
  state.running = false;
  if (state.interval) clearInterval(state.interval);
  states.delete(chainId);
}
