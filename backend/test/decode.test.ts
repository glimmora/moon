import { describe, it, expect } from "vitest";
import { encodeEventTopics, encodeAbiParameters, parseEventLogs, getAbiItem, type AbiEvent } from "viem";
import { bondingCurveAbi } from "../src/abi/BondingCurve.js";
import { moonFactoryAbi } from "../src/abi/MoonFactory.js";

/**
 * These tests assert that the on-chain event shapes the chain listener depends
 * on decode exactly as the listener expects (arg names + types). If a contract
 * ABI drifts, these fail before the indexer silently mis-maps fields.
 */

function fakeLog(topics: readonly `0x${string}`[], data: `0x${string}`) {
  return {
    address: "0x000000000000000000000000000000000000c0e0" as `0x${string}`,
    topics,
    data,
    blockNumber: 123n,
    blockHash: ("0x" + "11".repeat(32)) as `0x${string}`,
    logIndex: 0,
    transactionHash: ("0x" + "22".repeat(32)) as `0x${string}`,
    transactionIndex: 0,
    removed: false,
  };
}

function encodeLog(abi: readonly unknown[], eventName: string, args: Record<string, unknown>) {
  const event = getAbiItem({ abi: abi as never, name: eventName as never }) as AbiEvent;
  const topics = encodeEventTopics({ abi: abi as never, eventName: eventName as never, args: args as never });
  const nonIndexed = event.inputs.filter((i) => !("indexed" in i && i.indexed));
  const data =
    nonIndexed.length > 0
      ? encodeAbiParameters(nonIndexed, nonIndexed.map((i) => args[i.name as string]))
      : "0x";
  return fakeLog(topics as `0x${string}`[], data as `0x${string}`);
}

describe("BondingCurve event decoding", () => {
  it("decodes Bought with buyer/quoteIn/tokensOut/fee/priceAfter", () => {
    const log = encodeLog(bondingCurveAbi, "Bought", {
      buyer: "0x00000000000000000000000000000000000000b2",
      quoteIn: 10n ** 16n,
      tokensOut: 120n * 10n ** 21n,
      fee: 10n ** 14n,
      priceAfter: 4n * 10n ** 14n,
    });
    const [parsed] = parseEventLogs({ abi: bondingCurveAbi, logs: [log] });
    expect(parsed.eventName).toBe("Bought");
    const a = parsed.args as Record<string, unknown>;
    expect((a.buyer as string).toLowerCase()).toBe("0x00000000000000000000000000000000000000b2");
    expect(a.quoteIn).toBe(10n ** 16n);
    expect(a.tokensOut).toBe(120n * 10n ** 21n);
    expect(a.priceAfter).toBe(4n * 10n ** 14n);
  });

  it("decodes Sold with seller/tokensIn/quoteOut", () => {
    const log = encodeLog(bondingCurveAbi, "Sold", {
      seller: "0x00000000000000000000000000000000000000b2",
      tokensIn: 60n * 10n ** 21n,
      quoteOut: 5n * 10n ** 15n,
      fee: 5n * 10n ** 13n,
      priceAfter: 5n * 10n ** 14n,
    });
    const [parsed] = parseEventLogs({ abi: bondingCurveAbi, logs: [log] });
    expect(parsed.eventName).toBe("Sold");
    const a = parsed.args as Record<string, unknown>;
    expect(a.tokensIn).toBe(60n * 10n ** 21n);
    expect(a.quoteOut).toBe(5n * 10n ** 15n);
  });

  it("decodes Graduated with token/pair", () => {
    const log = encodeLog(bondingCurveAbi, "Graduated", {
      token: "0x1111111111111111111111111111111111111111",
      pair: "0x9999999999999999999999999999999999999999",
      lpAmount: 1n,
      tokenLiquidity: 2n,
      quoteLiquidity: 3n,
    });
    const [parsed] = parseEventLogs({ abi: bondingCurveAbi, logs: [log] });
    expect(parsed.eventName).toBe("Graduated");
    const a = parsed.args as Record<string, unknown>;
    expect((a.token as string).toLowerCase()).toBe("0x1111111111111111111111111111111111111111");
    expect((a.pair as string).toLowerCase()).toBe("0x9999999999999999999999999999999999999999");
  });
});

describe("MoonFactory event decoding", () => {
  it("decodes TokenCreated with all indexed + data fields", () => {
    const log = encodeLog(moonFactoryAbi, "TokenCreated", {
      token: "0x1111111111111111111111111111111111111111",
      curve: "0x000000000000000000000000000000000000c0e0",
      creator: "0x00000000000000000000000000000000000000a1",
      name: "Alpha Coin",
      symbol: "ALPHA",
      supplyTier: 0,
      curveShape: 1,
      totalSupply: 10n ** 27n,
      imageUrl: "https://img/alpha.png",
      description: "First test token",
    });
    const [parsed] = parseEventLogs({ abi: moonFactoryAbi, logs: [log] });
    expect(parsed.eventName).toBe("TokenCreated");
    const a = parsed.args as Record<string, unknown>;
    expect(a.name).toBe("Alpha Coin");
    expect(a.symbol).toBe("ALPHA");
    expect(a.supplyTier).toBe(0);
    expect(a.curveShape).toBe(1);
    expect(a.totalSupply).toBe(10n ** 27n);
    expect(a.imageUrl).toBe("https://img/alpha.png");
  });
});
