import { prisma } from "../utils/db.js";
import { tokenService } from "./tokenService.js";

interface RecordTradeInput {
  chainId: number;
  txHash: string;
  tokenAddress: string;
  side: "buy" | "sell";
  trader: string;
  quoteAmount: string;
  tokenAmount: string;
  priceUsd: number;
  feeUsd?: number;
  blockNumber: bigint;
  timestamp: Date;
}

export const tradeService = {
  async record(input: RecordTradeInput) {
    const trade = await prisma.trade.upsert({
      where: {
        chainId_txHash_tokenAddress: {
          chainId: input.chainId,
          txHash: input.txHash,
          tokenAddress: input.tokenAddress,
        },
      },
      create: input,
      update: {},
    });

    const token = await tokenService.get(input.chainId, input.tokenAddress);
    if (token) {
      // Authoritative DB-backed 24h volume — parameterized $queryRaw (no injection risk).
      // Numeric SUM avoids float drift from an in-memory accumulator.
      const volume24h = await this.volume24h(input.chainId, input.tokenAddress);
      // marketCap = priceUsd * totalSupply (both scaled by 1e18 on chain). Use BigInt
      // division to avoid precision loss for large totalSupply.
      const supply = BigInt(token.totalSupply);
      const marketCapUsd = (input.priceUsd * Number(supply / 10n ** 12n)) / 1e6;
      await tokenService.updateMarketStats(input.chainId, input.tokenAddress, {
        priceUsd: input.priceUsd,
        marketCapUsd,
        volume24h,
      });
    }
    return trade;
  },

  async volume24h(chainId: number, tokenAddress: string): Promise<number> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    // Tagged-template $queryRaw is fully parameterized (no SQL injection). Postgres
    // SUMs a NUMERIC cast of the wei-scaled string column for exact accumulation.
    const agg = (await prisma.$queryRaw`
      SELECT SUM(CAST("quoteAmount" AS NUMERIC))::text AS "total"
      FROM "Trade"
      WHERE "chainId" = ${chainId} AND "tokenAddress" = ${tokenAddress} AND "timestamp" >= ${since}`) as {
      total: string | null;
    }[];
    return Number(agg[0]?.total ?? "0") / 1e18;
  },

  async list(chainId: number, address: string, limit = 50) {
    const trades = await prisma.trade.findMany({
      where: { chainId, tokenAddress: address },
      orderBy: { timestamp: "desc" },
      take: limit,
    });
    // BigInt → string for JSON serialization (Express res.json can't handle BigInt)
    return trades.map((t: { blockNumber: { toString: () => string } }) => ({
      ...t,
      blockNumber: t.blockNumber.toString(),
    }));
  },

  async priceHistory(chainId: number, address: string, windowHours = 24) {
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    // Limit to 200 trades max to avoid unbounded memory for active tokens.
    const maxPoints = windowHours <= 1 ? 60 : windowHours <= 24 ? 96 : 200;
    const trades = await prisma.trade.findMany({
      where: { chainId, tokenAddress: address, timestamp: { gte: since } },
      orderBy: { timestamp: "asc" },
      select: { timestamp: true, priceUsd: true },
      take: maxPoints,
    });
    return trades.map((t: { timestamp: Date; priceUsd: number }) => ({ time: t.timestamp.getTime(), priceUsd: t.priceUsd }));
  },

  /**
   * OHLC candles + per-candle volume for the given window. Trades are bucketed
   * into fixed-width intervals sized from the window so a chart shows ~60-120
   * candles regardless of timeframe.
   */
  async ohlcHistory(chainId: number, address: string, windowHours = 24) {
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    const trades = await prisma.trade.findMany({
      where: { chainId, tokenAddress: address, timestamp: { gte: since } },
      orderBy: { timestamp: "asc" },
      select: { timestamp: true, priceUsd: true, quoteAmount: true },
      take: 5000,
    });
    if (trades.length === 0) return [];

    // Target ~90 candles across the window; clamp the bucket to >=1s.
    const bucketMs = Math.max(1000, Math.floor((windowHours * 60 * 60 * 1000) / 90));

    interface Candle { time: number; open: number; high: number; low: number; close: number; volume: number }
    const byBucket = new Map<number, Candle>();
    for (const t of trades) {
      const ms = t.timestamp.getTime();
      const bucket = Math.floor(ms / bucketMs) * bucketMs;
      const price = t.priceUsd ?? 0;
      const vol = Number(t.quoteAmount) / 1e18;
      const existing = byBucket.get(bucket);
      if (!existing) {
        byBucket.set(bucket, { time: bucket, open: price, high: price, low: price, close: price, volume: vol });
      } else {
        existing.high = Math.max(existing.high, price);
        existing.low = Math.min(existing.low, price);
        existing.close = price;
        existing.volume += vol;
      }
    }

    return [...byBucket.values()].sort((a, b) => a.time - b.time);
  },
};
