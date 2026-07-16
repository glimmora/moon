/**
 * Frontend mirror of the on-chain bonding-curve math.
 * Constants MUST stay in sync with contracts/src/BondingCurve.sol.
 */

export enum CurveShape {
  LINEAR = 0,
  EXPONENTIAL = 1,
  LOGARITHMIC = 2,
}

export const START_PRICE = 270_000_000n;
export const END_PRICE = 270_000_000_000n;
export const BASE_REAL_TOKEN_PER_1B = 793_100_000n * 10n ** 18n;
export const BASE_TOTAL_SUPPLY_PER_1B = 1_000_000_000n * 10n ** 18n;
export const VIRTUAL_QUOTE_EXP_BASE = 30n * 10n ** 18n;
export const VIRTUAL_TOKEN_EXP_BASE = 1_073_000_000n * 10n ** 18n;

const ONE_B = 1_000_000_000n * 10n ** 18n;
const WAD = 10n ** 18n;
const WAD2 = 10n ** 36n;

export interface CurveReserves {
  realToken: bigint;
  realQuote: bigint;
  virtualToken: bigint;
  virtualQuote: bigint;
  totalSupplyInit: bigint;
  curveShape: CurveShape;
  creationBlock: bigint;
  currentBlock: bigint;
}

export function tierMultiplier(tier: number): bigint {
  if (tier === 0) return 1n;
  if (tier === 1) return 10n;
  if (tier === 2) return 100n;
  return 1n;
}

export function totalSupplyForTier(tier: number): bigint {
  return ONE_B * tierMultiplier(tier);
}

export function realReservesForTier(tier: number): bigint {
  return BASE_REAL_TOKEN_PER_1B * tierMultiplier(tier);
}

export function sqrt1e36(x: bigint): bigint {
  if (x === 0n) return 0n;
  const scaled = x / WAD;
  return sqrt1e18(scaled);
}

export function sqrt1e18(x: bigint): bigint {
  if (x === 0n) return 0n;
  let z = (x / WAD + 1n) / 2n * WAD;
  let y = x;
  for (let i = 0; i < 40; i++) {
    if (z >= y) break;
    y = z;
    z = (x * WAD) / z + z / 2n;
  }
  return y;
}

export function pow1_5(x: bigint): bigint {
  if (x === 0n) return 0n;
  if (x === WAD) return WAD;
  return (x * sqrt1e18(x)) / WAD;
}

export function currentFee(creationBlock: bigint, currentBlock: bigint): bigint {
  const elapsed = currentBlock - creationBlock;
  const BASE_FEE = 125n * 10n ** 14n;
  const XMODE_B0 = 99n * 10n ** 16n;
  if (elapsed >= 6n) return BASE_FEE;
  const decay = ((XMODE_B0 - BASE_FEE) * elapsed) / 6n;
  return XMODE_B0 - decay;
}

export function getBuyOut(r: CurveReserves, quoteIn: bigint): { tokensOut: bigint; fee: bigint } {
  const fee = currentFee(r.creationBlock, r.currentBlock);
  const quoteAfterFee = quoteIn - (quoteIn * fee) / WAD;
  const tokens = buyTokenOut(r, quoteAfterFee);
  return { tokensOut: tokens, fee };
}

function buyTokenOut(r: CurveReserves, quoteIn: bigint): bigint {
  const vq = r.virtualQuote + quoteIn;
  if (r.curveShape === CurveShape.LINEAR) {
    const ratio = (r.virtualQuote * WAD2) / vq;
    const sq = sqrt1e18(ratio / WAD);
    return (r.virtualToken * (WAD - sq)) / WAD;
  }
  if (r.curveShape === CurveShape.EXPONENTIAL) {
    const ratio = (r.virtualQuote * WAD) / vq;
    return (r.virtualToken * (WAD - ratio)) / WAD;
  }
  const ratio = (r.virtualQuote * WAD) / vq;
  const p = pow1_5(ratio);
  return (r.virtualToken * (WAD - p)) / WAD;
}

export function getSellOut(
  r: CurveReserves,
  tokensIn: bigint,
): { grossQuoteOut: bigint; fee: bigint; netQuoteOut: bigint } {
  const fee = currentFee(r.creationBlock, r.currentBlock);
  const grossQuoteOut = sellQuoteOut(r, tokensIn);
  const netQuoteOut = grossQuoteOut - (grossQuoteOut * fee) / WAD;
  return { grossQuoteOut, fee, netQuoteOut };
}

function sellQuoteOut(r: CurveReserves, tokensIn: bigint): bigint {
  const vt = r.virtualToken + tokensIn;
  if (r.curveShape === CurveShape.LINEAR) {
    const ratio = (r.virtualToken * WAD) / vt;
    const sq = (ratio * ratio) / WAD;
    return (r.virtualQuote * (WAD - sq)) / WAD;
  }
  if (r.curveShape === CurveShape.EXPONENTIAL) {
    const ratio = (r.virtualToken * WAD) / vt;
    return (r.virtualQuote * (WAD - ratio)) / WAD;
  }
  const ratio = (r.virtualToken * WAD) / vt;
  const p = pow1_5(ratio);
  return (r.virtualQuote * (WAD - p)) / WAD;
}

export function price(r: CurveReserves): bigint {
  if (r.virtualToken === 0n) return START_PRICE;
  const p = (r.virtualQuote * WAD) / r.virtualToken;
  if (p < START_PRICE) return START_PRICE;
  if (p > END_PRICE) return END_PRICE;
  return p;
}
