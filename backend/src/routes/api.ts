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
