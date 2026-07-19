import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config for Moon.
 *
 * The dev server is started with the test-only wallet gate enabled:
 *   E2E_ENABLED=true                 → activates the local PK connector + auto-connect
 *   E2E_PRIVATE_KEY=0x…             → throwaway/testnet key (never a prod secret)
 *   E2E_CHAIN_ID=11155111           → default connected chain
 *   CHAIN_ETHEREUM_SEPOLIA_RPC_URL  → target RPC (anvil fork for `e2e`, live for `live`)
 *   FRONTEND_API_URL                → running backend
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
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
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
