import { useReadContract } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { getContracts } from "@/config/contracts";
import { bondingCurveAbi } from "@/abi/BondingCurve";
import { moonTokenAbi } from "@/abi/MoonToken";
import { api } from "@/services/api";
import { type Address } from "viem";

export interface TokenDetailData {
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
  createdAt: number;
  graduated: boolean;
  dexPair?: string;

  // Curve state
  realTokenReserves: bigint;
  realQuoteReserves: bigint;
  virtualTokenReserves: bigint;
  virtualQuoteReserves: bigint;
  totalSupplyInit: bigint;
  creationBlock: bigint;
  price: bigint;

  // Off-chain
  priceUsd: number;
  marketCapUsd: number;
  holders: number;
  volume24h: number;
  priceHistory: { time: number; priceUsd: number }[];
}

export function useTokenDetail(chainId: number, tokenAddress: Address) {
  const contracts = getContracts(chainId);

  // 1. Off-chain metadata + history from backend.
  const meta = useQuery({
    queryKey: ["token-meta", chainId, tokenAddress],
    queryFn: () => api.getToken(chainId, tokenAddress),
    enabled: Boolean(tokenAddress),
    refetchInterval: 10_000,
  });

  // 2. On-chain curve state. The backend index tells us which curve belongs to this token.
  const curveAddress = meta.data?.curve as Address | undefined;

  const curveState = useReadContract({
    abi: bondingCurveAbi,
    address: curveAddress,
    functionName: "price",
    chainId,
    query: { enabled: Boolean(curveAddress) },
  });

  const tokenMeta = useReadContract({
    abi: moonTokenAbi,
    address: tokenAddress,
    functionName: "symbol",
    chainId,
    query: { enabled: Boolean(tokenAddress) },
  });

  return {
    meta,
    curveState,
    tokenMeta,
    factoryAddress: contracts?.factory,
  };
}

export function useCurveState(chainId: number, curveAddress?: Address) {
  const reads = useReadContracts({
    contracts: [
      { abi: bondingCurveAbi, address: curveAddress, functionName: "price", chainId },
      { abi: bondingCurveAbi, address: curveAddress, functionName: "s_realTokenReserves", chainId },
      { abi: bondingCurveAbi, address: curveAddress, functionName: "s_realQuoteReserves", chainId },
      { abi: bondingCurveAbi, address: curveAddress, functionName: "s_virtualTokenReserves", chainId },
      { abi: bondingCurveAbi, address: curveAddress, functionName: "s_virtualQuoteReserves", chainId },
      { abi: bondingCurveAbi, address: curveAddress, functionName: "s_totalSupplyInit", chainId },
      { abi: bondingCurveAbi, address: curveAddress, functionName: "creationBlock", chainId },
      { abi: bondingCurveAbi, address: curveAddress, functionName: "graduated", chainId },
    ],
    query: { enabled: Boolean(curveAddress) },
  });

  return reads;
}

// Helper: wagmi v2 multi-read hook alias.
function useReadContracts(args: {
  contracts: readonly { address?: Address; abi: unknown; functionName: string; chainId: number }[];
  query?: { enabled?: boolean };
}) {
  // We use the named import from wagmi below to avoid a circular type issue.
  return useWagmiReadContracts(args as never);
}

import { useReadContracts as useWagmiReadContracts } from "wagmi";
