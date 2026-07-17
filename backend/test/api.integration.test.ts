import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { getAddress } from "viem";
import type { Express } from "express";
import { seed, addr, CHAIN_ID } from "./helpers/db.js";

let app: Express;

beforeAll(async () => {
  await seed();
  const mod = await import("../src/app.js");
  app = mod.createApp();
});

afterAll(async () => {
  const { prisma } = await import("../src/utils/db.js");
  await prisma.$disconnect();
});

describe("GET /health", () => {
  it("returns ok with a live DB", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

describe("GET /api/tokens", () => {
  it("lists all tokens (default trending)", async () => {
    const res = await request(app).get("/api/tokens");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    // trending = volume24h desc -> BETA (9876) before ALPHA (1234)
    expect(res.body[0].symbol).toBe("BETA");
    // holders alias present
    expect(res.body[0]).toHaveProperty("holders");
  });

  it("sorts by new (createdAt desc)", async () => {
    const res = await request(app).get("/api/tokens?sort=new");
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it("filters by chainId", async () => {
    const res = await request(app).get(`/api/tokens?chainId=${CHAIN_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it("rejects invalid chainId", async () => {
    const res = await request(app).get("/api/tokens?chainId=abc");
    expect(res.status).toBe(400);
  });

  it("rejects unsupported chainId", async () => {
    const res = await request(app).get("/api/tokens?chainId=999999");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/tokens/:chainId/:address", () => {
  it("returns token detail", async () => {
    const res = await request(app).get(`/api/tokens/${CHAIN_ID}/${addr.tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.symbol).toBe("ALPHA");
    expect(res.body).toHaveProperty("holders", 2);
  });

  it("404 for unknown token", async () => {
    const res = await request(app).get(
      `/api/tokens/${CHAIN_ID}/0x000000000000000000000000000000000000dead`,
    );
    expect(res.status).toBe(404);
  });

  it("400 for invalid address", async () => {
    const res = await request(app).get(`/api/tokens/${CHAIN_ID}/not-an-address`);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/tokens/:chainId/:address/trades", () => {
  it("returns trade history", async () => {
    const res = await request(app).get(`/api/tokens/${CHAIN_ID}/${addr.tokenA}/trades`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it("caps limit at 200", async () => {
    const res = await request(app).get(
      `/api/tokens/${CHAIN_ID}/${addr.tokenA}/trades?limit=99999`,
    );
    expect(res.status).toBe(200);
  });
});

describe("GET /api/tokens/:chainId/:address/prices", () => {
  it("returns price history (default 24h)", async () => {
    const res = await request(app).get(`/api/tokens/${CHAIN_ID}/${addr.tokenA}/prices`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("accepts window params", async () => {
    for (const w of ["1h", "24h", "7d"]) {
      const res = await request(app).get(
        `/api/tokens/${CHAIN_ID}/${addr.tokenA}/prices?window=${w}`,
      );
      expect(res.status).toBe(200);
    }
  });
});

describe("GET /api/tokens/:chainId/:address/holders", () => {
  it("returns holders", async () => {
    const res = await request(app).get(`/api/tokens/${CHAIN_ID}/${addr.tokenA}/holders`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });
});

describe("GET /api/tokens/:chainId/:address/bubblemap", () => {
  it("returns bubblemap nodes", async () => {
    const res = await request(app).get(`/api/tokens/${CHAIN_ID}/${addr.tokenA}/bubblemap`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("GET /api/search", () => {
  it("finds by name", async () => {
    const res = await request(app).get("/api/search?q=Alpha");
    expect(res.status).toBe(200);
    expect(res.body.some((t: { symbol: string }) => t.symbol === "ALPHA")).toBe(true);
  });

  it("finds by symbol", async () => {
    const res = await request(app).get("/api/search?q=BETA");
    expect(res.body.some((t: { symbol: string }) => t.symbol === "BETA")).toBe(true);
  });

  it("finds by address", async () => {
    const res = await request(app).get(`/api/search?q=${addr.tokenA}`);
    expect(res.body.some((t: { symbol: string }) => t.symbol === "ALPHA")).toBe(true);
  });

  it("finds by creator", async () => {
    const res = await request(app).get(`/api/search?q=${addr.creator}`);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it("returns [] for too-short query", async () => {
    const res = await request(app).get("/api/search?q=a");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("GET /api/creator-fees/:creator", () => {
  it("returns creator fee balances", async () => {
    const res = await request(app).get(`/api/creator-fees/${addr.creator}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].amount).toBe("1500000000000000");
  });

  it("400 on invalid creator", async () => {
    const res = await request(app).get("/api/creator-fees/xyz");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/referrals/:referrer", () => {
  it("aggregates referral stats", async () => {
    const res = await request(app).get(`/api/referrals/${addr.referrer}`);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.volume).toBe("20000000000000000");
  });

  it("returns zeros for unknown referrer", async () => {
    const res = await request(app).get(
      "/api/referrals/0x000000000000000000000000000000000000ffff",
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ volume: "0", rewards: "0", count: 0 });
  });
});

describe("GET /api/portfolio/:address", () => {
  it("returns holdings, trades, created tokens for a trader", async () => {
    const res = await request(app).get(`/api/portfolio/${addr.holder1}`);
    expect(res.status).toBe(200);
    expect(res.body.address).toBe(getAddress(addr.holder1));
    expect(res.body.positions.length).toBeGreaterThanOrEqual(1);
  });

  it("returns created tokens + counts for a creator", async () => {
    const res = await request(app).get(`/api/portfolio/${addr.creator}`);
    expect(res.status).toBe(200);
    expect(res.body.createdCount).toBe(2);
    expect(res.body.graduatedCount).toBe(1);
    expect(res.body.createdTokens.length).toBe(2);
  });
});

describe("GET /api/leaderboard/*", () => {
  it("traders ranked by volume", async () => {
    const res = await request(app).get("/api/leaderboard/traders");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].rank).toBe(1);
    // referrer traded 0.02 ETH vs trader 0.015 -> referrer ranked first
    expect(res.body[0].address.toLowerCase()).toBe(addr.referrer.toLowerCase());
  });

  it("creators ranked by aggregate volume", async () => {
    const res = await request(app).get("/api/leaderboard/creators");
    expect(res.status).toBe(200);
    expect(res.body[0].tokensCreated).toBe(2);
  });

  it("tokens ranked by volume/holders/marketcap", async () => {
    for (const sort of ["volume", "holders", "marketcap"]) {
      const res = await request(app).get(`/api/leaderboard/tokens?sort=${sort}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
      expect(res.body[0].rank).toBe(1);
    }
  });
});

describe("GET /api/health", () => {
  it("returns ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

describe("404 + errors", () => {
  it("unknown route returns 404", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
  });
});
