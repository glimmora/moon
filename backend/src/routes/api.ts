import { Router } from "express";
import rateLimit from "express-rate-limit";
import { tokenService } from "../services/tokenService.js";
import { tradeService } from "../services/tradeService.js";
import { holderService } from "../services/holderService.js";
import { prisma } from "../utils/db.js";

export const apiRouter = Router();

const limiter = rateLimit({ windowMs: 60_000, max: 120 });
apiRouter.use(limiter);

/* ─────────────────────────  Tokens  ──────────────────────────── */

apiRouter.get("/tokens", async (req, res, next) => {
  try {
    const chainId = req.query.chainId ? Number(req.query.chainId) : undefined;
    const sort = (req.query.sort as "new" | "trending" | "graduated") ?? "trending";
    const tokens = await tokenService.list({ chainId, sort, limit: 100 });
    res.json(tokens);
  } catch (e) {
    next(e);
  }
});

apiRouter.get("/tokens/:chainId/:address", async (req, res, next) => {
  try {
    const token = await tokenService.get(Number(req.params.chainId), req.params.address);
    if (!token) return res.status(404).json({ error: "Token not found" });
    res.json(token);
  } catch (e) {
    next(e);
  }
});

apiRouter.get("/tokens/:chainId/:address/trades", async (req, res, next) => {
  try {
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 200) : 50;
    const trades = await tradeService.list(Number(req.params.chainId), req.params.address, limit);
    res.json(trades);
  } catch (e) {
    next(e);
  }
});

apiRouter.get("/tokens/:chainId/:address/prices", async (req, res, next) => {
  try {
    const window = req.query.window === "7d" ? 168 : req.query.window === "1h" ? 1 : 24;
    const history = await tradeService.priceHistory(Number(req.params.chainId), req.params.address, window);
    res.json(history);
  } catch (e) {
    next(e);
  }
});

apiRouter.get("/tokens/:chainId/:address/holders", async (req, res, next) => {
  try {
    const holders = await holderService.list(Number(req.params.chainId), req.params.address, 100);
    res.json(holders);
  } catch (e) {
    next(e);
  }
});

apiRouter.get("/tokens/:chainId/:address/bubblemap", async (req, res, next) => {
  try {
    const nodes = await holderService.bubblemap(Number(req.params.chainId), req.params.address);
    res.json(nodes);
  } catch (e) {
    next(e);
  }
});

/* ─────────────────────────  Search  ──────────────────────────── */

apiRouter.get("/search", async (req, res, next) => {
  try {
    const q = (req.query.q as string) ?? "";
    if (!q) return res.json([]);
    const results = await tokenService.search(q);
    res.json(results);
  } catch (e) {
    next(e);
  }
});

/* ─────────────────────  Creator fees  ────────────────────────── */

apiRouter.get("/creator-fees/:creator", async (req, res, next) => {
  try {
    const rows = await prisma.creatorFeeBalance.findMany({ where: { creator: req.params.creator } });
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

/* ─────────────────────  Referrals  ───────────────────────────── */

apiRouter.get("/referrals/:referrer", async (req, res, next) => {
  try {
    const stats = await prisma.referralStat.findMany({ where: { referrer: req.params.referrer } });
    const aggregated = stats.reduce(
      (acc, s) => {
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
    const address = req.params.address.toLowerCase();

    // 1. Holdings (from Holder snapshots across all chains/tokens).
    const holdings = await prisma.holder.findMany({
      where: { address },
      include: { token: true },
    });

    // 2. Recent trades by this wallet.
    const trades = await prisma.trade.findMany({
      where: { trader: address },
      orderBy: { timestamp: "desc" },
      take: 50,
      include: { token: true },
    });

    // 3. Tokens created by this wallet.
    const created = await prisma.token.findMany({
      where: { creator: address },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // 4. Aggregate stats.
    const totalVolume = trades.reduce((sum, t) => sum + Number(t.quoteAmount) / 1e18, 0);
    const tradeCount = await prisma.trade.count({ where: { trader: address } });
    const createdCount = await prisma.token.count({ where: { creator: address } });
    const graduatedCount = await prisma.token.count({ where: { creator: address, graduated: true } });

    // 5. Portfolio value (sum of holdings * priceUsd).
    const positions = holdings
      .filter((h) => h.token && Number(h.balance) > 0)
      .map((h) => {
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
      .sort((a, b) => b.valueUsd - a.valueUsd);

    const totalValueUsd = positions.reduce((sum, p) => sum + p.valueUsd, 0);

    res.json({
      address,
      totalValueUsd,
      totalVolume,
      tradeCount,
      createdCount,
      graduatedCount,
      positions,
      recentTrades: trades.map((t) => ({
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
      createdTokens: created.map((t) => ({
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
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    // Top traders by aggregate quote volume.
    const top = await prisma.trade.groupBy({
      by: ["trader"],
      _sum: { quoteAmount: true },
      _count: { id: true },
      orderBy: { _sum: { quoteAmount: "desc" } },
      take: limit,
    });
    const rows = top.map((r, i) => ({
      rank: i + 1,
      address: r.trader,
      volume: r._sum.quoteAmount ?? "0",
      volumeUsd: Number(r._sum.quoteAmount ?? "0") / 1e18,
      trades: r._count.id,
    }));
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

apiRouter.get("/leaderboard/creators", async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    // Top creators by aggregate volume across their tokens.
    const top = await prisma.token.groupBy({
      by: ["creator"],
      _sum: { volume24h: true, holderCount: true },
      _count: { id: true },
      orderBy: { _sum: { volume24h: "desc" } },
      take: limit,
    });
    const rows = top.map((r, i) => ({
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
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
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
    const rows = tokens.map((t, i) => ({ rank: i + 1, ...t, createdAt: t.createdAt.getTime() }));
    res.json(rows);
  } catch (e) {
    next(e);
  }
});
