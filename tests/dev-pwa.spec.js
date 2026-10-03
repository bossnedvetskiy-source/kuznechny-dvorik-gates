import {test, expect} from '@playwright/test';

test.use({viewport:{width:390,height:844}});

test('DEV calculators PWA has a fresh identity and opens its start URL', async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem('kuzdvor-dev-access-v1','1');
  });

  await page.goto('/kuznechny-dvorik-gates/?app=1');
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]')?.href;
    const res = await fetch(href);
    return res.json();
  });

  expect(manifest.name).toBe('КД Калькуляторы DEV');
  expect(manifest.short_name).toBe('КД Калькуляторы');
  expect(manifest.id).toBe('/kuznechny-dvorik-gates/dev-tools-v2');
  expect(manifest.start_url).toBe('/kuznechny-dvorik-gates/work-app.html?app=1&environment=dev&devtools=2');
  expect(manifest.scope).toBe('/kuznechny-dvorik-gates/');

  await page.goto(manifest.start_url);
  await expect(page.locator('body')).toContainText('Расчёт евроштакетника');
  await expect(page.locator('body')).toContainText('Расчёт навеса');

  await expect.poll(
    () => page.evaluate(async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      return regs.some(reg => reg.scope.endsWith('/kuznechny-dvorik-gates/'));
    }),
    {timeout:7000}
  ).toBe(true);
});
