import { describe, it, expect } from "vitest";
import {
  tierMultiplier,
  totalSupplyForTier,
  realReservesForTier,
  sqrt1e18,
  pow1_5,
  currentFee,
  price,
  getBuyOut,
  getSellOut,
  CurveShape,
  START_PRICE,
  END_PRICE,
} from "../src/lib/curve";

describe("tierMultiplier", () => {
  it("returns 1 for tier 0", () => expect(tierMultiplier(0)).toBe(1n));
  it("returns 10 for tier 1", () => expect(tierMultiplier(1)).toBe(10n));
  it("returns 100 for tier 2", () => expect(tierMultiplier(2)).toBe(100n));
  it("returns 1 for unknown tier", () => expect(tierMultiplier(99)).toBe(1n));
});

describe("totalSupplyForTier", () => {
  it("returns 1B for tier 0", () => expect(totalSupplyForTier(0)).toBe(1_000_000_000n * 10n ** 18n));
  it("returns 10B for tier 1", () => expect(totalSupplyForTier(1)).toBe(10_000_000_000n * 10n ** 18n));
});

describe("realReservesForTier", () => {
  it("returns base reserves for tier 0", () => {
    const expected = 793_100_000n * 10n ** 18n;
    expect(realReservesForTier(0)).toBe(expected);
  });
  it("scales with tier", () => {
    expect(realReservesForTier(1)).toBe(realReservesForTier(0) * 10n);
  });
});

describe("sqrt1e18", () => {
  const WAD = 10n ** 18n;

  it("returns 0 for 0", () => expect(sqrt1e18(0n)).toBe(0n));
  it("returns 1e18 for 1e18", () => expect(sqrt1e18(WAD)).toBe(WAD));
  it("returns 2e18 for 4e18", () => {
    const result = sqrt1e18(4n * WAD);
    expect(result).toBe(2n * WAD);
  });
  it("is monotonic", () => {
    const a = sqrt1e18(100n * WAD);
    const b = sqrt1e18(101n * WAD);
    expect(b >= a).toBe(true);
  });
  it("handles large values", () => {
    const result = sqrt1e18(10n ** 24n);
    expect(result).toBe(1414213562373095048801n);
  });
});

describe("pow1_5", () => {
  const WAD = 10n ** 18n;

  it("returns 0 for 0", () => expect(pow1_5(0n)).toBe(0n));
  it("returns 1e18 for 1e18", () => expect(pow1_5(WAD)).toBe(WAD));
  it("is greater than sqrt for values > 1", () => {
    const sqrt = sqrt1e18(4n * WAD);
    const p = pow1_5(4n * WAD);
    expect(p > sqrt).toBe(true);
  });
});

describe("currentFee", () => {
  it("returns base fee after 6+ blocks", () => {
    const fee = currentFee(10n, 20n);
    expect(fee).toBe(125n * 10n ** 14n);
  });

  it("returns anti-sniper fee at block 0", () => {
    const fee = currentFee(10n, 10n);
    expect(fee).toBe(99n * 10n ** 16n);
  });

  it("decays linearly between 0 and 6 blocks", () => {
    const fee1 = currentFee(10n, 11n);
    const fee3 = currentFee(10n, 13n);
    expect(fee1 > fee3).toBe(true);
    expect(fee1 > 125n * 10n ** 14n).toBe(true);
    expect(fee3 > 125n * 10n ** 14n).toBe(true);
  });
});

describe("price", () => {
  const WAD = 10n ** 18n;
  const baseReserves = {
    realToken: 0n,
    realQuote: 0n,
    virtualToken: 1_073_000_000n * WAD,
    virtualQuote: 30n * WAD,
    totalSupplyInit: 1_000_000_000n * WAD,
    curveShape: CurveShape.LINEAR,
    creationBlock: 0n,
    currentBlock: 100n,
  };

  it("returns START_PRICE when virtualToken is 0", () => {
    expect(price({ ...baseReserves, virtualToken: 0n })).toBe(START_PRICE);
  });

  it("computes a price from virtual reserves", () => {
    const p = price(baseReserves);
    expect(p).toBeGreaterThan(START_PRICE);
    expect(p).toBeLessThan(END_PRICE);
  });

  it("clamps to START_PRICE", () => {
    const reserves = { ...baseReserves, virtualQuote: 1n };
    expect(price(reserves)).toBe(START_PRICE);
  });

  it("clamps to END_PRICE", () => {
    const reserves = { ...baseReserves, virtualQuote: END_PRICE * 2n, virtualToken: 1n * WAD };
    expect(price(reserves)).toBe(END_PRICE);
  });
});

describe("getBuyOut", () => {
  const WAD = 10n ** 18n;
  const base = {
    realToken: 0n,
    realQuote: 0n,
    virtualToken: 1_073_000_000n * WAD,
    virtualQuote: 30n * WAD,
    totalSupplyInit: 1_000_000_000n * WAD,
    curveShape: CurveShape.LINEAR,
    creationBlock: 0n,
    currentBlock: 100n,
  };

  it("returns positive tokensOut for a valid buy", () => {
    const result = getBuyOut({ ...base, curveShape: CurveShape.EXPONENTIAL }, 1n * WAD);
    expect(result.tokensOut).toBeGreaterThan(0n);
    expect(result.fee).toBeGreaterThan(0n);
  });

  it("shows diminishing returns — larger buys get worse price", () => {
    const small = getBuyOut({ ...base, curveShape: CurveShape.EXPONENTIAL }, 1n * WAD);
    const large = getBuyOut({ ...base, curveShape: CurveShape.EXPONENTIAL }, 10n * WAD);
    const smallPrice = (1n * WAD * WAD) / small.tokensOut;
    const largePrice = (10n * WAD * WAD) / large.tokensOut;
    expect(largePrice).toBeGreaterThan(smallPrice);
  });
});

describe("getSellOut", () => {
  const WAD = 10n ** 18n;
  const base = {
    realToken: 0n,
    realQuote: 0n,
    virtualToken: 1_073_000_000n * WAD,
    virtualQuote: 30n * WAD,
    totalSupplyInit: 1_000_000_000n * WAD,
    curveShape: CurveShape.EXPONENTIAL,
    creationBlock: 0n,
    currentBlock: 100n,
  };

  it("returns positive netQuoteOut for a valid sell", () => {
    const result = getSellOut(base, 1_000_000n * WAD);
    expect(result.grossQuoteOut).toBeGreaterThan(0n);
    expect(result.netQuoteOut).toBeGreaterThan(0n);
    expect(result.netQuoteOut).toBeLessThan(result.grossQuoteOut);
    expect(result.fee).toBeGreaterThan(0n);
  });

  it("works for exponential curve", () => {
    const exp = getSellOut({ ...base, curveShape: CurveShape.EXPONENTIAL }, 1_000_000n * WAD);
    expect(exp.netQuoteOut).toBeGreaterThan(0n);
  });
});
