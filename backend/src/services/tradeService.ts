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

    // Update token volume + price (rolling estimate).
    const token = await tokenService.get(input.chainId, input.tokenAddress);
    if (token) {
      const newVolume = token.volume24h + Number(input.quoteAmount) / 1e18;
      await tokenService.updateMarketStats(input.chainId, input.tokenAddress, {
        priceUsd: input.priceUsd,
        marketCapUsd: input.priceUsd * (Number(token.totalSupply) / 1e18),
        volume24h: newVolume,
      });
    }
    return trade;
  },

  async list(chainId: number, address: string, limit = 50) {
    return prisma.trade.findMany({
      where: { chainId, tokenAddress: address },
      orderBy: { timestamp: "desc" },
      take: limit,
    });
  },

  async priceHistory(chainId: number, address: string, windowHours = 24) {
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    const trades = await prisma.trade.findMany({
      where: { chainId, tokenAddress: address, timestamp: { gte: since } },
      orderBy: { timestamp: "asc" },
      select: { timestamp: true, priceUsd: true },
    });
    return trades.map((t) => ({ time: t.timestamp.getTime(), priceUsd: t.priceUsd }));
  },
};
