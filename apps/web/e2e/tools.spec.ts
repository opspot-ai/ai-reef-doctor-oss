import { test, expect, type Page } from "@playwright/test";

/**
 * Deterministic tool coverage. The dosing math and encyclopedia retrieval run
 * entirely client-side (no AI), so these flows are fully reproducible.
 */

function trackPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

test.describe("Tools", () => {
  test("dosing calculator: alkalinity dose + safety warning", async ({
    page,
  }) => {
    const errors = trackPageErrors(page);

    await page.goto("/tools/dosing");

    // Parameter selector is a radiogroup; pick Alkalinity (default, but assert).
    const alk = page.getByRole("radio", { name: "Alkalinity" });
    await expect(alk).toBeVisible();
    await alk.click();
    await expect(alk).toHaveAttribute("aria-checked", "true");

    // Fill volume / current / target.
    await page.getByLabel("Tank volume").fill("200");
    await page.getByLabel("Current", { exact: true }).fill("7");
    await page.getByLabel("Target", { exact: true }).fill("9");

    await page.getByRole("button", { name: /Calculate dose/i }).click();

    // A recommended dose figure (in mL) appears.
    await expect(page.getByText(/Recommended dose/i)).toBeVisible();
    await expect(page.getByText(/\bmL\b/).first()).toBeVisible();

    // The deterministic dose-safety warning is always rendered.
    await expect(page.getByText(/Before you dose/i)).toBeVisible();
    await expect(
      page.getByText(/verify|product|instructions|test/i).first(),
    ).toBeVisible();

    expect(errors, `pageerror(s): ${errors.join(" | ")}`).toEqual([]);
  });

  test("encyclopedia search filters results", async ({ page }) => {
    const errors = trackPageErrors(page);

    await page.goto("/tools/encyclopedia");

    const search = page.getByLabel(/Search the knowledge base/i);
    await expect(search).toBeVisible();

    // The result count region (role=status) reflects the full corpus initially.
    const status = page.getByRole("status").filter({ hasText: /entr/i });
    const initial = (await status.first().innerText()).trim();
    const initialCount = Number(initial.match(/(\d+)/)?.[1] ?? "0");
    expect(initialCount).toBeGreaterThan(1);

    // Typing "ich" narrows to the relevant, smaller set of entries.
    await search.fill("ich");
    await expect(status.first()).toContainText(/sorted by relevance/i);

    const filtered = (await status.first().innerText()).trim();
    const filteredCount = Number(filtered.match(/(\d+)/)?.[1] ?? "0");
    expect(filteredCount).toBeGreaterThan(0);
    expect(filteredCount).toBeLessThan(initialCount);

    // A relevant entry surfaces (Marine Ich).
    await expect(page.getByText(/Marine Ich/i).first()).toBeVisible();

    expect(errors, `pageerror(s): ${errors.join(" | ")}`).toEqual([]);
  });
});
