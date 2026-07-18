import { type Chain as WagmiChain } from "wagmi/chains";

/**
 * Chain metadata for moon.fun. We define our own chain objects (rather than importing
 * from wagmi/chains) so we can attach the moon.fun-specific `chainMeta` (block explorer,
 * native symbol, RPC from env, etc.) and keep testnet/mainnet parity.
 */

type Chain = WagmiChain & { testnet?: boolean };

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

// Build an RPC list: a user-provided env RPC (if any) first, then several public
// fallbacks. The wagmi transport wraps these in `fallback()` so a single flaky
// endpoint can't take the app down.
function rpcs(env: string | undefined, ...fallbacks: string[]): [string, ...string[]] {
  const list = [env, ...fallbacks].filter((u): u is string => Boolean(u));
  return (list.length ? list : fallbacks) as [string, ...string[]];
}

const BSC = {
  id: 56,
  name: "BNB Smart Chain",
  nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  rpcUrls: {
    default: {
      http: rpcs(
        import.meta.env.CHAIN_BSC_RPC_URL,
        "https://bsc-dataseed.binance.org",
        "https://bsc-dataseed1.defibit.io",
        "https://rpc.ankr.com/bsc",
      ),
    },
  },
  blockExplorers: {
    default: { name: "BscScan", url: "https://bscscan.com" },
  },
  testnet: false,
} satisfies Chain;

const BSC_TESTNET = {
  id: 97,
  name: "BSC Testnet",
  nativeCurrency: { name: "BNB", symbol: "tBNB", decimals: 18 },
  rpcUrls: {
    default: {
      http: rpcs(
        import.meta.env.CHAIN_BSC_TESTNET_RPC_URL,
        "https://data-seed-prebsc-1-s1.binance.org:8545",
        "https://data-seed-prebsc-2-s1.binance.org:8545",
        "https://bsc-testnet.public.blastapi.io",
      ),
    },
  },
  blockExplorers: { default: { name: "BscScan", url: "https://testnet.bscscan.com" } },
  testnet: true,
} satisfies Chain;

const BASE = {
  id: 8453,
  name: "Base",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: rpcs(
        import.meta.env.CHAIN_BASE_RPC_URL,
        "https://mainnet.base.org",
        "https://base.llamarpc.com",
        "https://base.publicnode.com",
      ),
    },
  },
  blockExplorers: { default: { name: "Basescan", url: "https://basescan.org" } },
  testnet: false,
} satisfies Chain;

const BASE_SEPOLIA = {
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: rpcs(
        import.meta.env.CHAIN_BASE_SEPOLIA_RPC_URL,
        "https://sepolia.base.org",
        "https://base-sepolia.publicnode.com",
      ),
    },
  },
  blockExplorers: { default: { name: "Basescan", url: "https://sepolia.basescan.org" } },
  testnet: true,
} satisfies Chain;

const ARBITRUM = {
  id: 42161,
  name: "Arbitrum One",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: rpcs(
        import.meta.env.CHAIN_ARBITRUM_RPC_URL,
        "https://arb1.arbitrum.io/rpc",
        "https://arbitrum.llamarpc.com",
        "https://arbitrum-one.publicnode.com",
      ),
    },
  },
  blockExplorers: { default: { name: "Arbiscan", url: "https://arbiscan.io" } },
  testnet: false,
} satisfies Chain;

const ARBITRUM_SEPOLIA = {
  id: 421614,
  name: "Arbitrum Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: rpcs(
        import.meta.env.CHAIN_ARBITRUM_SEPOLIA_RPC_URL,
        "https://sepolia-rollup.arbitrum.io/rpc",
        "https://arbitrum-sepolia.publicnode.com",
      ),
    },
  },
  blockExplorers: { default: { name: "Arbiscan", url: "https://sepolia.arbiscan.io" } },
  testnet: true,
} satisfies Chain;

const ETHEREUM_SEPOLIA = {
  id: 11155111,
  name: "Ethereum Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: rpcs(
        import.meta.env.CHAIN_ETHEREUM_SEPOLIA_RPC_URL,
        "https://ethereum-sepolia-rpc.publicnode.com",
        "https://rpc.sepolia.org",
        "https://sepolia.gateway.tenderly.co",
      ),
    },
  },
  blockExplorers: { default: { name: "Etherscan", url: "https://sepolia.etherscan.io" } },
  testnet: true,
} satisfies Chain;

export const chainMeta: Record<number, ChainMeta> = {
  56: {
    label: "BNB Smart Chain",
    shortLabel: "BSC",
    explorer: "https://bscscan.com",
    explorerApi: "BscScan",
    nativeSymbol: "BNB",
    rpcEnv: "CHAIN_BSC_RPC_URL",
    isTestnet: false,
  },
  97: {
    label: "BSC Testnet",
    shortLabel: "BSC-T",
    explorer: "https://testnet.bscscan.com",
    nativeSymbol: "tBNB",
    rpcEnv: "CHAIN_BSC_TESTNET_RPC_URL",
    isTestnet: true,
  },
  8453: {
    label: "Base",
    shortLabel: "Base",
    explorer: "https://basescan.org",
    nativeSymbol: "ETH",
    rpcEnv: "CHAIN_BASE_RPC_URL",
    isTestnet: false,
  },
  84532: {
    label: "Base Sepolia",
    shortLabel: "Base-S",
    explorer: "https://sepolia.basescan.org",
    nativeSymbol: "ETH",
    rpcEnv: "CHAIN_BASE_SEPOLIA_RPC_URL",
    isTestnet: true,
  },
  42161: {
    label: "Arbitrum One",
    shortLabel: "Arb",
    explorer: "https://arbiscan.io",
    nativeSymbol: "ETH",
    rpcEnv: "CHAIN_ARBITRUM_RPC_URL",
    isTestnet: false,
  },
  421614: {
    label: "Arbitrum Sepolia",
    shortLabel: "Arb-S",
    explorer: "https://sepolia.arbiscan.io",
    nativeSymbol: "ETH",
    rpcEnv: "CHAIN_ARBITRUM_SEPOLIA_RPC_URL",
    isTestnet: true,
  },
  11155111: {
    label: "Ethereum Sepolia",
    shortLabel: "Eth-S",
    explorer: "https://sepolia.etherscan.io",
    nativeSymbol: "ETH",
    rpcEnv: "CHAIN_ETHEREUM_SEPOLIA_RPC_URL",
    isTestnet: true,
  },
};

export const moonChains: Chain[] = [
  BSC,
  BASE,
  ARBITRUM,
  BSC_TESTNET,
  BASE_SEPOLIA,
  ARBITRUM_SEPOLIA,
  ETHEREUM_SEPOLIA,
];

export const MAINNET_CHAIN_IDS = [56, 8453, 42161];
export const TESTNET_CHAIN_IDS = [97, 84532, 421614, 11155111];

export function getActiveChainIds(mode: NetworkMode): number[] {
  return mode === "mainnet" ? MAINNET_CHAIN_IDS : TESTNET_CHAIN_IDS;
}

export function chainById(id: number): Chain | undefined {
  return moonChains.find((c) => c.id === id);
}
