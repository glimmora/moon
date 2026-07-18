import { describe, it, expect, beforeAll } from "vitest";

// Ensure required env is present before importing modules that validate it.
beforeAll(() => {
  process.env.AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET ?? "test-secret-test-secret-test-secret-123456";
  process.env.DB_URL = process.env.DB_URL ?? "file:./test.db";
  process.env.DB_PROVIDER = process.env.DB_PROVIDER ?? "sqlite";
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
    const token = jwt.sign({ sub: "0xabc", chainId: 8453 }, process.env.AUTH_JWT_SECRET!, { expiresIn: "1h" });
    const payload = authService.verifyToken(token);
    expect(payload.sub).toBe("0xabc");
    expect(payload.chainId).toBe(8453);
  });

  it("rejects a tampered/invalid JWT", async () => {
    const { authService, AuthError } = await import("../src/services/authService.js");
    expect(() => authService.verifyToken("not-a-jwt")).toThrow(AuthError);
  });
});
