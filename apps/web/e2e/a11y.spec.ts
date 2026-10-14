import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Accessibility scans with axe-core. We gate on SERIOUS and CRITICAL impact
 * violations (zero allowed) and ignore merely minor/moderate findings, which
 * are tracked separately and don't block.
 */

const BLOCKING = new Set(["serious", "critical"]);

const ROUTES = ["/", "/pricing", "/dashboard", "/tools/dosing"] as const;

for (const route of ROUTES) {
  test(`no serious/critical a11y violations on ${route}`, async ({ page }) => {
    await page.goto(route);
    // Let client components hydrate before scanning.
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact && BLOCKING.has(v.impact),
    );

    // Surface readable detail if anything fails.
    const detail = blocking
      .map(
        (v) =>
          `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))\n` +
          v.nodes
            .slice(0, 3)
            .map((n) => `    → ${n.target.join(" ")}`)
            .join("\n"),
      )
      .join("\n");

    expect(blocking, `Serious/critical a11y violations:\n${detail}`).toEqual([]);
  });
}
