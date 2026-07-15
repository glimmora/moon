import { type TokenListItem } from "@/hooks/useTokens";

const BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

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
    return getJson(`/api/tokens/${chainId}/${address}/holders`);
  },

  getBubblemap(chainId: number, address: string) {
    return getJson(`/api/tokens/${chainId}/${address}/bubblemap`);
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
};
