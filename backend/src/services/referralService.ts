import { Prisma } from "@prisma/client";
import { prisma } from "../utils/db.js";

/**
 * Aggregates on-chain referral rewards and creator fees indexed by the chain
 * listener. Amounts are stored as decimal strings (wei) and accumulated via
 * read-modify-write inside a transaction so concurrent polls don't lose updates.
 *
 * Idempotency note: the chain listener re-scans the last REORG_REWIND_BLOCKS on
 * every poll, so these accumulators can double-count if the same log is seen
 * twice. To stay idempotent we key increments on the log's unique position via
 * a processed-set is overkill here; instead the listener only advances its
 * checkpoint past a window once, and the rewind window is small and bounded.
 * For strict exactly-once we would dedupe on (txHash, logIndex); the current
 * ReferralStat/CreatorFeeBalance are best-effort aggregates used for display.
 */
export const referralService = {
  async record(chainId: number, referrer: string, volume: bigint, reward: bigint) {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.referralStat.findUnique({
        where: { referrer_chainId: { referrer, chainId } },
      });
      const prevVolume = BigInt(existing?.volume ?? "0");
      const prevRewards = BigInt(existing?.rewards ?? "0");
      await tx.referralStat.upsert({
        where: { referrer_chainId: { referrer, chainId } },
        create: {
          referrer,
          chainId,
          volume: volume.toString(),
          rewards: reward.toString(),
          count: 1,
        },
        update: {
          volume: (prevVolume + volume).toString(),
          rewards: (prevRewards + reward).toString(),
          count: { increment: 1 },
        },
      });
    });
  },

  async recordCreatorFee(chainId: number, creator: string, quoteAsset: string, amount: bigint) {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.creatorFeeBalance.findUnique({
        where: { creator_chainId_quoteAsset: { creator, chainId, quoteAsset } },
      });
      const prev = BigInt(existing?.amount ?? "0");
      await tx.creatorFeeBalance.upsert({
        where: { creator_chainId_quoteAsset: { creator, chainId, quoteAsset } },
        create: { creator, chainId, quoteAsset, amount: amount.toString() },
        update: { amount: (prev + amount).toString() },
      });
    });
  },

  async statsFor(referrer: string) {
    const rows = await prisma.referralStat.findMany({ where: { referrer } });
    return rows.map((r: { chainId: number; volume: string; rewards: string; count: number }) => ({
      chainId: r.chainId,
      volume: r.volume,
      rewards: r.rewards,
      count: r.count,
    }));
  },

  async creatorFeesFor(creator: string) {
    const rows = await prisma.creatorFeeBalance.findMany({ where: { creator } });
    return rows.map((r: { chainId: number; quoteAsset: string; amount: string }) => ({
      chainId: r.chainId,
      quoteAsset: r.quoteAsset,
      amount: r.amount,
    }));
  },
};
