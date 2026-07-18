import { expect, type Page } from "@playwright/test";

export const E2E_ADDRESS = process.env.E2E_ADDRESS ?? "";

/** Wait for the app shell + wagmi to hydrate and the E2E wallet to auto-connect. */
export async function waitForConnected(page: Page): Promise<void> {
  // The custom account menu button only renders once wagmi reports connected.
  await expect(page.getByRole("button", { name: "Account menu" })).toBeVisible({
    timeout: 30_000,
  });
}

/** Navigate home and wait for the token feed / hero to render. */
export async function gotoHome(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Launch the next/i })).toBeVisible();
}

/** Generate a unique token name/symbol for launch tests. */
export function uniqueToken(prefix = "E2E"): { name: string; symbol: string } {
  const n = Date.now().toString().slice(-6);
  return { name: `${prefix} Coin ${n}`, symbol: `E${n}`.slice(0, 11) };
}
