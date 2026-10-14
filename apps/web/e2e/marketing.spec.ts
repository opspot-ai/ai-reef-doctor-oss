import { test, expect, type Page } from "@playwright/test";

/**
 * Marketing / public-surface coverage.
 *
 * Selectors lean on roles, accessible names, labels, and visible text — never
 * brittle CSS — so they survive styling churn.
 */

/**
 * Attach a guard that fails the test if the page emits an uncaught error
 * (`pageerror`). Call at the top of a test and assert `errors` is empty at the
 * end so the first reported error is surfaced clearly.
 */
function trackPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => {
    errors.push(err.message);
  });
  return errors;
}

test.describe("Marketing site", () => {
  test("landing page loads with the hero", async ({ page }) => {
    const errors = trackPageErrors(page);

    await page.goto("/");

    // Hero heading: "The AI veterinarian for your reef tank" (split spans).
    const hero = page.getByRole("heading", {
      level: 1,
      name: /The AI veterinarian for your/i,
    });
    await expect(hero).toBeVisible();

    // Primary CTAs and nav are present.
    await expect(
      page.getByRole("link", { name: /Start free/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Sign in" }).first(),
    ).toBeVisible();

    expect(errors, `pageerror(s): ${errors.join(" | ")}`).toEqual([]);
  });

  test("nav: Landing → Pricing", async ({ page }) => {
    const errors = trackPageErrors(page);

    await page.goto("/");
    // Use the primary nav's Pricing link.
    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Pricing" })
      .click();

    await expect(page).toHaveURL(/\/pricing$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /Plans that grow/i }),
    ).toBeVisible();

    expect(errors, `pageerror(s): ${errors.join(" | ")}`).toEqual([]);
  });

  test("pricing shows all three tiers", async ({ page }) => {
    const errors = trackPageErrors(page);

    await page.goto("/pricing");

    await expect(
      page.getByRole("heading", { name: "Tide Pool" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Reef Keeper" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Reef Master" }),
    ).toBeVisible();

    // "Most popular" badge marks the recommended tier.
    await expect(page.getByText("Most popular")).toBeVisible();

    expect(errors, `pageerror(s): ${errors.join(" | ")}`).toEqual([]);
  });

  test("monthly/annual toggle changes displayed prices", async ({ page }) => {
    const errors = trackPageErrors(page);

    await page.goto("/pricing");

    const monthly = page.getByRole("button", { name: "Monthly" });
    const annual = page.getByRole("button", { name: "Annual" });
    await expect(monthly).toBeVisible();
    await expect(annual).toBeVisible();

    // Default is monthly → "billed monthly" copy is shown.
    await expect(page.getByText("billed monthly").first()).toBeVisible();

    // Switching to annual swaps the billing copy + reveals the savings note.
    await annual.click();
    await expect(page.getByText(/billed yearly/i).first()).toBeVisible();
    await expect(page.getByText(/Save ~17% with annual billing/i)).toBeVisible();

    // And back to monthly.
    await monthly.click();
    await expect(page.getByText("billed monthly").first()).toBeVisible();

    expect(errors, `pageerror(s): ${errors.join(" | ")}`).toEqual([]);
  });

  test('"Get started" links to /signup', async ({ page }) => {
    const errors = trackPageErrors(page);

    await page.goto("/");

    // Nav "Get started" CTA points at /signup.
    const getStarted = page.getByRole("link", { name: "Get started" }).first();
    await expect(getStarted).toHaveAttribute("href", "/signup");
    await getStarted.click();
    await expect(page).toHaveURL(/\/signup$/);

    expect(errors, `pageerror(s): ${errors.join(" | ")}`).toEqual([]);
  });

  test("login page renders its sign-in surface", async ({ page }) => {
    const errors = trackPageErrors(page);

    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: /Welcome back/i }),
    ).toBeVisible();

    // The e2e server runs in demo mode (Supabase cleared). Sign-in is only wired
    // up when Supabase credentials are present, so the page renders ONE of two
    // valid states. Assert the correct one for whichever mode is active — both
    // must render gracefully.
    const email = page.getByLabel("Email");
    if (await email.count()) {
      // Supabase configured: full email + password + Google sign-in.
      await expect(email).toBeVisible();
      await expect(page.getByLabel("Password")).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Continue with Google/i }),
      ).toBeVisible();
    } else {
      // Demo mode: a graceful "sign-in isn't switched on yet" notice.
      await expect(
        page.getByText(/Sign-in isn't switched on yet/i),
      ).toBeVisible();
    }

    expect(errors, `pageerror(s): ${errors.join(" | ")}`).toEqual([]);
  });
});
