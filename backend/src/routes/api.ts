import { Router } from "express";
import rateLimit from "express-rate-limit";
import { getAddress, isAddress } from "viem";
import { tokenService } from "../services/tokenService.js";
import { tradeService } from "../services/tradeService.js";
import { holderService } from "../services/holderService.js";
import { prisma } from "../utils/db.js";
import { SUPPORTED_CHAIN_IDS } from "../config/chains.js";

export const apiRouter = Router();

const limiter = rateLimit({ windowMs: 60_000, max: 120, skip: (req) => req.path === "/health" });
apiRouter.use(limiter);

/** Validate and parse chainId from route/query param. Returns 400 if invalid or unsupported. */
function parseChainId(val: string | undefined, res: import("express").Response): number | null {
  if (!val) return null;
  const n = Number(val);
  if (!Number.isInteger(n)) { res.status(400).json({ error: "Invalid chainId" }); return null; }
  if (!SUPPORTED_CHAIN_IDS.has(n)) { res.status(400).json({ error: "Unsupported chainId" }); return null; }
  return n;
}

/** Validate and checksum an EVM address. Returns 400 if invalid. */
function parseAddress(val: string | undefined, res: import("express").Response): string | null {
  if (!val) { res.status(400).json({ error: "Missing address" }); return null; }
  if (!isAddress(val)) { res.status(400).json({ error: "Invalid address" }); return null; }
  return getAddress(val);
}

/* ─────────────────────────  Tokens  ──────────────────────────── */

apiRouter.get("/tokens", async (req, res, next) => {
  try {
    const chainIdParam = req.query.chainId ? parseChainId(req.query.chainId as string, res) : undefined;
    if (chainIdParam === null && req.query.chainId) return;
    const sortParam = typeof req.query.sort === "string" ? req.query.sort : "trending";
    const sort = (["new", "trending", "graduated"].includes(sortParam) ? sortParam : "trending") as "new" | "trending" | "graduated";
    const tokens = await tokenService.list({ chainId: chainIdParam ?? undefined, sort, limit: 100 });
    res.json(tokens);
  } catch (e) {
    next(e);
  }
});

apiRouter.get("/tokens/:chainId/:address", async (req, res, next) => {
  try {
    const chainId = parseChainId(req.params.chainId, res);
    if (chainId === null) return;
    const address = parseAddress(req.params.address, res);
    if (!address) return;
    const token = await tokenService.get(chainId, address);
    if (!token) return res.status(404).json({ error: "Token not found" });
    res.json(token);
  } catch (e) {
    next(e);
  }
});

apiRouter.get("/tokens/:chainId/:address/trades", async (req, res, next) => {
  try {
    const chainId = parseChainId(req.params.chainId, res);
    if (chainId === null) return;
    const address = parseAddress(req.params.address, res);
    if (!address) return;
    const rawLimit = req.query.limit ? Number(req.query.limit) : 50;
    const limit = Number.isNaN(rawLimit) ? 50 : Math.max(1, Math.min(rawLimit, 200));
    const trades = await tradeService.list(chainId, address, limit);
    res.json(trades);
  } catch (e) {
    next(e);
  }
});

apiRouter.get("/tokens/:chainId/:address/prices", async (req, res, next) => {
  try {
    const chainId = parseChainId(req.params.chainId, res);
    if (chainId === null) return;
    const address = parseAddress(req.params.address, res);
    if (!address) return;
    const window = req.query.window === "7d" ? 168 : req.query.window === "1h" ? 1 : 24;
    const history = await tradeService.priceHistory(chainId, address, window);
    res.json(history);
  } catch (e) {
    next(e);
  }
});

apiRouter.get("/tokens/:chainId/:address/holders", async (req, res, next) => {
  try {
    const chainId = parseChainId(req.params.chainId, res);
    if (chainId === null) return;
    const address = parseAddress(req.params.address, res);
    if (!address) return;
    const holders = await holderService.list(chainId, address, 100);
    res.json(holders);
  } catch (e) {
    next(e);
  }
});

apiRouter.get("/tokens/:chainId/:address/bubblemap", async (req, res, next) => {
  try {
    const chainId = parseChainId(req.params.chainId, res);
    if (chainId === null) return;
    const address = parseAddress(req.params.address, res);
    if (!address) return;
    const nodes = await holderService.bubblemap(chainId, address);
    res.json(nodes);
  } catch (e) {
    next(e);
  }
});

/* ─────────────────────────  Search  ──────────────────────────── */

apiRouter.get("/search", async (req, res, next) => {
  try {
    const q = (req.query.q as string) ?? "";
    if (!q || q.length < 2 || q.length > 64) return res.json([]);
    const results = await tokenService.search(q);
    res.json(results);
  } catch (e) {
    next(e);
  }
});

/* ─────────────────────  Creator fees  ────────────────────────── */

apiRouter.get("/creator-fees/:creator", async (req, res, next) => {
  try {
    const creator = parseAddress(req.params.creator, res);
    if (!creator) return;
    const rows = await prisma.creatorFeeBalance.findMany({ where: { creator }, take: 100 });
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

/* ─────────────────────  Referrals  ───────────────────────────── */

apiRouter.get("/referrals/:referrer", async (req, res, next) => {
  try {
    const referrer = parseAddress(req.params.referrer, res);
    if (!referrer) return;
    const stats = await prisma.referralStat.findMany({ where: { referrer }, take: 100 });
    const aggregated = stats.reduce(
      (acc: { volume: string; rewards: string; count: number }, s: { volume: string; rewards: string; count: number }) => {
        acc.volume = (BigInt(acc.volume) + BigInt(s.volume)).toString();
        acc.rewards = (BigInt(acc.rewards) + BigInt(s.rewards)).toString();
        acc.count += s.count;
        return acc;
      },
      { volume: "0", rewards: "0", count: 0 },
    );
    res.json(aggregated);
  } catch (e) {
    next(e);
  }
});

/* ─────────────────────  Health  ──────────────────────────────── */

apiRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

/* ─────────────────────  Portfolio  ───────────────────────────── */

apiRouter.get("/portfolio/:address", async (req, res, next) => {
  try {
    const address = parseAddress(req.params.address, res);
    if (!address) return;

    // Run independent queries in parallel — was N+1 sequential.
    const [holdings, trades, created, tradeCount, createdCount, graduatedCount] = await Promise.all([
      prisma.holder.findMany({
        where: { address },
        include: { token: true },
        orderBy: { updatedAt: "desc" },
        // Cap unbounded scan — a whale could hold thousands of tokens.
        take: 500,
      }),
      prisma.trade.findMany({
        where: { trader: address },
        orderBy: { timestamp: "desc" },
        take: 50,
        include: { token: true },
      }),
      prisma.token.findMany({
        where: { creator: address },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.trade.count({ where: { trader: address } }),
      prisma.token.count({ where: { creator: address } }),
      prisma.token.count({ where: { creator: address, graduated: true } }),
    ]);

    const totalVolume = trades.reduce((sum: number, t: { quoteAmount: string }) => sum + Number(t.quoteAmount) / 1e18, 0);

    // 5. Portfolio value (sum of holdings * priceUsd).
    const positions = holdings
      .filter((h: { token?: { priceUsd: number; name: string; symbol: string; imageUrl: string; graduated: boolean; curveShape: number } | null; balance: string; chainId: number; tokenAddress: string; percentage: number }) => !!h.token && Number(h.balance) > 0)
      .map((h: { token: NonNullable<typeof holdings[number]['token']>; balance: string; chainId: number; tokenAddress: string; percentage: number }) => {
        const balance = Number(h.balance) / 1e18;
        const price = h.token.priceUsd ?? 0;
        return {
          chainId: h.chainId,
          tokenAddress: h.tokenAddress,
          name: h.token.name,
          symbol: h.token.symbol,
          imageUrl: h.token.imageUrl,
          balance: h.balance,
          balanceDisplay: balance,
          priceUsd: price,
          valueUsd: balance * price,
          percentage: h.percentage,
          graduated: h.token.graduated,
          curveShape: h.token.curveShape,
        };
      })
      .sort((a: { valueUsd: number }, b: { valueUsd: number }) => b.valueUsd - a.valueUsd);

    const totalValueUsd = positions.reduce((sum: number, p: { valueUsd: number }) => sum + p.valueUsd, 0);

    res.json({
      address,
      totalValueUsd,
      totalVolume,
      tradeCount,
      createdCount,
      graduatedCount,
      positions,
      recentTrades: trades.map((t: { txHash: string; chainId: number; tokenAddress: string; token?: { name?: string; symbol?: string } | null; side: string; quoteAmount: string; tokenAmount: string; priceUsd: number; timestamp: Date }) => ({
        txHash: t.txHash,
        chainId: t.chainId,
        tokenAddress: t.tokenAddress,
        tokenName: t.token?.name ?? "",
        tokenSymbol: t.token?.symbol ?? "",
        side: t.side,
        quoteAmount: t.quoteAmount,
        tokenAmount: t.tokenAmount,
        priceUsd: t.priceUsd,
        timestamp: t.timestamp.getTime(),
      })),
      createdTokens: created.map((t: { chainId: number; address: string; name: string; symbol: string; imageUrl: string; supplyTier: number; curveShape: number; priceUsd: number; marketCapUsd: number; holderCount: number; volume24h: number; graduated: boolean; createdAt: Date }) => ({
        chainId: t.chainId,
        address: t.address,
        name: t.name,
        symbol: t.symbol,
        imageUrl: t.imageUrl,
        supplyTier: t.supplyTier,
        curveShape: t.curveShape,
        priceUsd: t.priceUsd,
        marketCapUsd: t.marketCapUsd,
        holders: t.holderCount,
        volume24h: t.volume24h,
        graduated: t.graduated,
        createdAt: t.createdAt.getTime(),
      })),
    });
  } catch (e) {
    next(e);
  }
});

/* ─────────────────────  Leaderboard  ─────────────────────────── */

apiRouter.get("/leaderboard/traders", async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    // quoteAmount is a String column — Prisma _sum doesn't support String,
    // so we use raw SQL to SUM the numeric values.
    const rows = await prisma.$queryRawUnsafe(
      `SELECT "trader", SUM(CAST("quoteAmount" AS NUMERIC))::text AS "volume", COUNT(*)::int AS "trades"
       FROM "Trade"
       GROUP BY "trader"
       ORDER BY SUM(CAST("quoteAmount" AS NUMERIC)) DESC
       LIMIT $1`,
      limit,
    ) as { trader: string; volume: string; trades: number }[];
    const result = rows.map((r: { trader: string; volume: string; trades: number }, i: number) => ({
      rank: i + 1,
      address: r.trader,
      volume: r.volume ?? "0",
      volumeUsd: Number(r.volume ?? "0") / 1e18,
      trades: r.trades,
    }));
    res.json(result);
  } catch (e) {
    next(e);
  }
});

apiRouter.get("/leaderboard/creators", async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    // Top creators by aggregate volume across their tokens.
    const top = await prisma.token.groupBy({
      by: ["creator"],
      _sum: { volume24h: true, holderCount: true },
      _count: { id: true },
      orderBy: { _sum: { volume24h: "desc" } },
      take: limit,
    });
    const rows = top.map((r: { creator: string; _count: { id: number }; _sum: { volume24h: number | null; holderCount: number | null } }, i: number) => ({
      rank: i + 1,
      address: r.creator,
      tokensCreated: r._count.id,
      totalVolume24h: r._sum.volume24h ?? 0,
      totalHolders: r._sum.holderCount ?? 0,
    }));
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

apiRouter.get("/leaderboard/tokens", async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const sort = (req.query.sort as "volume" | "holders" | "marketcap") ?? "volume";
    const orderBy =
      sort === "holders"
        ? { holderCount: "desc" as const }
        : sort === "marketcap"
          ? { marketCapUsd: "desc" as const }
          : { volume24h: "desc" as const };
    const tokens = await prisma.token.findMany({
      orderBy,
      take: limit,
      select: {
        chainId: true,
        address: true,
        name: true,
        symbol: true,
        imageUrl: true,
        supplyTier: true,
        curveShape: true,
        priceUsd: true,
        marketCapUsd: true,
        holderCount: true,
        volume24h: true,
        graduated: true,
        creator: true,
        createdAt: true,
      },
    });
    const rows = tokens.map((t: { chainId: number; address: string; name: string; symbol: string; imageUrl: string; supplyTier: number; curveShape: number; priceUsd: number; marketCapUsd: number; holderCount: number; volume24h: number; graduated: boolean; creator: string; createdAt: Date }, i: number) => ({ rank: i + 1, ...t, createdAt: t.createdAt.getTime() }));
    res.json(rows);
  } catch (e) {
    next(e);
  }
});
