import { describe, it, expect, beforeAll } from "vitest";

// Ensure required env is present before importing modules that validate it.
beforeAll(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret-test-secret-test-secret-123456";
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "file:./test.db";
  process.env.DATABASE_PROVIDER = process.env.DATABASE_PROVIDER ?? "sqlite";
});

describe("authService", () => {
  it("issues unique nonces", async () => {
    const { authService } = await import("../src/services/authService.js");
    const a = authService.issueNonce();
    const b = authService.issueNonce();
    expect(a).toBeTypeOf("string");
    expect(a.length).toBeGreaterThan(16);
    expect(a).not.toEqual(b);
  });

  it("round-trips a JWT via verifyToken", async () => {
    const { authService } = await import("../src/services/authService.js");
    const jwt = (await import("jsonwebtoken")).default;
    const token = jwt.sign({ sub: "0xabc", chainId: 8453 }, process.env.JWT_SECRET!, { expiresIn: "1h" });
    const payload = authService.verifyToken(token);
    expect(payload.sub).toBe("0xabc");
    expect(payload.chainId).toBe(8453);
  });

  it("rejects a tampered/invalid JWT", async () => {
    const { authService, AuthError } = await import("../src/services/authService.js");
    expect(() => authService.verifyToken("not-a-jwt")).toThrow(AuthError);
  });
});
