import { z } from "zod";
import { config as loadEnv } from "dotenv";

loadEnv();

const schema = z.object({
  BACKEND_PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  // CORS allowlist (comma-separated origins) for the HTTP + Socket.io servers.
  BACKEND_CORS_ORIGIN: z.string().default("http://localhost:5173"),

  // ── Database (DB_ prefix) ──
  // PostgreSQL connection string (postgresql://…). Postgres is the only supported
  // provider; use docker-compose (see repo root) for a local instance.
  DB_URL: z.string().min(1),
  DB_PROVIDER: z.string().default("postgresql"),

  // ── Auth (AUTH_ prefix) ──
  // JWT signing secret (min 32 chars) for SIWE wallet auth.
  AUTH_JWT_SECRET: z.string().min(32),

  // ── Chain RPC URLs (CHAIN_ prefix) ──
  // All optional with defaults so the backend can start even if some chains
  // are not configured.
  CHAIN_BSC_RPC_URL: z.string().url().default("https://bsc-dataseed.binance.org"),
  CHAIN_BASE_RPC_URL: z.string().url().default("https://mainnet.base.org"),
  CHAIN_ARBITRUM_RPC_URL: z.string().url().default("https://arb1.arbitrum.io/rpc"),
  CHAIN_BSC_TESTNET_RPC_URL: z.string().url().default("https://data-seed-prebsc-1-s1.binance.org:8545"),
  CHAIN_BASE_SEPOLIA_RPC_URL: z.string().url().default("https://sepolia.base.org"),
  CHAIN_ARBITRUM_SEPOLIA_RPC_URL: z.string().url().default("https://sepolia-arbitrum.api.onrender.com"),
  CHAIN_ETHEREUM_SEPOLIA_RPC_URL: z.string().url().default("https://ethereum-sepolia-rpc.publicnode.com"),

  // ── Chain factory addresses (CHAIN_ prefix) ──
  // Optional (indexer only starts for configured chains).
  CHAIN_FACTORY_BSC: z.string().optional(),
  CHAIN_FACTORY_BASE: z.string().optional(),
  CHAIN_FACTORY_ARBITRUM: z.string().optional(),
  CHAIN_FACTORY_BSC_TESTNET: z.string().optional(),
  CHAIN_FACTORY_BASE_SEPOLIA: z.string().optional(),
  CHAIN_FACTORY_ARBITRUM_SEPOLIA: z.string().optional(),
  CHAIN_FACTORY_ETHEREUM_SEPOLIA: z.string().optional(),

  // ── Wallet addresses (WALLET_ prefix) ──
  // Used for fee-routing metadata on indexed events.
  WALLET_TREASURY_ADDRESS: z.string().optional(),
  WALLET_DEV_ADDRESS: z.string().optional(),
  // $MOON governance token address (per active chain; only Eth Sepolia used today).
  CHAIN_MOON_TOKEN_ETHEREUM_SEPOLIA: z.string().optional(),

  // ── Indexer (BACKEND_ prefix) ──
  BACKEND_POLL_INTERVAL_MS: z.coerce.number().default(4000),
  BACKEND_START_BLOCK_OFFSET: z.coerce.number().default(10000),
  BACKEND_MAX_BLOCK_BATCH: z.coerce.number().default(500),
  // Number of block confirmations to lag behind chain head. Events within this
  // window may still be reorged out, so we never index blocks newer than
  // (head - BACKEND_CONFIRMATIONS). Reorgs shallower than this are absorbed transparently.
  BACKEND_CONFIRMATIONS: z.coerce.number().default(12),
  // On each poll we re-scan the last N confirmed blocks to heal shallow reorgs
  // (upserts are idempotent). Must be <= BACKEND_CONFIRMATIONS to stay in the safe zone.
  BACKEND_REORG_REWIND_BLOCKS: z.coerce.number().default(12),
}).refine((e) => e.BACKEND_REORG_REWIND_BLOCKS <= e.BACKEND_CONFIRMATIONS, {
  message: "BACKEND_REORG_REWIND_BLOCKS must be <= BACKEND_CONFIRMATIONS (else the rewind scans into the unsafe reorg window)",
  path: ["BACKEND_REORG_REWIND_BLOCKS"],
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("❌ Invalid environment variables:\n", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
