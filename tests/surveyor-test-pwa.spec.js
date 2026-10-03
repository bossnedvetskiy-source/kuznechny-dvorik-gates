import {test, expect} from '@playwright/test';

test.use({viewport:{width:390,height:844}});

test('ungated surveyor test PWA is independently installable', async ({page}) => {
  await page.goto('/kuznechny-dvorik-gates/surveyor-test/');
  await expect(page).toHaveTitle('КД Замерщик Тест');
  await expect(page.locator('#loginView')).toBeVisible();
  await expect(page.locator('#kuzdvor-dev-gate')).toHaveCount(0);

  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]')?.href;
    const res = await fetch(href);
    return res.json();
  });
  expect(manifest.name).toBe('КД Замерщик Тест');
  expect(manifest.short_name).toBe('КД Замер Тест');
  expect(manifest.id).toBe('/kuznechny-dvorik-gates/surveyor-test');
  expect(manifest.start_url).toBe('/kuznechny-dvorik-gates/surveyor-test/');
  expect(manifest.scope).toBe('/kuznechny-dvorik-gates/surveyor-test/');

  await expect.poll(
    () => page.evaluate(async () => Boolean(await navigator.serviceWorker?.getRegistration('./'))),
    {timeout:7000}
  ).toBe(true);

  await page.reload();
  await expect.poll(
    () => page.evaluate(() => Boolean(navigator.serviceWorker?.controller)),
    {timeout:7000}
  ).toBe(true);

  const scriptUrl = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL || '');
  expect(scriptUrl).toContain('/surveyor-test/sw.js');
});


test('login works inside standalone test PWA', async ({page}) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto('/kuznechny-dvorik-gates/surveyor-test/');
  await expect(page.locator('#loginView')).toBeVisible();

  await page.locator('#loginInput').fill('zamer');
  await page.locator('#passwordInput').fill('1234');
  await page.locator('#loginForm button[type="submit"]').click();

  await expect(page.locator('#mainView')).toBeVisible({timeout:10000});
  await expect(page.locator('#loginView')).toBeHidden();
  await expect(page.locator('#screenTitle')).toContainText('Замеры');
  expect(errors).toEqual([]);
});
