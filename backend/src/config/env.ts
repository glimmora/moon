import { z } from "zod";
import { config as loadEnv } from "dotenv";

loadEnv();

const schema = z.object({
  BACKEND_PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),

  JWT_SECRET: z.string().min(8).default("dev-secret"),

  // RPC URLs
  BSC_RPC_URL: z.string().url(),
  BASE_RPC_URL: z.string().url(),
  ARBITRUM_RPC_URL: z.string().url(),
  BSC_TESTNET_RPC_URL: z.string().url(),
  BASE_SEPOLIA_RPC_URL: z.string().url(),
  ARBITRUM_SEPOLIA_RPC_URL: z.string().url(),
  ETHEREUM_SEPOLIA_RPC_URL: z.string().url(),

  // Factory addresses
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
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("❌ Invalid environment variables:\n", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
