import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { getAddress } from "viem";
import { resetDb, addr, CHAIN_ID } from "./helpers/db.js";

const { prisma } = await import("../src/utils/db.js");
const { tokenService } = await import("../src/services/tokenService.js");
const { tradeService } = await import("../src/services/tradeService.js");
const { referralService } = await import("../src/services/referralService.js");

const TOKEN = getAddress(addr.tokenA);
const CREATOR = getAddress(addr.creator);
const TRADER = getAddress(addr.trader);
const REFERRER = getAddress(addr.referrer);

async function baseToken() {
  await tokenService.upsert({
    chainId: CHAIN_ID,
    address: TOKEN,
    curve: getAddress("0x000000000000000000000000000000000000c0e0"),
    name: "Svc Coin",
    symbol: "SVC",
    imageUrl: "",
    description: "",
    supplyTier: 0,
    curveShape: 0,
    totalSupply: "1000000000000000000000000000",
    creator: CREATOR,
  });
}

beforeAll(async () => {
  await resetDb();
});
afterAll(async () => {
  await prisma.$disconnect();
});
beforeEach(async () => {
  await resetDb();
});

describe("tokenService", () => {
  it("upsert is idempotent on (chainId,address)", async () => {
    await baseToken();
    await baseToken();
    const all = await prisma.token.findMany({ where: { address: TOKEN } });
    expect(all.length).toBe(1);
  });

  it("markGraduated sets graduated + dexPair", async () => {
    await baseToken();
    const pair = getAddress("0x000000000000000000000000000000000000dEaD");
    await tokenService.markGraduated(CHAIN_ID, TOKEN, pair);
    const t = await tokenService.get(CHAIN_ID, TOKEN);
    expect(t?.graduated).toBe(true);
    expect(t?.dexPair).toBe(pair);
  });

  it("search matches name, symbol, address and creator", async () => {
    await baseToken();
    expect((await tokenService.search("Svc")).length).toBeGreaterThanOrEqual(1);
    expect((await tokenService.search("SVC")).length).toBeGreaterThanOrEqual(1);
    expect((await tokenService.search(TOKEN)).length).toBeGreaterThanOrEqual(1);
    expect((await tokenService.search(CREATOR)).length).toBeGreaterThanOrEqual(1);
  });
});

describe("tradeService", () => {
  it("record is idempotent on (chainId,txHash,tokenAddress)", async () => {
    await baseToken();
    const input = {
      chainId: CHAIN_ID,
      txHash: "0xdup",
      tokenAddress: TOKEN,
      side: "buy" as const,
      trader: TRADER,
      quoteAmount: "10000000000000000",
      tokenAmount: "120000000000000000000000",
      priceUsd: 0.0004,
      feeUsd: 0.1,
      blockNumber: 1n,
      timestamp: new Date(),
    };
    await tradeService.record(input);
    await tradeService.record(input);
    const rows = await prisma.trade.findMany({ where: { txHash: "0xdup" } });
    expect(rows.length).toBe(1);
  });

  it("volume24h sums quote amounts within the window", async () => {
    await baseToken();
    const now = Date.now();
    await tradeService.record({
      chainId: CHAIN_ID,
      txHash: "0xv1",
      tokenAddress: TOKEN,
      side: "buy",
      trader: TRADER,
      quoteAmount: "1000000000000000000",
      tokenAmount: "1",
      priceUsd: 1,
      blockNumber: 1n,
      timestamp: new Date(now - 1000),
    });
    await tradeService.record({
      chainId: CHAIN_ID,
      txHash: "0xv2",
      tokenAddress: TOKEN,
      side: "buy",
      trader: TRADER,
      quoteAmount: "2000000000000000000",
      tokenAmount: "1",
      priceUsd: 1,
      blockNumber: 2n,
      timestamp: new Date(now - 2000),
    });
    const vol = await tradeService.volume24h(CHAIN_ID, TOKEN);
    expect(vol).toBeCloseTo(3, 6);
  });

  it("volume24h excludes trades older than 24h", async () => {
    await baseToken();
    await tradeService.record({
      chainId: CHAIN_ID,
      txHash: "0xold",
      tokenAddress: TOKEN,
      side: "buy",
      trader: TRADER,
      quoteAmount: "5000000000000000000",
      tokenAmount: "1",
      priceUsd: 1,
      blockNumber: 1n,
      timestamp: new Date(Date.now() - 25 * 3600_000),
    });
    const vol = await tradeService.volume24h(CHAIN_ID, TOKEN);
    expect(vol).toBe(0);
  });
});

describe("referralService", () => {
  it("accumulates volume/rewards/count across records", async () => {
    await referralService.record(CHAIN_ID, REFERRER, 100n, 5n);
    await referralService.record(CHAIN_ID, REFERRER, 200n, 10n);
    const stats = await referralService.statsFor(REFERRER);
    expect(stats.length).toBe(1);
    expect(stats[0].volume).toBe("300");
    expect(stats[0].rewards).toBe("15");
    expect(stats[0].count).toBe(2);
  });

  it("accumulates creator fees per (creator,quoteAsset)", async () => {
    const quote = getAddress("0x0000000000000000000000000000000000000000");
    await referralService.recordCreatorFee(CHAIN_ID, CREATOR, quote, 1000n);
    await referralService.recordCreatorFee(CHAIN_ID, CREATOR, quote, 2500n);
    const fees = await referralService.creatorFeesFor(CREATOR);
    expect(fees.length).toBe(1);
    expect(fees[0].amount).toBe("3500");
  });
});
