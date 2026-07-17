/** Formatting helpers — all on-chain values use 1e18 fixed point. */
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

export function formatPrice(quotePerToken: bigint): string {
  const usd = Number(quotePerToken) / 1e18;
  if (usd === 0) return "$0.0000";
  if (usd < 0.0001) return `$${usd.toExponential(2)}`;
  if (usd < 1) return `$${usd.toFixed(6)}`;
  return `$${usd.toFixed(4)}`;
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
