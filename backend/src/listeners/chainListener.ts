import { type ChainConfig } from "../config/chains.js";
import { logger } from "../utils/logger.js";
import { tokenService } from "../services/tokenService.js";
import { tradeService } from "../services/tradeService.js";
import { prisma } from "../utils/db.js";
import { env } from "../config/env.js";
import { moonFactoryAbi, bondingCurveAbi } from "../config/abi.js";
import { createPublicClient, http, parseEventLogs, type Log, getAddress } from "viem";

interface IndexerState {
  lastBlock: bigint;
  running: boolean;
}

const states = new Map<number, IndexerState>();

/**
 * Start a polling indexer for a single chain. Watches the factory's TokenCreated
 * event and each curve's Bought / Sold / Graduated events.
 *
 * Idempotent: persists the last processed block per (chainId, eventName) and
 * resumes from there on restart.
 */
export async function startChainListener(chain: ChainConfig): Promise<void> {
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
  let lastBlock = checkpoint?.lastBlock
    ? BigInt(checkpoint.lastBlock)
    : await getRecentBlock(client);

  states.set(chain.chainId, { lastBlock, running: true });
  logger.info({ chainId: chain.chainId, lastBlock: lastBlock.toString() }, "Chain listener started");

  // Poll loop.
  setInterval(async () => {
    const state = states.get(chain.chainId);
    if (!state?.running) return;
    try {
      const current = await client.getBlockNumber();
      const toBlock = current > state.lastBlock + BigInt(env.MAX_BLOCK_BATCH)
        ? state.lastBlock + BigInt(env.MAX_BLOCK_BATCH)
        : current;

      if (toBlock <= state.lastBlock) return;

      await pollFactoryEvents(client, chain, state.lastBlock + 1n, toBlock);
      await pollCurveEvents(client, chain, state.lastBlock + 1n, toBlock);

      state.lastBlock = toBlock;
      await prisma.indexerCheckpoint.upsert({
        where: { id: `factory-${chain.chainId}` },
        create: { id: `factory-${chain.chainId}`, chainId: chain.chainId, eventName: "factory", lastBlock: toBlock },
        update: { lastBlock: toBlock },
      });
    } catch (err) {
      logger.error({ chainId: chain.chainId, err }, "Chain listener poll error");
    }
  }, env.POLL_INTERVAL_MS);
}

async function getRecentBlock(client: ReturnType<typeof createPublicClient>): Promise<bigint> {
  const current = await client.getBlockNumber();
  return current > BigInt(env.START_BLOCK_OFFSET) ? current - BigInt(env.START_BLOCK_OFFSET) : 0n;
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
    });
    logger.info({ chainId: chain.chainId, token: args.token, symbol: args.symbol }, "TokenCreated indexed");
  }
}

async function pollCurveEvents(
  client: ReturnType<typeof createPublicClient>,
  chain: ChainConfig,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<void> {
  const events = bondingCurveAbi.filter((a) => a.type === "event" && ["Bought", "Sold", "Graduated"].includes(a.name));
  const logs = (await client.getLogs({
    event: events[0],
    fromBlock,
    toBlock,
  })) as Log[];

  const parsed = parseEventLogs({ abi: bondingCurveAbi, logs: logs as never });
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
      await tradeService.record({
        chainId: chain.chainId,
        txHash: log.transactionHash ?? "0x0",
        tokenAddress: log.address,
        side: log.eventName === "Bought" ? "buy" : "sell",
        trader: getAddress(args.buyer ?? args.seller ?? "0x0"),
        quoteAmount: (args.quoteIn ?? args.quoteOut ?? 0n).toString(),
        tokenAmount: (args.tokensOut ?? args.tokensIn ?? 0n).toString(),
        priceUsd: Number(args.priceAfter ?? 0n) / 1e18,
        feeUsd: Number(args.fee ?? 0n) / 1e18,
        blockNumber: log.blockNumber,
        timestamp: new Date(),
      });
    } else if (log.eventName === "Graduated") {
      const args = log.args as unknown as { token: string; pair: string };
      await tokenService.markGraduated(chain.chainId, getAddress(args.token), getAddress(args.pair));
      logger.info({ chainId: chain.chainId, token: args.token, pair: args.pair }, "Token graduated");
    }
  }
}

export function stopChainListener(chainId: number): void {
  const state = states.get(chainId);
  if (state) state.running = false;
}
