import { test, expect } from "@playwright/test";
import { gotoHome } from "./helpers";

/**
 * Read-only navigation flows. These require the backend API (FRONTEND_API_URL) and
 * a target chain RPC to be reachable, but no wallet writes.
 */

test.describe("read flows", () => {
  test("home renders hero, stats and CTAs", async ({ page }) => {
    await gotoHome(page);
    const main = page.locator("#main-content");
    await expect(main.getByRole("link", { name: /Launch Token/i })).toBeVisible();
    await expect(main.getByRole("link", { name: /Explore/i })).toBeVisible();
    // Live stat pills present (Tokens / 24h Volume / Graduated / Chains).
    await expect(page.getByText("Tokens", { exact: true })).toBeVisible();
    await expect(page.getByText("Chains", { exact: true })).toBeVisible();
  });

  test("token feed lists tokens and navigates to detail", async ({ page }) => {
    await gotoHome(page);
    // The feed renders token cards with an accessible "… details" label.
    const firstCard = page.getByRole("link", { name: /details$/i }).first();
    await expect(firstCard).toBeVisible({ timeout: 20_000 });
    await firstCard.click();
    await expect(page).toHaveURL(/\/token\/\d+\/0x[0-9a-fA-F]{40}/);
    // The token views tablist always renders on a loaded detail page
    // (Chart / Holders / Bubblemap), regardless of graduation status.
    await expect(page.getByRole("tablist", { name: /Token views/i })).toBeVisible({
      timeout: 20_000,
    });
  });

  test("search finds a token by query", async ({ page }) => {
    await gotoHome(page);
    // Open search via keyboard shortcut (works regardless of viewport).
    await page.keyboard.press("Control+KeyK");
    const dialog = page.getByRole("dialog", { name: /Search tokens/i });
    await expect(dialog).toBeVisible();
    const input = dialog.getByPlaceholder(/Search by name, symbol, or address/i);
    await input.fill("a");
    await input.fill("moon");
    // Either results appear or we navigate to /advanced; submit to be deterministic.
    await input.press("Enter");
    await expect(page).toHaveURL(/\/advanced\?q=moon/);
  });

  test("navigates to leaderboard", async ({ page }) => {
    await page.goto("/leaderboard");
    await expect(page.getByRole("heading", { name: /leaderboard/i }).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("token detail page renders trade panel", async ({ page }) => {
    await gotoHome(page);
    const firstCard = page.getByRole("link", { name: /details$/i }).first();
    await expect(firstCard).toBeVisible({ timeout: 20_000 });
    await firstCard.click();
    await expect(page).toHaveURL(/\/token\/\d+\/0x[0-9a-fA-F]{40}/);

    // Trade panel is present with Buy/Sell tabs.
    const tradePanel = page.getByRole("heading", { name: /Trade/i });
    await expect(tradePanel).toBeVisible({ timeout: 20_000 });
    await page.waitForLoadState("networkidle");

    // Buy tab is active by default (text is lowercase "buy").
    await expect(page.getByRole("button", { name: "buy", exact: true })).toBeVisible({ timeout: 20_000 });

    // Sell tab exists and can be clicked.
    await page.getByRole("button", { name: "sell", exact: true }).click();

    // Slippage settings toggle.
    await page.getByRole("button", { name: /Trade settings/i }).click();
    await expect(page.getByText(/Slippage Tolerance/i)).toBeVisible();
  });

  test("unknown route renders NotFound", async ({ page }) => {
    await page.goto("/this-route-does-not-exist");
    await expect(page.getByText(/404|not found/i).first()).toBeVisible();
  });
});
