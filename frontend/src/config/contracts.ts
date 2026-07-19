import { type Address } from "viem";

/**
 * Per-chain contract addresses. Loaded from Vite env vars at build time.
 * Each chain exposes: factory, feeRouter, creatorFeeVault, referralRegistry,
 * moonBurner, v3Concentrator, moonToken ($MOON governance token).
 *
 * All variables use the CHAIN_ prefix (configured via `envPrefix` in
 * vite.config.ts) so they are exposed to import.meta.env.
 */

export interface ChainContracts {
  factory: Address;
  feeRouter: Address;
  creatorFeeVault: Address;
  referralRegistry: Address;
  moonBurner: Address;
  v3Concentrator: Address;
  moonToken: Address;
}

const env = import.meta.env;

function addr(key: string): Address {
  const v = env[key] as string | undefined;
  if (!v) {
    console.warn(`[contracts] Missing env var ${key} — using zero address`);
    return "0x0000000000000000000000000000000000000000";
  }
  return v as Address;
}

export const contracts: Record<number, ChainContracts> = {
  56: {
    factory: addr("CHAIN_FACTORY_BSC"),
    feeRouter: addr("CHAIN_FEE_ROUTER_BSC"),
    creatorFeeVault: addr("CHAIN_CREATOR_FEE_VAULT_BSC"),
    referralRegistry: addr("CHAIN_REFERRAL_REGISTRY_BSC"),
    moonBurner: addr("CHAIN_MOON_BURNER_BSC"),
    v3Concentrator: addr("CHAIN_V3_CONCENTRATOR_BSC"),
    moonToken: addr("CHAIN_MOON_TOKEN_BSC"),
  },
  8453: {
    factory: addr("CHAIN_FACTORY_BASE"),
    feeRouter: addr("CHAIN_FEE_ROUTER_BASE"),
    creatorFeeVault: addr("CHAIN_CREATOR_FEE_VAULT_BASE"),
    referralRegistry: addr("CHAIN_REFERRAL_REGISTRY_BASE"),
    moonBurner: addr("CHAIN_MOON_BURNER_BASE"),
    v3Concentrator: addr("CHAIN_V3_CONCENTRATOR_BASE"),
    moonToken: addr("CHAIN_MOON_TOKEN_BASE"),
  },
  42161: {
    factory: addr("CHAIN_FACTORY_ARBITRUM"),
    feeRouter: addr("CHAIN_FEE_ROUTER_ARBITRUM"),
    creatorFeeVault: addr("CHAIN_CREATOR_FEE_VAULT_ARBITRUM"),
    referralRegistry: addr("CHAIN_REFERRAL_REGISTRY_ARBITRUM"),
    moonBurner: addr("CHAIN_MOON_BURNER_ARBITRUM"),
    v3Concentrator: addr("CHAIN_V3_CONCENTRATOR_ARBITRUM"),
    moonToken: addr("CHAIN_MOON_TOKEN_ARBITRUM"),
  },
  97: {
    factory: addr("CHAIN_FACTORY_BSC_TESTNET"),
    feeRouter: addr("CHAIN_FEE_ROUTER_BSC_TESTNET"),
    creatorFeeVault: addr("CHAIN_CREATOR_FEE_VAULT_BSC_TESTNET"),
    referralRegistry: addr("CHAIN_REFERRAL_REGISTRY_BSC_TESTNET"),
    moonBurner: addr("CHAIN_MOON_BURNER_BSC_TESTNET"),
    v3Concentrator: addr("CHAIN_V3_CONCENTRATOR_BSC_TESTNET"),
    moonToken: addr("CHAIN_MOON_TOKEN_BSC_TESTNET"),
  },
  84532: {
    factory: addr("CHAIN_FACTORY_BASE_SEPOLIA"),
    feeRouter: addr("CHAIN_FEE_ROUTER_BASE_SEPOLIA"),
    creatorFeeVault: addr("CHAIN_CREATOR_FEE_VAULT_BASE_SEPOLIA"),
    referralRegistry: addr("CHAIN_REFERRAL_REGISTRY_BASE_SEPOLIA"),
    moonBurner: addr("CHAIN_MOON_BURNER_BASE_SEPOLIA"),
    v3Concentrator: addr("CHAIN_V3_CONCENTRATOR_BASE_SEPOLIA"),
    moonToken: addr("CHAIN_MOON_TOKEN_BASE_SEPOLIA"),
  },
  421614: {
    factory: addr("CHAIN_FACTORY_ARBITRUM_SEPOLIA"),
    feeRouter: addr("CHAIN_FEE_ROUTER_ARBITRUM_SEPOLIA"),
    creatorFeeVault: addr("CHAIN_CREATOR_FEE_VAULT_ARBITRUM_SEPOLIA"),
    referralRegistry: addr("CHAIN_REFERRAL_REGISTRY_ARBITRUM_SEPOLIA"),
    moonBurner: addr("CHAIN_MOON_BURNER_ARBITRUM_SEPOLIA"),
    v3Concentrator: addr("CHAIN_V3_CONCENTRATOR_ARBITRUM_SEPOLIA"),
    moonToken: addr("CHAIN_MOON_TOKEN_ARBITRUM_SEPOLIA"),
  },
  11155111: {
    factory: addr("CHAIN_FACTORY_ETHEREUM_SEPOLIA"),
    feeRouter: addr("CHAIN_FEE_ROUTER_ETHEREUM_SEPOLIA"),
    creatorFeeVault: addr("CHAIN_CREATOR_FEE_VAULT_ETHEREUM_SEPOLIA"),
    referralRegistry: addr("CHAIN_REFERRAL_REGISTRY_ETHEREUM_SEPOLIA"),
    moonBurner: addr("CHAIN_MOON_BURNER_ETHEREUM_SEPOLIA"),
    v3Concentrator: addr("CHAIN_V3_CONCENTRATOR_ETHEREUM_SEPOLIA"),
    moonToken: addr("CHAIN_MOON_TOKEN_ETHEREUM_SEPOLIA"),
  },
  91342: {
    factory: addr("CHAIN_FACTORY_GIWA_SEPOLIA"),
    feeRouter: addr("CHAIN_FEE_ROUTER_GIWA_SEPOLIA"),
    creatorFeeVault: addr("CHAIN_CREATOR_FEE_VAULT_GIWA_SEPOLIA"),
    referralRegistry: addr("CHAIN_REFERRAL_REGISTRY_GIWA_SEPOLIA"),
    moonBurner: addr("CHAIN_MOON_BURNER_GIWA_SEPOLIA"),
    v3Concentrator: addr("CHAIN_V3_CONCENTRATOR_GIWA_SEPOLIA"),
    moonToken: addr("CHAIN_MOON_TOKEN_GIWA_SEPOLIA"),
  },
};

export function getContracts(chainId: number): ChainContracts | undefined {
  return contracts[chainId];
}
