import { describe, it, expect } from "vitest";
import { graduationProgress, shortenAddress, formatToken } from "../src/lib/format";
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
});
