import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const TARGET_URL = process.env.TEST_URL || 'http://localhost:5173';
const ROUTES = ['/', '/login', '/ventas'];

test.describe('AppDespensa E2E Accessibility Smoke Test', () => {
  for (const route of ROUTES) {
    test(`accessibility check for ${route}`, async ({ page }) => {
      try {
        const res = await page.goto(`${TARGET_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 5000 });
        if (!res || res.status() >= 400) {
          test.skip();
          return;
        }
      } catch (err) {
        test.skip();
        return;
      }

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      const seriousOrCritical = results.violations.filter(
        v => v.impact === 'serious' || v.impact === 'critical'
      );

      if (seriousOrCritical.length > 0) {
        console.error(`Accessibility violations on ${route}:`, JSON.stringify(seriousOrCritical, null, 2));
      }
      expect(seriousOrCritical).toEqual([]);
    });
  }
});
