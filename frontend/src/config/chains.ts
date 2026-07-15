import { type Chain } from "wagmi/chains";

/**
 * Chain metadata for moon.fun. We define our own chain objects (rather than importing
 * from wagmi/chains) so we can attach the moon.fun-specific `chainMeta` (block explorer,
 * native symbol, RPC from env, etc.) and keep testnet/mainnet parity.
 */

export type NetworkMode = "mainnet" | "testnet";

export interface ChainMeta {
  label: string;
  shortLabel: string;
  explorer: string;
  explorerApi?: string;
  nativeSymbol: string;
  rpcEnv: string;
  isTestnet: boolean;
}

const BSC = {
  id: 56,
  name: "BNB Smart Chain",
  nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  rpcUrls: {
    default: { http: [import.meta.env.VITE_RPC_BSC || "https://bsc-dataseed.binance.org"] },
  },
  blockExplorers: {
    default: { name: "BscScan", url: "https://bscscan.com" },
  },
  testnet: false,
} as const;

const BSC_TESTNET = {
  id: 97,
  name: "BSC Testnet",
  nativeCurrency: { name: "BNB", symbol: "tBNB", decimals: 18 },
  rpcUrls: {
    default: {
      http: [import.meta.env.VITE_RPC_BSC_TESTNET || "https://data-seed-prebsc-1-s1.binance.org:8545"],
    },
  },
  blockExplorers: { default: { name: "BscScan", url: "https://testnet.bscscan.com" } },
  testnet: true,
} as const;

const BASE = {
  id: 8453,
  name: "Base",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [import.meta.env.VITE_RPC_BASE || "https://mainnet.base.org"] },
  },
  blockExplorers: { default: { name: "Basescan", url: "https://basescan.org" } },
  testnet: false,
} as const;

const BASE_SEPOLIA = {
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [import.meta.env.VITE_RPC_BASE_SEPOLIA || "https://sepolia.base.org"] },
  },
  blockExplorers: { default: { name: "Basescan", url: "https://sepolia.basescan.org" } },
  testnet: true,
} as const;

const ARBITRUM = {
  id: 42161,
  name: "Arbitrum One",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [import.meta.env.VITE_RPC_ARBITRUM || "https://arb1.arbitrum.io/rpc"] },
  },
  blockExplorers: { default: { name: "Arbiscan", url: "https://arbiscan.io" } },
  testnet: false,
} as const;

const ARBITRUM_SEPOLIA = {
  id: 421614,
  name: "Arbitrum Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [import.meta.env.VITE_RPC_ARBITRUM_SEPOLIA || "https://sepolia-arbitrum.api.onrender.com"],
    },
  },
  blockExplorers: { default: { name: "Arbiscan", url: "https://sepolia.arbiscan.io" } },
  testnet: true,
} as const;

const ETHEREUM_SEPOLIA = {
  id: 11155111,
  name: "Ethereum Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [import.meta.env.VITE_RPC_ETHEREUM_SEPOLIA || "https://rpc.sepolia.org"] },
  },
  blockExplorers: { default: { name: "Etherscan", url: "https://sepolia.etherscan.io" } },
  testnet: true,
} as const;

export const chainMeta: Record<number, ChainMeta> = {
  56: {
    label: "BNB Smart Chain",
    shortLabel: "BSC",
    explorer: "https://bscscan.com",
    explorerApi: "BscScan",
    nativeSymbol: "BNB",
    rpcEnv: "VITE_RPC_BSC",
    isTestnet: false,
  },
  97: {
    label: "BSC Testnet",
    shortLabel: "BSC-T",
    explorer: "https://testnet.bscscan.com",
    nativeSymbol: "tBNB",
    rpcEnv: "VITE_RPC_BSC_TESTNET",
    isTestnet: true,
  },
  8453: {
    label: "Base",
    shortLabel: "Base",
    explorer: "https://basescan.org",
    nativeSymbol: "ETH",
    rpcEnv: "VITE_RPC_BASE",
    isTestnet: false,
  },
  84532: {
    label: "Base Sepolia",
    shortLabel: "Base-S",
    explorer: "https://sepolia.basescan.org",
    nativeSymbol: "ETH",
    rpcEnv: "VITE_RPC_BASE_SEPOLIA",
    isTestnet: true,
  },
  42161: {
    label: "Arbitrum One",
    shortLabel: "Arb",
    explorer: "https://arbiscan.io",
    nativeSymbol: "ETH",
    rpcEnv: "VITE_RPC_ARBITRUM",
    isTestnet: false,
  },
  421614: {
    label: "Arbitrum Sepolia",
    shortLabel: "Arb-S",
    explorer: "https://sepolia.arbiscan.io",
    nativeSymbol: "ETH",
    rpcEnv: "VITE_RPC_ARBITRUM_SEPOLIA",
    isTestnet: true,
  },
  11155111: {
    label: "Ethereum Sepolia",
    shortLabel: "Eth-S",
    explorer: "https://sepolia.etherscan.io",
    nativeSymbol: "ETH",
    rpcEnv: "VITE_RPC_ETHEREUM_SEPOLIA",
    isTestnet: true,
  },
};

export const moonChains = [
  BSC,
  BASE,
  ARBITRUM,
  BSC_TESTNET,
  BASE_SEPOLIA,
  ARBITRUM_SEPOLIA,
  ETHEREUM_SEPOLIA,
] as unknown as Chain[];

export const MAINNET_CHAIN_IDS = [56, 8453, 42161];
export const TESTNET_CHAIN_IDS = [97, 84532, 421614, 11155111];

export function getActiveChainIds(mode: NetworkMode): number[] {
  return mode === "mainnet" ? MAINNET_CHAIN_IDS : TESTNET_CHAIN_IDS;
}

export function chainById(id: number): Chain | undefined {
  return moonChains.find((c) => c.id === id);
}
