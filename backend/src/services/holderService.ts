import { prisma } from "../utils/db.js";

interface UpsertHolderInput {
  chainId: number;
  tokenAddress: string;
  address: string;
  balance: string;
  percentage: number;
  isContract: boolean;
}

export const holderService = {
  async upsert(input: UpsertHolderInput) {
    return prisma.holder.upsert({
      where: {
        chainId_tokenAddress_address: {
          chainId: input.chainId,
          tokenAddress: input.tokenAddress,
          address: input.address,
        },
      },
      create: input,
      update: {
        balance: input.balance,
        percentage: input.percentage,
        isContract: input.isContract,
      },
    });
  },

  async list(chainId: number, tokenAddress: string, limit = 100) {
    // Sort by numeric balance using raw ORDER BY — String sort is lexicographic ("9" > "100").
    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM "Holder"
       WHERE "chainId" = $1 AND "tokenAddress" = $2
       ORDER BY CAST("balance" AS NUMERIC) DESC
       LIMIT $3`,
      chainId, tokenAddress, limit,
    ) as { id: string; chainId: number; tokenAddress: string; address: string; balance: string; percentage: number; isContract: boolean; firstSeen: Date; updatedAt: Date }[];
    return rows;
  },

  async bubblemap(chainId: number, tokenAddress: string) {
    const holders = await this.list(chainId, tokenAddress, 50);
    // Connections: stubbed — in production this would trace Transfer edges.
    return holders.map((h: { id: string; address: string; balance: string; percentage: number; isContract: boolean }) => ({
      id: h.address,
      address: h.address,
      balance: h.balance,
      percentage: h.percentage,
      isContract: h.isContract,
      connections: [] as string[],
    }));
  },
};
