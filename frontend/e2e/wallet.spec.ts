import { test, expect } from "@playwright/test";
import { gotoHome, waitForConnected, E2E_ADDRESS } from "./helpers";

/**
 * Wallet connection via the test-gated E2E connector (auto-connect on load).
 */
test.describe("wallet connection", () => {
  test("auto-connects the E2E wallet and shows the account menu", async ({ page }) => {
    await gotoHome(page);
    await waitForConnected(page);
    // Open the account menu and confirm the connected address is shown.
    await page.getByRole("button", { name: "Account menu" }).click();
    if (E2E_ADDRESS) {
      const short = E2E_ADDRESS.slice(0, 7).toLowerCase();
      await expect(page.getByText(new RegExp(short, "i")).first()).toBeVisible();
    }
    await expect(page.getByRole("menuitem", { name: /disconnect/i })).toBeVisible();
  });
});
