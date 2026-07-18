import { test, expect } from "@playwright/test";
import { waitForConnected } from "./helpers";

/**
 * Trade write-path: navigate to an existing token detail page and execute a
 * buy (and optionally a partial sell). Runs against the configured dev chain
 * (anvil fork or live testnet).
 *
 * Gated by E2E_WRITE=1 so read-only CI runs don't spend gas / mutate chain.
 */
const WRITE = process.env.E2E_WRITE === "1";

test.describe("trade flow (write)", () => {
  test.skip(!WRITE, "set E2E_WRITE=1 to run on-chain write tests");

  test("buys a token from the detail page", async ({ page }) => {
    // Navigate to the first token in the feed.
    await page.goto("/");
    await waitForConnected(page);

    // Click the first token card link to go to its detail page.
    const tokenLink = page.getByRole("link", { name: /details/i }).first();
    await expect(tokenLink).toBeVisible({ timeout: 15_000 });
    await tokenLink.click();

    // Wait for the trade panel to load.
    await expect(page.getByRole("heading", { name: /Trade/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.waitForLoadState("networkidle");

    // The Buy tab should be active by default. Enter a buy amount.
    const buyInput = page.getByPlaceholder("0.0");
    await expect(buyInput).toBeVisible({ timeout: 10_000 });
    await buyInput.fill("0.001");

    // Wait for the quote to compute (the "You receive" row appears).
    // Allow generous time for public RPC contract reads.
    await expect(page.getByText(/You receive/i)).toBeVisible({ timeout: 30_000 });

    // Submit the buy (text is capitalized "Buy" on the submit button).
    const buyButton = page.getByRole("button", { name: "Buy", exact: true });
    await expect(buyButton).toBeEnabled({ timeout: 10_000 });
    await buyButton.click();

    // The lifecycle stepper should progress through signing and confirmation.
    await expect(
      page.getByText(/Confirming on-chain|Buy confirmed/i).first(),
    ).toBeVisible({ timeout: 60_000 });
  });

  test("sells a token from the detail page", async ({ page }) => {
    await page.goto("/");
    await waitForConnected(page);

    const tokenLink = page.getByRole("link", { name: /details/i }).first();
    await expect(tokenLink).toBeVisible({ timeout: 15_000 });
    await tokenLink.click();

    await expect(page.getByRole("heading", { name: /Trade/i })).toBeVisible({
      timeout: 20_000,
    });

    // Switch to Sell tab (toggle text is lowercase "sell").
    await page.getByRole("button", { name: "sell", exact: true }).click();
    await page.waitForLoadState("networkidle");

    // Wait for balance to load (the MAX button appears when a balance exists).
    // Allow generous time for the on-chain balance read via public RPC.
    const maxButton = page.getByRole("button", { name: /MAX/i });
    await expect(maxButton).toBeVisible({ timeout: 30_000 });
    await maxButton.click();

    // Wait for the quote.
    await expect(page.getByText(/You receive/i)).toBeVisible({ timeout: 30_000 });

    // Submit the sell (text is capitalized "Sell" on the submit button).
    const sellButton = page.getByRole("button", { name: "Sell", exact: true });
    await expect(sellButton).toBeEnabled({ timeout: 10_000 });
    await sellButton.click();

    await expect(
      page.getByText(/Confirming on-chain|Sell confirmed/i).first(),
    ).toBeVisible({ timeout: 60_000 });
  });
});
