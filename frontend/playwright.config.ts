import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config for moon.fun.
 *
 * The dev server is started with the test-only wallet gate enabled:
 *   VITE_E2E=true                → activates the local PK connector + auto-connect
 *   VITE_E2E_PRIVATE_KEY=0x…     → throwaway/testnet key (never a prod secret)
 *   VITE_E2E_CHAIN_ID=11155111   → default connected chain
 *   VITE_RPC_ETHEREUM_SEPOLIA    → target RPC (anvil fork for `e2e`, live for `live`)
 *   VITE_API_URL                 → running backend
 *
 * These are injected by the runner scripts (see package.json), not hardcoded, so
 * the same specs run against both the anvil fork and live Sepolia.
 */
const PORT = Number(process.env.E2E_PORT ?? 4173);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Preview a production build so import.meta.env is baked with E2E flags.
    command: `npx vite build && npx vite preview --port ${PORT} --strictPort --host 127.0.0.1`,
    url: BASE_URL,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
  },
});
