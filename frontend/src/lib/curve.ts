/**
 * Frontend mirror of the on-chain bonding-curve math.
 * Constants MUST stay in sync with contracts/src/BondingCurve.sol.
 *
 * AUDIT-FIX: All three curve shapes now use the same constant-product invariant
 * (x·y=k) per the contract audit fix. The selector determines initial reserve
 * ratios only; buy/sell math is symmetric for every shape.
 */

export enum CurveShape {
  LINEAR = 0,
  EXPONENTIAL = 1,
  LOGARITHMIC = 2,
}

/** Graduation threshold in ETH per supply tier (0=1B, 1=10B, 2=100B). */
export const GRADUATION_THRESHOLDS = [50, 500, 5000] as const;

export const START_PRICE = 270_000_000n;
export const END_PRICE = 270_000_000_000n;
export const BASE_REAL_TOKEN_PER_1B = 793_100_000n * 10n ** 18n;
export const BASE_TOTAL_SUPPLY_PER_1B = 1_000_000_000n * 10n ** 18n;
export const VIRTUAL_QUOTE_EXP_BASE = 30n * 10n ** 18n;
export const VIRTUAL_TOKEN_EXP_BASE = 1_073_000_000n * 10n ** 18n;

const ONE_B = 1_000_000_000n * 10n ** 18n;
const WAD = 10n ** 18n;

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
  const tokens = buyTokenOut(r.virtualToken, r.virtualQuote, quoteAfterFee);
  return { tokensOut: tokens, fee };
}

function buyTokenOut(vToken: bigint, vQuote: bigint, quoteIn: bigint): bigint {
  const newVQuote = vQuote + quoteIn;
  const tokenOut = (vToken * quoteIn) / newVQuote;
  return tokenOut >= vToken ? vToken - 1n : tokenOut;
}

export function getSellOut(
  r: CurveReserves,
  tokensIn: bigint,
): { grossQuoteOut: bigint; fee: bigint; netQuoteOut: bigint } {
  const fee = currentFee(r.creationBlock, r.currentBlock);
  const grossQuoteOut = sellQuoteOut(r.virtualQuote, r.virtualToken, tokensIn);
  const netQuoteOut = grossQuoteOut - (grossQuoteOut * fee) / WAD;
  return { grossQuoteOut, fee, netQuoteOut };
}

function sellQuoteOut(vQuote: bigint, vToken: bigint, tokensIn: bigint): bigint {
  const newVToken = vToken + tokensIn;
  const quoteOut = (vQuote * tokensIn) / newVToken;
  return quoteOut >= vQuote ? vQuote - 1n : quoteOut;
}

export function price(r: CurveReserves): bigint {
  if (r.virtualToken === 0n) return START_PRICE;
  const p = (r.virtualQuote * WAD) / r.virtualToken;
  if (p < START_PRICE) return START_PRICE;
  if (p > END_PRICE) return END_PRICE;
  return p;
}
