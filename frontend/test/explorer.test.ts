import { describe, it, expect } from "vitest";
import { txUrl, addressUrl, tokenUrl, explorerName } from "../src/lib/explorer";

const SEPOLIA = 11155111;
const BSC = 56;
const UNKNOWN = 1234567;
const HASH = "0xabc";
const ADDR = "0x1111111111111111111111111111111111111111";

describe("txUrl / addressUrl / tokenUrl", () => {
  it("builds sepolia URLs", () => {
    expect(txUrl(SEPOLIA, HASH)).toBe("https://sepolia.etherscan.io/tx/0xabc");
    expect(addressUrl(SEPOLIA, ADDR)).toBe(`https://sepolia.etherscan.io/address/${ADDR}`);
    expect(tokenUrl(SEPOLIA, ADDR)).toBe(`https://sepolia.etherscan.io/token/${ADDR}`);
  });

  it("builds bsc URLs", () => {
    expect(txUrl(BSC, HASH)).toBe("https://bscscan.com/tx/0xabc");
  });

  it("returns undefined for unknown chains", () => {
    expect(txUrl(UNKNOWN, HASH)).toBeUndefined();
    expect(addressUrl(UNKNOWN, ADDR)).toBeUndefined();
    expect(tokenUrl(UNKNOWN, ADDR)).toBeUndefined();
  });
});

describe("explorerName", () => {
  it("uses explorerApi label when present", () => {
    expect(explorerName(BSC)).toBe("BscScan");
  });
  it("derives hostname when no api label", () => {
    expect(explorerName(SEPOLIA)).toBe("sepolia.etherscan.io");
  });
  it("falls back to 'explorer' for unknown chains", () => {
    expect(explorerName(UNKNOWN)).toBe("explorer");
  });
});
