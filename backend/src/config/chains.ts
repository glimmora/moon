import { env } from "./env.js";

export interface ChainConfig {
  chainId: number;
  label: string;
  shortLabel: string;
  explorer: string;
  rpcUrl: string;
  factoryAddress?: string;
  nativeSymbol: string;
  isTestnet: boolean;
}

export const chainConfigs: ChainConfig[] = [
  {
    chainId: 56,
    label: "BNB Smart Chain",
    shortLabel: "BSC",
    explorer: "https://bscscan.com",
    rpcUrl: env.CHAIN_BSC_RPC_URL,
    factoryAddress: env.CHAIN_FACTORY_BSC,
    nativeSymbol: "BNB",
    isTestnet: false,
  },
  {
    chainId: 8453,
    label: "Base",
    shortLabel: "Base",
    explorer: "https://basescan.org",
    rpcUrl: env.CHAIN_BASE_RPC_URL,
    factoryAddress: env.CHAIN_FACTORY_BASE,
    nativeSymbol: "ETH",
    isTestnet: false,
  },
  {
    chainId: 42161,
    label: "Arbitrum One",
    shortLabel: "Arb",
    explorer: "https://arbiscan.io",
    rpcUrl: env.CHAIN_ARBITRUM_RPC_URL,
    factoryAddress: env.CHAIN_FACTORY_ARBITRUM,
    nativeSymbol: "ETH",
    isTestnet: false,
  },
  {
    chainId: 97,
    label: "BSC Testnet",
    shortLabel: "BSC-T",
    explorer: "https://testnet.bscscan.com",
    rpcUrl: env.CHAIN_BSC_TESTNET_RPC_URL,
    factoryAddress: env.CHAIN_FACTORY_BSC_TESTNET,
    nativeSymbol: "tBNB",
    isTestnet: true,
  },
  {
    chainId: 84532,
    label: "Base Sepolia",
    shortLabel: "Base-S",
    explorer: "https://sepolia.basescan.org",
    rpcUrl: env.CHAIN_BASE_SEPOLIA_RPC_URL,
    factoryAddress: env.CHAIN_FACTORY_BASE_SEPOLIA,
    nativeSymbol: "ETH",
    isTestnet: true,
  },
  {
    chainId: 421614,
    label: "Arbitrum Sepolia",
    shortLabel: "Arb-S",
    explorer: "https://sepolia.arbiscan.io",
    rpcUrl: env.CHAIN_ARBITRUM_SEPOLIA_RPC_URL,
    factoryAddress: env.CHAIN_FACTORY_ARBITRUM_SEPOLIA,
    nativeSymbol: "ETH",
    isTestnet: true,
  },
  {
    chainId: 11155111,
    label: "Ethereum Sepolia",
    shortLabel: "Eth-S",
    explorer: "https://sepolia.etherscan.io",
    rpcUrl: env.CHAIN_ETHEREUM_SEPOLIA_RPC_URL,
    factoryAddress: env.CHAIN_FACTORY_ETHEREUM_SEPOLIA,
    nativeSymbol: "ETH",
    isTestnet: true,
  },
  {
    chainId: 91342,
    label: "Giwa Sepolia",
    shortLabel: "Giwa-S",
    explorer: "https://sepolia-explorer.giwa.io",
    rpcUrl: env.CHAIN_GIWA_SEPOLIA_RPC_URL,
    factoryAddress: env.CHAIN_FACTORY_GIWA_SEPOLIA,
    nativeSymbol: "ETH",
    isTestnet: true,
  },
];

export const SUPPORTED_CHAIN_IDS = new Set(chainConfigs.map((c) => c.chainId));

export function chainById(chainId: number): ChainConfig | undefined {
  return chainConfigs.find((c) => c.chainId === chainId);
}

export function activeChains(): ChainConfig[] {
  return chainConfigs.filter((c) => Boolean(c.factoryAddress));
}
