/// <reference types="vite/client" />

interface ImportMetaEnv {
  /* ─── Frontend app config (FRONTEND_ prefix, exposed by Vite) ─── */
  readonly FRONTEND_API_URL?: string;
  readonly FRONTEND_WALLETCONNECT_PROJECT_ID?: string;

  /* ─── Chain RPC URLs (CHAIN_ prefix) ─── */
  readonly CHAIN_BSC_RPC_URL?: string;
  readonly CHAIN_BASE_RPC_URL?: string;
  readonly CHAIN_ARBITRUM_RPC_URL?: string;
  readonly CHAIN_BSC_TESTNET_RPC_URL?: string;
  readonly CHAIN_BASE_SEPOLIA_RPC_URL?: string;
  readonly CHAIN_ARBITRUM_SEPOLIA_RPC_URL?: string;
  readonly CHAIN_ETHEREUM_SEPOLIA_RPC_URL?: string;

  /* ─── Chain contract addresses — factory (CHAIN_ prefix) ─── */
  readonly CHAIN_FACTORY_BSC?: string;
  readonly CHAIN_FACTORY_BASE?: string;
  readonly CHAIN_FACTORY_ARBITRUM?: string;
  readonly CHAIN_FACTORY_BSC_TESTNET?: string;
  readonly CHAIN_FACTORY_BASE_SEPOLIA?: string;
  readonly CHAIN_FACTORY_ARBITRUM_SEPOLIA?: string;
  readonly CHAIN_FACTORY_ETHEREUM_SEPOLIA?: string;

  /* ─── Chain contract addresses — feeRouter ─── */
  readonly CHAIN_FEE_ROUTER_BSC?: string;
  readonly CHAIN_FEE_ROUTER_BASE?: string;
  readonly CHAIN_FEE_ROUTER_ARBITRUM?: string;
  readonly CHAIN_FEE_ROUTER_BSC_TESTNET?: string;
  readonly CHAIN_FEE_ROUTER_BASE_SEPOLIA?: string;
  readonly CHAIN_FEE_ROUTER_ARBITRUM_SEPOLIA?: string;
  readonly CHAIN_FEE_ROUTER_ETHEREUM_SEPOLIA?: string;

  /* ─── Chain contract addresses — creatorFeeVault ─── */
  readonly CHAIN_CREATOR_FEE_VAULT_BSC?: string;
  readonly CHAIN_CREATOR_FEE_VAULT_BASE?: string;
  readonly CHAIN_CREATOR_FEE_VAULT_ARBITRUM?: string;
  readonly CHAIN_CREATOR_FEE_VAULT_BSC_TESTNET?: string;
  readonly CHAIN_CREATOR_FEE_VAULT_BASE_SEPOLIA?: string;
  readonly CHAIN_CREATOR_FEE_VAULT_ARBITRUM_SEPOLIA?: string;
  readonly CHAIN_CREATOR_FEE_VAULT_ETHEREUM_SEPOLIA?: string;

  /* ─── Chain contract addresses — referralRegistry ─── */
  readonly CHAIN_REFERRAL_REGISTRY_BSC?: string;
  readonly CHAIN_REFERRAL_REGISTRY_BASE?: string;
  readonly CHAIN_REFERRAL_REGISTRY_ARBITRUM?: string;
  readonly CHAIN_REFERRAL_REGISTRY_BSC_TESTNET?: string;
  readonly CHAIN_REFERRAL_REGISTRY_BASE_SEPOLIA?: string;
  readonly CHAIN_REFERRAL_REGISTRY_ARBITRUM_SEPOLIA?: string;
  readonly CHAIN_REFERRAL_REGISTRY_ETHEREUM_SEPOLIA?: string;

  /* ─── Chain contract addresses — moonBurner ─── */
  readonly CHAIN_MOON_BURNER_BSC?: string;
  readonly CHAIN_MOON_BURNER_BASE?: string;
  readonly CHAIN_MOON_BURNER_ARBITRUM?: string;
  readonly CHAIN_MOON_BURNER_BSC_TESTNET?: string;
  readonly CHAIN_MOON_BURNER_BASE_SEPOLIA?: string;
  readonly CHAIN_MOON_BURNER_ARBITRUM_SEPOLIA?: string;
  readonly CHAIN_MOON_BURNER_ETHEREUM_SEPOLIA?: string;

  /* ─── Chain contract addresses — v3Concentrator ─── */
  readonly CHAIN_V3_CONCENTRATOR_BSC?: string;
  readonly CHAIN_V3_CONCENTRATOR_BASE?: string;
  readonly CHAIN_V3_CONCENTRATOR_ARBITRUM?: string;
  readonly CHAIN_V3_CONCENTRATOR_BSC_TESTNET?: string;
  readonly CHAIN_V3_CONCENTRATOR_BASE_SEPOLIA?: string;
  readonly CHAIN_V3_CONCENTRATOR_ARBITRUM_SEPOLIA?: string;
  readonly CHAIN_V3_CONCENTRATOR_ETHEREUM_SEPOLIA?: string;

  /* ─── Chain contract addresses — moonToken ($MOON governance) ─── */
  readonly CHAIN_MOON_TOKEN_BSC?: string;
  readonly CHAIN_MOON_TOKEN_BASE?: string;
  readonly CHAIN_MOON_TOKEN_ARBITRUM?: string;
  readonly CHAIN_MOON_TOKEN_BSC_TESTNET?: string;
  readonly CHAIN_MOON_TOKEN_BASE_SEPOLIA?: string;
  readonly CHAIN_MOON_TOKEN_ARBITRUM_SEPOLIA?: string;
  readonly CHAIN_MOON_TOKEN_ETHEREUM_SEPOLIA?: string;

  /* ─── E2E test flags (E2E_ prefix) ─── */
  readonly E2E_ENABLED?: string;
  readonly E2E_PRIVATE_KEY?: string;
  readonly E2E_CHAIN_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
