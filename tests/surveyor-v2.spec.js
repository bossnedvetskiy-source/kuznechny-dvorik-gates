import {test, expect} from '@playwright/test';

test.use({viewport:{width:390,height:844}});

test('clean surveyor V2 installs independently and login works', async ({page}) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto('/kuznechny-dvorik-gates/zamer-app-v2/');
  await expect(page).toHaveTitle('КД Замерщик V2');
  await expect(page.locator('#loginView')).toBeVisible();
  await expect(page.locator('#kuzdvor-dev-gate')).toHaveCount(0);

  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]')?.href;
    const response = await fetch(href, {cache:'no-store'});
    return response.json();
  });

  expect(manifest.name).toBe('КД Замерщик V2');
  expect(manifest.short_name).toBe('КД Замер V2');
  expect(manifest.id).toBe('/kuznechny-dvorik-gates/zamer-app-v2');
  expect(manifest.start_url).toBe('/kuznechny-dvorik-gates/zamer-app-v2/');
  expect(manifest.scope).toBe('/kuznechny-dvorik-gates/zamer-app-v2/');

  await page.locator('#loginInput').fill('zamer');
  await page.locator('#passwordInput').fill('1234');
  await page.locator('#loginForm button[type="submit"]').click();

  await expect(page.locator('#mainView')).toBeVisible({timeout:10000});
  await expect(page.locator('#loginView')).toBeHidden();
  await expect(page.locator('#screenTitle')).toContainText('Замеры');

  await expect.poll(
    () => page.evaluate(async () => Boolean(await navigator.serviceWorker?.getRegistration('./'))),
    {timeout:7000}
  ).toBe(true);

  expect(errors).toEqual([]);
});
