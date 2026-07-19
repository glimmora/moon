/**
 * Formatting helpers — all on-chain values use 1e18 fixed point.
 */
import { GRADUATION_THRESHOLDS } from "./curve";

export function formatToken(amount: bigint, decimals = 18, displayDecimals = 2): string {
  if (amount === 0n) return "0";
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  const wholeStr = whole.toLocaleString("en-US");
  if (fraction === 0n) return wholeStr;
  const fracStr = fraction.toString().padStart(decimals, "0").slice(0, displayDecimals);
  return `${wholeStr}.${fracStr}`;
}

export function formatCompactToken(amount: bigint, decimals = 18): string {
  if (amount === 0n) return "0";
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  const wholeNum = Number(whole);
  
  if (Math.abs(wholeNum) >= 1000) {
    const fracStr = fraction.toString().padStart(decimals, "0").slice(0, 3);
    return `${wholeNum.toLocaleString("en-US")}.${fracStr}`;
  }
  
  const fracStr = fraction.toString().padStart(decimals, "0");
  return `${wholeNum.toLocaleString("en-US")}.${fracStr}`;
}

const SUBSCRIPT = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];

function toSubscript(n: number): string {
  return String(n)
    .split("")
    .map((d) => SUBSCRIPT[Number(d)])
    .join("");
}

export function formatPrice(quotePerToken: bigint): string {
  const usd = Number(quotePerToken) / 1e18;
  if (usd === 0) return "$0.0000";
  if (usd >= 1) return `$${usd.toFixed(4)}`;
  if (usd >= 0.0001) return `$${usd.toFixed(6)}`;
  // Very small prices: compress leading zeros using subscript notation, e.g. $0.0₇378
  const decimals = usd.toFixed(20).split(".")[1] ?? "";
  const firstNonZero = decimals.search(/[1-9]/);
  if (firstNonZero < 0) return "$0.0000";
  const zeros = firstNonZero;
  const significant = decimals.slice(firstNonZero, firstNonZero + 4).replace(/0+$/, "") || "0";
  return `$0.0${toSubscript(zeros)}${significant}`;
}

/**
 * Human-readable price for a plain USD number (not 1e18 fixed point).
 * Mirrors `formatPrice`: fixed decimals for larger values, subscript
 * compression of leading zeros for very small prices (e.g. $0.0₇378).
 */
export function formatPriceUsd(usd: number): string {
  if (!Number.isFinite(usd) || usd === 0) return "$0.0000";
  const abs = Math.abs(usd);
  const sign = usd < 0 ? "-" : "";
  if (abs >= 1) return `${sign}$${abs.toFixed(4)}`;
  if (abs >= 0.0001) return `${sign}$${abs.toFixed(6)}`;
  const decimals = abs.toFixed(20).split(".")[1] ?? "";
  const firstNonZero = decimals.search(/[1-9]/);
  if (firstNonZero < 0) return "$0.0000";
  const zeros = firstNonZero;
  const significant = decimals.slice(firstNonZero, firstNonZero + 4).replace(/0+$/, "") || "0";
  return `${sign}$0.0${toSubscript(zeros)}${significant}`;
}

export function formatUsd(usd: number): string {
  if (usd === 0) return "$0.00";
  if (Math.abs(usd) < 0.01) return `$${usd.toExponential(2)}`;
  if (Math.abs(usd) < 1000) return `$${usd.toFixed(2)}`;
  if (Math.abs(usd) < 1_000_000) return `$${(usd / 1000).toFixed(2)}K`;
  return `$${(usd / 1_000_000).toFixed(2)}M`;
}

export function formatMarketCap(marketCapUsd: number): string {
  return formatUsd(marketCapUsd);
}

export function formatPercent(pct: number, decimals = 2): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(decimals)}%`;
}

export function shortenAddress(addr: string, chars = 4): string {
  if (!addr) return "";
  if (addr.length <= chars * 2 + 2) return addr;
  return `${addr.slice(0, chars + 2)}…${addr.slice(-chars)}`;
}

export function timeAgo(timestamp: number | Date): string {
  const ts = typeof timestamp === "number" ? timestamp : timestamp.getTime();
  const now = Date.now();
  const diff = Math.max(0, now - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export function formatNumber(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/** Abbreviate a whole-token (1e18) amount as e.g. "10K", "793.1M", "79.3B". */
export function formatTokenAmountCompact(amount: bigint, decimals = 18): string {
  if (amount <= 0n) return "0";
  const whole = amount / 10n ** BigInt(decimals);
  const n = Number(whole);
  if (n < 1000) return n.toLocaleString("en-US");
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return `${(n / 1_000_000_000).toFixed(1)}B`;
}

export function formatCompact(n: number): string {
  if (n === 0) return "0";
  if (Math.abs(n) < 0.001) return n.toExponential(2);
  if (Math.abs(n) < 1) return n.toFixed(4);
  return formatNumber(n);
}

export function graduationProgress(volume24h: number, supplyTier: number): number {
  const threshold = GRADUATION_THRESHOLDS[supplyTier] ?? 50;
  if (threshold <= 0) return 0;
  // Report true progress (no artificial floor) so a token with no volume reads 0%.
  return Math.min(100, Math.max(0, (volume24h / threshold) * 100));
}

/**
 * Accurate graduation progress from on-chain reserves: tokens sold on the curve
 * (realTokenReserves) vs the graduation threshold (realReservesInit). This mirrors the
 * exact on-chain condition `s_realTokenReserves >= s_realReservesInit`, so it stays correct
 * even on testnet where the threshold is a tiny fraction of total supply.
 */
export function graduationProgressByReserves(
  realTokenReserves: bigint,
  realReservesInit: bigint,
): number {
  if (realReservesInit <= 0n) return 0;
  const clamped = realTokenReserves > realReservesInit ? realReservesInit : realTokenReserves;
  // Scale in bigint to keep precision, then convert to a 0..100 number.
  const bps = (clamped * 10000n) / realReservesInit;
  return Math.min(100, Math.max(0, Number(bps) / 100));
}