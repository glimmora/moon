import { type TokenListItem } from "@/hooks/useTokens";

const BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

export interface Holder {
  address: string;
  balance: string;
  percentage: number;
  isContract: boolean;
  firstSeen: number;
}

export interface BubblemapNode {
  id: string;
  address: string;
  balance: string;
  percentage: number;
  isContract: boolean;
  connections: string[];
}

/* ── Portfolio types ── */
export interface PortfolioPosition {
  chainId: number;
  tokenAddress: string;
  name: string;
  symbol: string;
  imageUrl: string;
  balance: string;
  balanceDisplay: number;
  priceUsd: number;
  valueUsd: number;
  percentage: number;
  graduated: boolean;
  curveShape: number;
}

export interface PortfolioTrade {
  txHash: string;
  chainId: number;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  side: "buy" | "sell" | "graduate";
  quoteAmount: string;
  tokenAmount: string;
  priceUsd: number;
  timestamp: number;
}

export interface PortfolioCreatedToken {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  imageUrl: string;
  supplyTier: number;
  curveShape: number;
  priceUsd: number;
  marketCapUsd: number;
  holders: number;
  volume24h: number;
  graduated: boolean;
  createdAt: number;
}

export interface Portfolio {
  address: string;
  totalValueUsd: number;
  totalVolume: number;
  tradeCount: number;
  createdCount: number;
  graduatedCount: number;
  positions: PortfolioPosition[];
  recentTrades: PortfolioTrade[];
  createdTokens: PortfolioCreatedToken[];
}

/* ── Leaderboard types ── */
export interface LeaderboardTrader {
  rank: number;
  address: string;
  volume: string;
  volumeUsd: number;
  trades: number;
}

export interface LeaderboardCreator {
  rank: number;
  address: string;
  tokensCreated: number;
  totalVolume24h: number;
  totalHolders: number;
}

export interface LeaderboardToken {
  rank: number;
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  imageUrl: string;
  supplyTier: number;
  curveShape: number;
  priceUsd: number;
  marketCapUsd: number;
  holders: number;
  volume24h: number;
  graduated: boolean;
  creator: string;
  createdAt: number;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return (await res.json()) as T;
}

export interface TokenMeta {
  address: string;
  chainId: number;
  name: string;
  symbol: string;
  imageUrl: string;
  description: string;
  supplyTier: number;
  curveShape: number;
  totalSupply: string;
  creator: string;
  curve: string;
  createdAt: number;
  graduated: boolean;
  dexPair?: string;
  priceUsd: number;
  marketCapUsd: number;
  holders: number;
  volume24h: number;
}

export interface Trade {
  txHash: string;
  chainId: number;
  token: string;
  side: "buy" | "sell";
  trader: string;
  quoteAmount: string;
  tokenAmount: string;
  priceUsd: number;
  timestamp: number;
}

export const api = {
  getTokens(chainId?: number): Promise<TokenListItem[]> {
    const qs = chainId ? `?chainId=${chainId}` : "";
    return getJson(`/api/tokens${qs}`);
  },

  getToken(chainId: number, address: string): Promise<TokenMeta> {
    return getJson(`/api/tokens/${chainId}/${address}`);
  },

  getTrades(chainId: number, address: string, limit = 50): Promise<Trade[]> {
    return getJson(`/api/tokens/${chainId}/${address}/trades?limit=${limit}`);
  },

  getHolders(chainId: number, address: string) {
    return getJson<Holder[]>(`/api/tokens/${chainId}/${address}/holders`);
  },

  getBubblemap(chainId: number, address: string) {
    return getJson<BubblemapNode[]>(`/api/tokens/${chainId}/${address}/bubblemap`);
  },

  getPriceHistory(chainId: number, address: string, window = "24h") {
    return getJson<{ time: number; priceUsd: number }[]>(
      `/api/tokens/${chainId}/${address}/prices?window=${window}`,
    );
  },

  getCreatorFees(creator: string) {
    return getJson<{ quoteAsset: string; amount: string }[]>(`/api/creator-fees/${creator}`);
  },

  getReferralStats(referrer: string) {
    return getJson<{ volume: string; rewards: string; count: number }>(`/api/referrals/${referrer}`);
  },

  search(q: string) {
    return getJson<TokenListItem[]>(`/api/search?q=${encodeURIComponent(q)}`);
  },

  /* ── Portfolio ── */
  getPortfolio(address: string): Promise<Portfolio> {
    return getJson<Portfolio>(`/api/portfolio/${address}`);
  },

  /* ── Leaderboard ── */
  getTopTraders(limit = 50): Promise<LeaderboardTrader[]> {
    return getJson<LeaderboardTrader[]>(`/api/leaderboard/traders?limit=${limit}`);
  },

  getTopCreators(limit = 50): Promise<LeaderboardCreator[]> {
    return getJson<LeaderboardCreator[]>(`/api/leaderboard/creators?limit=${limit}`);
  },

  getTopTokens(sort: "volume" | "holders" | "marketcap" = "volume", limit = 50): Promise<LeaderboardToken[]> {
    return getJson<LeaderboardToken[]>(`/api/leaderboard/tokens?sort=${sort}&limit=${limit}`);
  },
};
