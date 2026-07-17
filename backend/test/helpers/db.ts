import { prisma } from "../../src/utils/db.js";

const CHAIN_ID = 11155111;

/** Wipe all tables in the isolated test schema between suites. */
export async function resetDb(): Promise<void> {
  // Order respects FK constraints (children first).
  await prisma.trade.deleteMany();
  await prisma.holder.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.referralStat.deleteMany();
  await prisma.creatorFeeBalance.deleteMany();
  await prisma.indexerCheckpoint.deleteMany();
  await prisma.token.deleteMany();
}

export const addr = {
  tokenA: "0x1111111111111111111111111111111111111111",
  tokenB: "0x2222222222222222222222222222222222222222",
  creator: "0x00000000000000000000000000000000000000A1",
  trader: "0x00000000000000000000000000000000000000B2",
  referrer: "0x00000000000000000000000000000000000000C3",
  holder1: "0x00000000000000000000000000000000000000D4",
  holder2: "0x00000000000000000000000000000000000000E5",
};

/** Seed a deterministic dataset used by the API integration tests. */
export async function seed(): Promise<void> {
  await resetDb();

  await prisma.token.create({
    data: {
      chainId: CHAIN_ID,
      address: addr.tokenA,
      name: "Alpha Coin",
      symbol: "ALPHA",
      imageUrl: "https://img/alpha.png",
      description: "First test token",
      supplyTier: 0,
      curveShape: 1,
      totalSupply: "1000000000000000000000000000",
      creator: addr.creator,
      graduated: false,
      priceUsd: 0.0005,
      marketCapUsd: 5000,
      holderCount: 2,
      volume24h: 1234.5,
    },
  });

  await prisma.token.create({
    data: {
      chainId: CHAIN_ID,
      address: addr.tokenB,
      name: "Beta Moon",
      symbol: "BETA",
      imageUrl: "https://img/beta.png",
      description: "Second test token graduated",
      supplyTier: 1,
      curveShape: 0,
      totalSupply: "500000000000000000000000000",
      creator: addr.creator,
      graduated: true,
      dexPair: "0x9999999999999999999999999999999999999999",
      priceUsd: 0.002,
      marketCapUsd: 20000,
      holderCount: 1,
      volume24h: 9876.5,
    },
  });

  const now = Date.now();
  await prisma.trade.createMany({
    data: [
      {
        txHash: "0xaaa1",
        chainId: CHAIN_ID,
        tokenAddress: addr.tokenA,
        side: "buy",
        trader: addr.trader,
        quoteAmount: "10000000000000000",
        tokenAmount: "120000000000000000000000",
        priceUsd: 0.0004,
        feeUsd: 0.1,
        blockNumber: BigInt(1000),
        timestamp: new Date(now - 3600_000),
      },
      {
        txHash: "0xaaa2",
        chainId: CHAIN_ID,
        tokenAddress: addr.tokenA,
        side: "sell",
        trader: addr.trader,
        quoteAmount: "5000000000000000",
        tokenAmount: "60000000000000000000000",
        priceUsd: 0.0005,
        feeUsd: 0.05,
        blockNumber: BigInt(1001),
        timestamp: new Date(now - 1800_000),
      },
      {
        txHash: "0xbbb1",
        chainId: CHAIN_ID,
        tokenAddress: addr.tokenB,
        side: "buy",
        trader: addr.referrer,
        quoteAmount: "20000000000000000",
        tokenAmount: "200000000000000000000000",
        priceUsd: 0.002,
        feeUsd: 0.2,
        blockNumber: BigInt(2000),
        timestamp: new Date(now - 600_000),
      },
    ],
  });

  await prisma.holder.createMany({
    data: [
      {
        chainId: CHAIN_ID,
        tokenAddress: addr.tokenA,
        address: addr.holder1,
        balance: "80000000000000000000000",
        percentage: 66.6,
        isContract: false,
      },
      {
        chainId: CHAIN_ID,
        tokenAddress: addr.tokenA,
        address: addr.holder2,
        balance: "40000000000000000000000",
        percentage: 33.3,
        isContract: true,
      },
      {
        chainId: CHAIN_ID,
        tokenAddress: addr.tokenB,
        address: addr.holder1,
        balance: "200000000000000000000000",
        percentage: 100,
        isContract: false,
      },
    ],
  });

  await prisma.referralStat.create({
    data: {
      referrer: addr.referrer,
      chainId: CHAIN_ID,
      volume: "20000000000000000",
      rewards: "200000000000000",
      count: 1,
    },
  });

  await prisma.creatorFeeBalance.create({
    data: {
      creator: addr.creator,
      chainId: CHAIN_ID,
      quoteAsset: "0x0000000000000000000000000000000000000000",
      amount: "1500000000000000",
    },
  });
}

export { CHAIN_ID };
