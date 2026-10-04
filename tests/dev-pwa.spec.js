import {test, expect} from '@playwright/test';

test.use({viewport:{width:390,height:844}});

test('DEV calculators PWA uses narrow scope and does not own surveyor URLs', async ({page}) => {
  await page.goto('/kuznechny-dvorik-gates/dev-tools/');
  await expect(page).toHaveTitle('КД Калькуляторы DEV');
  await expect(page.locator('body')).toContainText('Евроштакетник');
  await expect(page.locator('body')).toContainText('Навесы');

  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]')?.href;
    const res = await fetch(href, {cache:'no-store'});
    return res.json();
  });

  expect(manifest.name).toBe('КД Калькуляторы DEV');
  expect(manifest.short_name).toBe('КД Калькуляторы');
  expect(manifest.id).toBe('/kuznechny-dvorik-gates/dev-tools/v3');
  expect(manifest.start_url).toBe('/kuznechny-dvorik-gates/dev-tools/');
  expect(manifest.scope).toBe('/kuznechny-dvorik-gates/dev-tools/');

  await expect.poll(
    () => page.evaluate(async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      return regs.some(reg => reg.scope.endsWith('/kuznechny-dvorik-gates/dev-tools/'));
    }),
    {timeout:7000}
  ).toBe(true);

  expect('/kuznechny-dvorik-gates/zamer-app-v2/'.startsWith(manifest.scope)).toBe(false);
});
