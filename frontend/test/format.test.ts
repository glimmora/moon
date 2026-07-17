import { describe, it, expect } from "vitest";
import {
  graduationProgress,
  shortenAddress,
  formatToken,
  formatPrice,
  formatUsd,
  formatMarketCap,
  formatPercent,
  formatNumber,
  formatCompact,
  timeAgo,
} from "../src/lib/format";
import { GRADUATION_THRESHOLDS } from "../src/lib/curve";

describe("graduationProgress", () => {
  it("reports true progress from 0 and clamps at 100%", () => {
    expect(graduationProgress(0, 0)).toBe(0);
    expect(graduationProgress(1_000_000, 0)).toBe(100);
  });

  it("uses tier-specific thresholds", () => {
    // tier 1 threshold is 500 → 250 volume ≈ 50%
    expect(graduationProgress(250, 1)).toBeCloseTo(50, 5);
    expect(GRADUATION_THRESHOLDS[1]).toBe(500);
  });

  it("falls back to tier 0 threshold for unknown tiers", () => {
    expect(graduationProgress(25, 99)).toBeCloseTo(50, 5);
  });
});

describe("shortenAddress", () => {
  it("shortens a 0x address", () => {
    const short = shortenAddress("0x1234567890abcdef1234567890abcdef12345678");
    expect(short).toMatch(/^0x1234…5678$/);
  });
});

describe("formatToken", () => {
  it("formats zero", () => {
    expect(formatToken(0n)).toBe("0");
  });
  it("formats one whole token", () => {
    expect(formatToken(10n ** 18n)).toBe("1");
  });
  it("adds thousands separators and truncates fraction", () => {
    expect(formatToken(1234n * 10n ** 18n)).toBe("1,234");
    expect(formatToken(3n * 10n ** 18n / 2n)).toBe("1.50");
  });
});

describe("formatPrice", () => {
  it("formats zero", () => {
    expect(formatPrice(0n)).toBe("$0.0000");
  });
  it("uses exponential for tiny prices", () => {
    expect(formatPrice(10n ** 12n)).toMatch(/^\$.*e/);
  });
  it("uses 6 decimals under $1", () => {
    expect(formatPrice(5n * 10n ** 15n)).toBe("$0.005000");
  });
  it("uses 4 decimals for >= $1", () => {
    expect(formatPrice(2n * 10n ** 18n)).toBe("$2.0000");
  });
});

describe("formatUsd / formatMarketCap", () => {
  it("formats ranges", () => {
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(12.5)).toBe("$12.50");
    expect(formatUsd(2500)).toBe("$2.50K");
    expect(formatUsd(3_400_000)).toBe("$3.40M");
    expect(formatUsd(0.005)).toMatch(/e/);
  });
  it("marketCap delegates to formatUsd", () => {
    expect(formatMarketCap(2500)).toBe("$2.50K");
  });
});

describe("formatPercent", () => {
  it("adds a + for positive", () => {
    expect(formatPercent(12.345)).toBe("+12.35%");
  });
  it("keeps - for negative", () => {
    expect(formatPercent(-4.2)).toBe("-4.20%");
  });
});

describe("formatNumber / formatCompact", () => {
  it("formatNumber scales K/M", () => {
    expect(formatNumber(999)).toBe("999");
    expect(formatNumber(1500)).toBe("1.5K");
    expect(formatNumber(2_000_000)).toBe("2.0M");
  });
  it("formatCompact handles zero, tiny and fractional", () => {
    expect(formatCompact(0)).toBe("0");
    expect(formatCompact(0.0005)).toMatch(/e/);
    expect(formatCompact(0.25)).toBe("0.2500");
    expect(formatCompact(1500)).toBe("1.5K");
  });
});

describe("shortenAddress edge cases", () => {
  it("returns empty for empty input", () => {
    expect(shortenAddress("")).toBe("");
  });
  it("returns short strings unchanged", () => {
    expect(shortenAddress("0x1234")).toBe("0x1234");
  });
});

describe("timeAgo", () => {
  it("formats recent times", () => {
    const now = Date.now();
    expect(timeAgo(now)).toMatch(/s ago$/);
    expect(timeAgo(now - 5 * 60_000)).toBe("5m ago");
    expect(timeAgo(now - 3 * 3600_000)).toBe("3h ago");
    expect(timeAgo(now - 2 * 86_400_000)).toBe("2d ago");
  });
  it("accepts a Date and never goes negative", () => {
    expect(timeAgo(new Date(Date.now() + 10_000))).toBe("0s ago");
  });
});
