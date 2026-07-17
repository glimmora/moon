import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { SiweMessage } from "siwe";
import { privateKeyToAccount } from "viem/accounts";

let app: Express;
// Deterministic well-known anvil test key #0 (public, never a real fund holder).
const account = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);
const CHAIN_ID = 11155111;

beforeAll(async () => {
  const mod = await import("../src/app.js");
  app = mod.createApp();
});

afterAll(async () => {
  const { prisma } = await import("../src/utils/db.js");
  await prisma.$disconnect();
});

async function signedLogin() {
  const nonceRes = await request(app).get("/api/auth/nonce");
  const nonce = nonceRes.body.nonce as string;
  const message = new SiweMessage({
    domain: "localhost",
    address: account.address,
    statement: "Sign in to moon.fun",
    uri: "http://localhost:5173",
    version: "1",
    chainId: CHAIN_ID,
    nonce,
  }).prepareMessage();
  const signature = await account.signMessage({ message });
  return { message, signature, nonce };
}

describe("GET /api/auth/nonce", () => {
  it("issues unique nonces", async () => {
    const a = await request(app).get("/api/auth/nonce");
    const b = await request(app).get("/api/auth/nonce");
    expect(a.status).toBe(200);
    expect(a.body.nonce).toBeTypeOf("string");
    expect(a.body.nonce).not.toBe(b.body.nonce);
  });
});

describe("POST /api/auth/verify", () => {
  it("verifies a valid SIWE signature and returns a JWT", async () => {
    const { message, signature } = await signedLogin();
    const res = await request(app).post("/api/auth/verify").send({ message, signature });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf("string");
    expect(res.body.address).toBe(account.address);
    expect(res.body.chainId).toBe(CHAIN_ID);
  });

  it("rejects a malformed body", async () => {
    const res = await request(app).post("/api/auth/verify").send({ message: "x" });
    expect(res.status).toBe(400);
  });

  it("rejects a replayed nonce", async () => {
    const { message, signature } = await signedLogin();
    const first = await request(app).post("/api/auth/verify").send({ message, signature });
    expect(first.status).toBe(200);
    const second = await request(app).post("/api/auth/verify").send({ message, signature });
    expect(second.status).toBe(401);
  });

  it("rejects a tampered signature", async () => {
    const { message } = await signedLogin();
    const res = await request(app)
      .post("/api/auth/verify")
      .send({ message, signature: "0x" + "00".repeat(65) });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  it("returns the authenticated user with a valid token", async () => {
    const { message, signature } = await signedLogin();
    const login = await request(app).post("/api/auth/verify").send({ message, signature });
    const token = login.body.token as string;
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.address).toBe(account.address);
    expect(res.body.chainId).toBe(CHAIN_ID);
  });

  it("401 without a token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("401 with a garbage token", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", "Bearer nope");
    expect(res.status).toBe(401);
  });
});
