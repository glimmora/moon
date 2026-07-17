import { test, expect } from "@playwright/test";
import { waitForConnected, uniqueToken } from "./helpers";

/**
 * Full launch write-path: fill the Create form and submit a real on-chain
 * createToken. Runs against whatever chain the dev server is pointed at
 * (anvil fork for the `e2e` runner, live Sepolia for the `live` runner).
 *
 * Gated by E2E_WRITE=1 so read-only CI runs don't spend gas / mutate chain.
 */
const WRITE = process.env.E2E_WRITE === "1";

test.describe("launch token (write)", () => {
  test.skip(!WRITE, "set E2E_WRITE=1 to run on-chain write tests");

  test("launches a new token end-to-end", async ({ page }) => {
    const { name, symbol } = uniqueToken();

    await page.goto("/create");
    await waitForConnected(page);

    await page.getByPlaceholder("e.g. Doge 2.0").fill(name);
    await page.getByPlaceholder("DOGE2").fill(symbol);
    await page.getByPlaceholder(/Tell the world/i).fill("Launched by Playwright E2E.");

    // Choose supply tier "1B" and curve "Linear" (defaults, but click explicitly).
    await page.getByRole("button", { name: /^1B/ }).click();
    await page.getByRole("button", { name: /^Linear/ }).click();

    const submit = page.getByRole("button", { name: /Launch Token/i });
    await expect(submit).toBeEnabled({ timeout: 20_000 });
    await submit.click();

    // The lifecycle stepper should progress past signing into on-chain confirming,
    // and ultimately show the success banner. Allow generous time for mining.
    await expect(
      page.getByText(/Confirming on-chain|Token launched successfully/i).first(),
    ).toBeVisible({ timeout: 45_000 });

    await expect(page.getByText(/Token launched successfully/i)).toBeVisible({
      timeout: 90_000,
    });
  });
});
