import { prisma } from "../utils/db.js";
import { logger } from "../utils/logger.js";

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
}

export const tokenService = {
  async upsert(input: UpsertTokenInput) {
    return prisma.token.upsert({
      where: { chainId_address: { chainId: input.chainId, address: input.address } },
      create: input,
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
    const rows = await prisma.token.findMany({ where, orderBy, take: limit });
    // Add `holders` alias for frontend compat (Prisma schema uses `holderCount`)
    return rows.map((r: { holderCount: number }) => ({ ...r, holders: r.holderCount }));
  },

  async get(chainId: number, address: string) {
    const row = await prisma.token.findUnique({ where: { chainId_address: { chainId, address } } });
    return row ? { ...row, holders: row.holderCount } : null;
  },

  async markGraduated(chainId: number, address: string, dexPair: string) {
    logger.info({ chainId, address, dexPair }, "Marking token graduated");
    return prisma.token.update({
      where: { chainId_address: { chainId, address } },
      data: { graduated: true, dexPair },
    });
  },

  async updateMarketStats(chainId: number, address: string, stats: { priceUsd?: number; marketCapUsd?: number; holderCount?: number; volume24h?: number }) {
    return prisma.token.update({
      where: { chainId_address: { chainId, address } },
      data: stats,
    });
  },

  async search(q: string, limit = 20) {
    const rows = await prisma.token.findMany({
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
    });
    return rows.map((r: { holderCount: number }) => ({ ...r, holders: r.holderCount }));
  },
};
