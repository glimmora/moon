import { prisma } from "../utils/db.js";
import { logger } from "../utils/logger.js";
import { prismaCircuit } from "../utils/circuitBreaker.js";

interface UpsertTokenInput {
  chainId: number;
  address: string;
  curve?: string;
  name: string;
  symbol: string;
  imageUrl: string;
  description: string;
  supplyTier: number;
  curveShape: number;
  totalSupply: string;
  creator: string;
  creationBlock?: bigint;
}

export const tokenService = {
  async upsert(input: UpsertTokenInput) {
    const { creationBlock, ...rest } = input;
    return prisma.token.upsert({
      where: { chainId_address: { chainId: input.chainId, address: input.address } },
      create: { ...rest, creationBlock: creationBlock ?? undefined } as never,
      update: {
        curve: input.curve ?? undefined,
        name: input.name,
        symbol: input.symbol,
        imageUrl: input.imageUrl,
        description: input.description,
        supplyTier: input.supplyTier,
        curveShape: input.curveShape,
        totalSupply: input.totalSupply,
        creator: input.creator,
        creationBlock: creationBlock ?? undefined,
      },
    });
  },

  async list(opts: { chainId?: number; limit?: number; sort?: "new" | "trending" | "graduated" } = {}) {
    const { chainId, limit = 50, sort = "trending" } = opts;
    const where = chainId ? { chainId } : undefined;
    const orderBy =
      sort === "new"
        ? { createdAt: "desc" as const }
        : sort === "graduated"
          ? { graduated: "desc" as const }
          : { volume24h: "desc" as const };
    try {
      const rows = await prismaCircuit.exec(() => prisma.token.findMany({ where, orderBy, take: limit }));
      // Add `holders` alias for frontend compat (Prisma schema uses `holderCount`)
      return rows.map((r: { holderCount: number }) => ({ ...r, holders: r.holderCount }));
    } catch (e) {
      // When the DB circuit breaker is open, return an empty list instead of a
      // 500 so the frontend degrades gracefully (and can fall back to on-chain).
      if (e instanceof Error && e.message.includes("CIRCUIT_OPEN")) {
        logger.warn("Database circuit breaker open — returning empty token list");
        return [];
      }
      throw e;
    }
  },

  async get(chainId: number, address: string) {
    try {
      const row = await prismaCircuit.exec(() => prisma.token.findUnique({ 
        where: { chainId_address: { chainId, address } },
        // Add timeout at Prisma level
      }));
      if (!row) return null;
      // Validate required fields exist
      if (!row.name || !row.symbol) {
        logger.warn({ chainId, address }, "Token found but missing name/symbol");
        return null;
      }
      return { ...row, holders: row.holderCount };
    } catch (e) {
      // If circuit is open, return gracefully instead of error
      if (e instanceof Error && e.message.includes("CIRCUIT_OPEN")) {
        logger.warn({ chainId, address }, "Database circuit breaker open — skipping token fetch");
        return null;
      }
      logger.error({ err: e, chainId, address }, "Error fetching token");
      throw new Error("Failed to fetch token data");
    }
  },

  async markGraduated(chainId: number, address: string, dexPair: string) {
    logger.info({ chainId, address, dexPair }, "Marking token graduated");
    return prisma.token.updateMany({
      where: { chainId, address },
      data: { graduated: true, dexPair },
    });
  },

  async updateMarketStats(chainId: number, address: string, stats: { priceUsd?: number; marketCapUsd?: number; holderCount?: number; volume24h?: number }) {
    return prisma.token.updateMany({
      where: { chainId, address },
      data: stats,
    });
  },

  async search(q: string, limit = 20) {
    try {
      const rows = await prismaCircuit.exec(() => prisma.token.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { symbol: { contains: q, mode: "insensitive" } },
            { address: { contains: q, mode: "insensitive" } },
            { creator: { contains: q, mode: "insensitive" } },
          ],
        },
        take: limit,
        orderBy: { volume24h: "desc" },
      }));
      return rows.map((r: { holderCount: number }) => ({ ...r, holders: r.holderCount }));
    } catch (e) {
      if (e instanceof Error && e.message.includes("CIRCUIT_OPEN")) {
        logger.warn("Database circuit breaker open — returning empty search results");
        return [];
      }
      throw e;
    }
  },
};
