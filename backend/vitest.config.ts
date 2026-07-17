import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    setupFiles: ["test/setup.ts"],
    passWithNoTests: true,
    // Integration tests share one Postgres schema; run serially to avoid
    // cross-suite data races from parallel seed()/reset().
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
