import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../src/utils/db.js";
import { holderService } from "../src/services/holderService.js";
import { resetDb, addr, CHAIN_ID } from "./helpers/db.js";

describe("holderService.refreshFromTrades", () => {
  const tokenNoHolders = "0x3333333333333333333333333333333333333333";
  const totalSupply = "1000000000000000000000000000";

  beforeEach(async () => {
    await resetDb();
    await prisma.token.create({
      data: {
        chainId: CHAIN_ID,
        address: tokenNoHolders,
        name: "Fallback Token",
        symbol: "FB",
        supplyTier: 0,
        curveShape: 0,
        totalSupply,
        creator: addr.creator,
      },
    });
    await prisma.trade.createMany({
      data: [
        {
          txHash: "0xfb1",
          chainId: CHAIN_ID,
          tokenAddress: tokenNoHolders,
          side: "buy",
          trader: addr.trader,
          quoteAmount: "10000000000000000",
          tokenAmount: "120000000000000000000000",
          priceUsd: 0.0004,
          feeUsd: 0.1,
          blockNumber: 3000n,
          timestamp: new Date(),
        },
        {
          txHash: "0xfb2",
          chainId: CHAIN_ID,
          tokenAddress: tokenNoHolders,
          side: "buy",
          trader: addr.referrer,
          quoteAmount: "5000000000000000",
          tokenAmount: "30000000000000000000000",
          priceUsd: 0.0005,
          feeUsd: 0.05,
          blockNumber: 3001n,
          timestamp: new Date(),
        },
        {
          // Same trader sells part back — net = 120e21 - 60e21 = 60e21.
          txHash: "0xfb3",
          chainId: CHAIN_ID,
          tokenAddress: tokenNoHolders,
          side: "sell",
          trader: addr.trader,
          quoteAmount: "3000000000000000",
          tokenAmount: "60000000000000000000000",
          priceUsd: 0.0005,
          feeUsd: 0.03,
          blockNumber: 3002n,
          timestamp: new Date(),
        },
      ],
    });
  });

  it("derives holder balances and count from trade records", async () => {
    const count = await holderService.refreshFromTrades(CHAIN_ID, tokenNoHolders, totalSupply);
    expect(count).toBe(2);

    const rows = await prisma.holder.findMany({
      where: { chainId: CHAIN_ID, tokenAddress: tokenNoHolders },
      orderBy: { balance: "desc" },
    });
    expect(rows).toHaveLength(2);

    const trader = rows.find((r) => r.address.toLowerCase() === addr.trader.toLowerCase())!;
    const referrer = rows.find((r) => r.address.toLowerCase() === addr.referrer.toLowerCase())!;

    // trader net = 120e21 - 60e21 = 60e21
    expect(trader.balance).toBe("60000000000000000000000");
    // referrer net = 30e21
    expect(referrer.balance).toBe("30000000000000000000000");

    // percentage is computed as a non-negative number (same formula as the
    // on-chain listener; precision is bounded by integer division).
    expect(trader.percentage).toBeGreaterThanOrEqual(0);
    expect(referrer.percentage).toBeGreaterThanOrEqual(0);
  });

  it("returns 0 when there are no trades", async () => {
    await resetDb();
    await prisma.token.create({
      data: {
        chainId: CHAIN_ID,
        address: tokenNoHolders,
        name: "Fallback Token",
        symbol: "FB",
        supplyTier: 0,
        curveShape: 0,
        totalSupply,
        creator: addr.creator,
      },
    });
    const count = await holderService.refreshFromTrades(CHAIN_ID, tokenNoHolders, totalSupply);
    expect(count).toBe(0);
  });
});
