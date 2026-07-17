-- CreateTable
CREATE TABLE "Token" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "curve" TEXT,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "supplyTier" INTEGER NOT NULL,
    "curveShape" INTEGER NOT NULL,
    "totalSupply" TEXT NOT NULL,
    "creator" TEXT NOT NULL,
    "graduated" BOOLEAN NOT NULL DEFAULT false,
    "dexPair" TEXT,
    "priceUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marketCapUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "holderCount" INTEGER NOT NULL DEFAULT 0,
    "volume24h" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "trader" TEXT NOT NULL,
    "quoteAmount" TEXT NOT NULL,
    "tokenAmount" TEXT NOT NULL,
    "priceUsd" DOUBLE PRECISION NOT NULL,
    "feeUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "blockNumber" BIGINT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holder" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "balance" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "isContract" BOOLEAN NOT NULL DEFAULT false,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndexerCheckpoint" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "eventName" TEXT NOT NULL,
    "lastBlock" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndexerCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralStat" (
    "id" TEXT NOT NULL,
    "referrer" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "volume" TEXT NOT NULL DEFAULT '0',
    "rewards" TEXT NOT NULL DEFAULT '0',
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorFeeBalance" (
    "id" TEXT NOT NULL,
    "creator" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "quoteAsset" TEXT NOT NULL,
    "amount" TEXT NOT NULL DEFAULT '0',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorFeeBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Token_chainId_idx" ON "Token"("chainId");

-- CreateIndex
CREATE INDEX "Token_chainId_curve_idx" ON "Token"("chainId", "curve");

-- CreateIndex
CREATE INDEX "Token_createdAt_idx" ON "Token"("createdAt");

-- CreateIndex
CREATE INDEX "Token_graduated_idx" ON "Token"("graduated");

-- CreateIndex
CREATE INDEX "Token_volume24h_idx" ON "Token"("volume24h");

-- CreateIndex
CREATE INDEX "Token_holderCount_idx" ON "Token"("holderCount");

-- CreateIndex
CREATE INDEX "Token_marketCapUsd_idx" ON "Token"("marketCapUsd");

-- CreateIndex
CREATE INDEX "Token_creator_idx" ON "Token"("creator");

-- CreateIndex
CREATE UNIQUE INDEX "Token_chainId_address_key" ON "Token"("chainId", "address");

-- CreateIndex
CREATE INDEX "Trade_chainId_tokenAddress_timestamp_idx" ON "Trade"("chainId", "tokenAddress", "timestamp");

-- CreateIndex
CREATE INDEX "Trade_chainId_timestamp_idx" ON "Trade"("chainId", "timestamp");

-- CreateIndex
CREATE INDEX "Trade_trader_idx" ON "Trade"("trader");

-- CreateIndex
CREATE INDEX "Trade_trader_timestamp_idx" ON "Trade"("trader", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "Trade_chainId_txHash_tokenAddress_key" ON "Trade"("chainId", "txHash", "tokenAddress");

-- CreateIndex
CREATE INDEX "Holder_chainId_tokenAddress_idx" ON "Holder"("chainId", "tokenAddress");

-- CreateIndex
CREATE INDEX "Holder_address_idx" ON "Holder"("address");

-- CreateIndex
CREATE UNIQUE INDEX "Holder_chainId_tokenAddress_address_key" ON "Holder"("chainId", "tokenAddress", "address");

-- CreateIndex
CREATE INDEX "ChatMessage_chainId_tokenAddress_createdAt_idx" ON "ChatMessage"("chainId", "tokenAddress", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IndexerCheckpoint_chainId_eventName_key" ON "IndexerCheckpoint"("chainId", "eventName");

-- CreateIndex
CREATE INDEX "ReferralStat_referrer_idx" ON "ReferralStat"("referrer");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralStat_referrer_chainId_key" ON "ReferralStat"("referrer", "chainId");

-- CreateIndex
CREATE INDEX "CreatorFeeBalance_creator_idx" ON "CreatorFeeBalance"("creator");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorFeeBalance_creator_chainId_quoteAsset_key" ON "CreatorFeeBalance"("creator", "chainId", "quoteAsset");

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_chainId_tokenAddress_fkey" FOREIGN KEY ("chainId", "tokenAddress") REFERENCES "Token"("chainId", "address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holder" ADD CONSTRAINT "Holder_chainId_tokenAddress_fkey" FOREIGN KEY ("chainId", "tokenAddress") REFERENCES "Token"("chainId", "address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_chainId_tokenAddress_fkey" FOREIGN KEY ("chainId", "tokenAddress") REFERENCES "Token"("chainId", "address") ON DELETE RESTRICT ON UPDATE CASCADE;

