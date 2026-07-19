import { prisma } from "../utils/db.js";
import { getAddress } from "viem";

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
    const rows = await prisma.$queryRaw<
      { id: string; chainId: number; tokenAddress: string; address: string; balance: string; percentage: number; isContract: boolean; firstSeen: Date; updatedAt: Date }[]
    >`
      SELECT * FROM "Holder"
      WHERE "chainId" = ${chainId} AND "tokenAddress" = ${tokenAddress}
      ORDER BY CAST("balance" AS NUMERIC) DESC
      LIMIT ${limit}
    `;
    return rows;
  },

  async bubblemap(chainId: number, tokenAddress: string) {
    const holders = await this.list(chainId, tokenAddress, 50);
    const holderSet = new Set(holders.map((h) => h.address.toLowerCase()));

    // Derive edges from on-chain co-trading: holders whose buys landed in the
    // same block are linked (a strong signal for coordinated / bundled buys).
    // This replaces the previous stub with real, deterministic on-chain data.
    const trades = await prisma.trade.findMany({
      where: { chainId, tokenAddress, side: "buy" },
      select: { trader: true, blockNumber: true },
    });

    const byBlock = new Map<string, Set<string>>();
    for (const t of trades) {
      const addr = t.trader.toLowerCase();
      if (!holderSet.has(addr)) continue;
      const key = t.blockNumber.toString();
      let bucket = byBlock.get(key);
      if (!bucket) {
        bucket = new Set<string>();
        byBlock.set(key, bucket);
      }
      bucket.add(addr);
    }

    const connections = new Map<string, Set<string>>();
    for (const bucket of byBlock.values()) {
      if (bucket.size < 2) continue;
      const members = [...bucket];
      for (const a of members) {
        for (const b of members) {
          if (a === b) continue;
          let set = connections.get(a);
          if (!set) {
            set = new Set<string>();
            connections.set(a, set);
          }
          set.add(b);
        }
      }
    }

    return holders.map((h: { id: string; address: string; balance: string; percentage: number; isContract: boolean }) => ({
      id: h.address,
      address: h.address,
      balance: h.balance,
      percentage: h.percentage,
      isContract: h.isContract,
      connections: [...(connections.get(h.address.toLowerCase()) ?? [])],
    }));
  },

  /**
   * Fallback holder computation derived from reliably-indexed Trade records
   * (bought/sold against the bonding curve). Used when on-chain getLogs over
   * historical blocks is unavailable (e.g. local/dev RPCs without archive
   * support) so the holder list still populates for actively traded tokens.
   * Returns the resulting number of holders.
   */
  async refreshFromTrades(chainId: number, tokenAddress: string, totalSupplyStr: string): Promise<number> {
    const trades = await prisma.trade.findMany({
      where: { chainId, tokenAddress },
      select: { trader: true, side: true, tokenAmount: true },
    });

    if (trades.length === 0) return 0;

    const net = new Map<string, bigint>();
    for (const t of trades) {
      const amt = BigInt(t.tokenAmount);
      if (t.side === "sell") {
        net.set(t.trader, (net.get(t.trader) ?? 0n) - amt);
      } else {
        net.set(t.trader, (net.get(t.trader) ?? 0n) + amt);
      }
    }

    const totalSupply = BigInt(totalSupplyStr);
    const survivors = new Set(
      [...net.entries()].filter(([, bal]) => bal > 0n).map(([addr]) => addr),
    );

    // Remove rows for traders whose net balance dropped to zero/negative.
    if (survivors.size < net.size) {
      const exited = [...net.keys()].filter((addr) => !survivors.has(addr));
      await prisma.holder.deleteMany({
        where: { chainId, tokenAddress, address: { in: exited } },
      });
    }

    const ops = [...survivors].map((addr) => {
      const bal = net.get(addr)!;
      const percentage = totalSupply > 0n ? Number((bal * 10000n) / totalSupply) / 100 : 0;
      return prisma.holder.upsert({
        where: { chainId_tokenAddress_address: { chainId, tokenAddress, address: addr } },
        create: { chainId, tokenAddress, address: getAddress(addr), balance: bal.toString(), percentage, isContract: false },
        update: { balance: bal.toString(), percentage },
      });
    });
    if (ops.length > 0) await prisma.$transaction(ops);

    return survivors.size;
  },
};
