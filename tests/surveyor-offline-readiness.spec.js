import {test, expect} from '@playwright/test';

test('DEV offline preparation controls and assets are present', async ({page}) => {
  await page.goto('/kuznechny-dvorik-gates/dev-tools/');
  await expect(page.locator('#kdOfflineReadiness')).toHaveCount(1);
  await expect(page.locator('#kdOfflineDownload')).toHaveCount(1);
  await expect(page.locator('#kdOfflineState')).toHaveCount(1);
  const worker = await page.request.get('/kuznechny-dvorik-gates/site-sw.js');
  expect(worker.ok()).toBe(true);
  const script = await worker.text();
  expect(script).toContain('/kuznechny-dvorik-gates/dev-tools/offline-readiness.js');
  expect(script).toContain('/kuznechny-dvorik-gates/dev-tools-v4/offline-readiness.js');
});
