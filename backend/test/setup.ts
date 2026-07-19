import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Global test setup — runs before any test module is imported (registered via
 * vitest `setupFiles`). It pins the environment so that config/env.ts validation
 * passes and Prisma points at the isolated `qa_test` schema rather than the live
 * indexer data in `public`.
 *
 * The test DATABASE_URL is read from an untracked file written during QA setup
 * (falls back to an env var / a schema-scoped local URL). It never touches the
 * production `public` schema.
 */
function resolveTestDbUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  try {
    const f = join(homedir(), ".moon-qa", ".testdburl");
    return readFileSync(f, "utf8").trim();
  } catch {
    return "postgresql://moon:moon@localhost:5432/moon?schema=qa_test";
  }
}

process.env.NODE_ENV = "test";
process.env.AUTH_JWT_SECRET =
  process.env.AUTH_JWT_SECRET ?? "test-secret-test-secret-test-secret-123456";
process.env.DB_PROVIDER = "postgresql";
process.env.DB_URL = resolveTestDbUrl();
process.env.BACKEND_CORS_ORIGIN = process.env.BACKEND_CORS_ORIGIN ?? "http://localhost:5173";
