import { z } from "zod";
import { config as loadEnv } from "dotenv";

loadEnv();

const schema = z.object({
  BACKEND_PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  // Postgres connection string (postgresql://…). Postgres is the only supported
  // provider; use docker-compose (see repo root) for a local instance.
  DATABASE_URL: z.string().min(1),

  JWT_SECRET: z.string().min(32),

  // RPC URLs — all optional with defaults so the backend can start even
  // if some chains are not configured.
  BSC_RPC_URL: z.string().url().default("https://bsc-dataseed.binance.org"),
  BASE_RPC_URL: z.string().url().default("https://mainnet.base.org"),
  ARBITRUM_RPC_URL: z.string().url().default("https://arb1.arbitrum.io/rpc"),
  BSC_TESTNET_RPC_URL: z.string().url().default("https://data-seed-prebsc-1-s1.binance.org:8545"),
  BASE_SEPOLIA_RPC_URL: z.string().url().default("https://sepolia.base.org"),
  ARBITRUM_SEPOLIA_RPC_URL: z.string().url().default("https://sepolia-arbitrum.api.onrender.com"),
  ETHEREUM_SEPOLIA_RPC_URL: z.string().url().default("https://ethereum-sepolia-rpc.publicnode.com"),

  // Factory addresses — optional (indexer only starts for configured chains)
  FACTORY_BSC: z.string().optional(),
  FACTORY_BASE: z.string().optional(),
  FACTORY_ARBITRUM: z.string().optional(),
  FACTORY_BSC_TESTNET: z.string().optional(),
  FACTORY_BASE_SEPOLIA: z.string().optional(),
  FACTORY_ARBITRUM_SEPOLIA: z.string().optional(),
  FACTORY_ETHEREUM_SEPOLIA: z.string().optional(),

  // Wallets
  TREASURY_ADDRESS: z.string().optional(),
  DEV_WALLET_ADDRESS: z.string().optional(),
  MOON_TOKEN: z.string().optional(),

  // Indexer
  POLL_INTERVAL_MS: z.coerce.number().default(4000),
  START_BLOCK_OFFSET: z.coerce.number().default(10000),
  MAX_BLOCK_BATCH: z.coerce.number().default(500),
  // Number of block confirmations to lag behind chain head. Events within this
  // window may still be reorged out, so we never index blocks newer than
  // (head - CONFIRMATIONS). Reorgs shallower than this are absorbed transparently.
  CONFIRMATIONS: z.coerce.number().default(12),
  // On each poll we re-scan the last N confirmed blocks to heal shallow reorgs
  // (upserts are idempotent). Must be <= CONFIRMATIONS to stay in the safe zone.
  REORG_REWIND_BLOCKS: z.coerce.number().default(12),
}).refine((e) => e.REORG_REWIND_BLOCKS <= e.CONFIRMATIONS, {
  message: "REORG_REWIND_BLOCKS must be <= CONFIRMATIONS (else the rewind scans into the unsafe reorg window)",
  path: ["REORG_REWIND_BLOCKS"],
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("❌ Invalid environment variables:\n", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
