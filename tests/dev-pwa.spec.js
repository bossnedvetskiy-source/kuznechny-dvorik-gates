import {test, expect} from '@playwright/test';

test.use({viewport:{width:390,height:844}});

test('single DEV work PWA starts in surveyor shell and owns calculators', async ({page}) => {
  await page.goto('/kuznechny-dvorik-gates/dev-tools/');
  await expect(page).toHaveTitle('КД Замерщик DEV');
  await expect(page.locator('#loginView')).toBeVisible();

  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]')?.href;
    const res = await fetch(href, {cache:'no-store'});
    return res.json();
  });

  expect(manifest.name).toBe('КД Замерщик DEV');
  expect(manifest.short_name).toBe('КД Замерщик');
  expect(manifest.id).toBe('/kuznechny-dvorik-gates/kd-work-v1');
  expect(manifest.start_url).toBe('/kuznechny-dvorik-gates/dev-tools/');
  expect(manifest.scope).toBe('/kuznechny-dvorik-gates/');

  await page.locator('#loginInput').fill('zamer');
  await page.locator('#passwordInput').fill('1234');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#mainView')).toBeVisible();

  await page.locator('[data-screen="calculators"]').click();
  await expect(page.locator('#calculatorsScreen')).toHaveClass(/active/);
  await expect(page.locator('#calculatorsScreen')).toContainText('Ворота с калиткой');
  await expect(page.locator('#calculatorsScreen')).toContainText('Евроштакетник');
  await expect(page.locator('#calculatorsScreen')).toContainText('Навес');

  for (const href of [
    '/kuznechny-dvorik-gates/?app=1',
    '/kuznechny-dvorik-gates/evroshtaketnik/',
    '/kuznechny-dvorik-gates/naves/'
  ]) {
    expect(href.startsWith(manifest.scope)).toBe(true);
  }

  await expect.poll(
    () => page.evaluate(async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      return regs.some(reg => reg.scope.endsWith('/kuznechny-dvorik-gates/'));
    }),
    {timeout:7000}
  ).toBe(true);
});
