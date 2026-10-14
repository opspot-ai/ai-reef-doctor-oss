import { test, expect, type Page } from "@playwright/test";

/**
 *  critical-path coverage, adapted to DEMO MODE.
 *
 * The e2e server runs with Supabase + Anthropic cleared, so the authed app is
 * reachable without login and renders rich demo data ("Coral Garden" tank).
 * AI-backed surfaces must still render their controls and degrade gracefully —
 * we assert the controls exist, never that live AI output appears.
 */

function trackPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

/** Click a sidebar nav link by its accessible name and wait for the route. */
async function navTo(page: Page, label: string, urlRe: RegExp) {
  // Scope to the sidebar's <nav> landmark so we hit the nav link and not the
  // brand logo (whose wordmark also reads "Reef Doctor").
  await page
    .getByRole("navigation")
    .getByRole("link", { name: label, exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(urlRe);
}

test.describe("Authed app (demo mode)", () => {
  test("dashboard shows the demo banner and tank stats", async ({ page }) => {
    const errors = trackPageErrors(page);

    await page.goto("/dashboard");

    // Demo-mode banner from the app shell.
    await expect(page.getByText(/Demo mode/i).first()).toBeVisible();

    // The demo tank "Coral Garden" is the active tank — shown in the page header
    // (scope to <main> so we don't match the hidden <option> in the tank picker).
    await expect(
      page.getByRole("main").getByText("Coral Garden").first(),
    ).toBeVisible();

    // Tank-summary stats region renders.
    await expect(
      page.getByRole("region", { name: /Tank summary/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Tank health at a glance|Water chemistry/i }).first(),
    ).toBeVisible();

    expect(errors, `pageerror(s): ${errors.join(" | ")}`).toEqual([]);
  });

  test("navigate to Photo Diagnosis: kind selector + file input present", async ({
    page,
  }) => {
    const errors = trackPageErrors(page);

    await page.goto("/dashboard");
    await navTo(page, "Photo Diagnosis", /\/diagnose/);

    // Kind selector is a radiogroup with fish/coral/algae options.
    const group = page.getByRole("radiogroup", { name: /Diagnosis type/i });
    await expect(group).toBeVisible();
    await expect(page.getByRole("radio", { name: /Fish disease/i })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Coral health/i })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Algae/i })).toBeVisible();

    // The image file input is present (visually hidden, but in the DOM).
    await expect(page.locator('input[type="file"]')).toHaveCount(1);

    expect(errors, `pageerror(s): ${errors.join(" | ")}`).toEqual([]);
  });

  test("navigate to Parameters: reading-log form present", async ({ page }) => {
    const errors = trackPageErrors(page);

    await page.goto("/dashboard");
    await navTo(page, "Parameters", /\/parameters/);

    // The log-a-reading form: a measured-at field, parameter inputs, and a save.
    await expect(page.getByText(/Log a reading/i)).toBeVisible();
    await expect(page.getByLabel("Measured at")).toBeVisible();
    // Target the numeric input specifically (a chart figure is also labelled
    // "Alkalinity"), so use the spinbutton role.
    await expect(
      page.getByRole("spinbutton", { name: /Alkalinity/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Save reading/i }),
    ).toBeVisible();

    expect(errors, `pageerror(s): ${errors.join(" | ")}`).toEqual([]);
  });

  test("navigate to Reef Doctor: chat composer present", async ({ page }) => {
    const errors = trackPageErrors(page);

    await page.goto("/dashboard");
    await navTo(page, "Reef Doctor", /\/doctor/);

    // The composer: a labelled message box, send button, and emergency button.
    await expect(page.getByLabel(/Message the Reef Doctor/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Send message/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /My tank is crashing/i }),
    ).toBeVisible();

    expect(errors, `pageerror(s): ${errors.join(" | ")}`).toEqual([]);
  });

  test("Reef Doctor degrades gracefully when AI is unavailable", async ({
    page,
  }) => {
    const errors = trackPageErrors(page);

    await page.goto("/doctor");

    // Send a message. With Anthropic cleared the chat route 503s; the UI must
    // surface a graceful "unavailable" bubble rather than crashing.
    const composer = page.getByLabel(/Message the Reef Doctor/i);
    await composer.fill("My nitrates are climbing — what should I do?");
    await page.getByRole("button", { name: /Send message/i }).click();

    // The user's message echoes, and a graceful error bubble appears (no AI key).
    await expect(
      page.getByText(/The Doctor is unavailable right now/i),
    ).toBeVisible({ timeout: 15_000 });

    expect(errors, `pageerror(s): ${errors.join(" | ")}`).toEqual([]);
  });
});
