import {test, expect} from '@playwright/test';

test.use({viewport:{width:390,height:844}});

test('clean DEV surveyor installs independently and login works', async ({page}) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto('/kuznechny-dvorik-gates/zamer-app-v2/');
  await expect(page).toHaveTitle('КД Замерщик DEV');
  await expect(page.locator('#loginView')).toBeVisible();
  await expect(page.locator('#kuzdvor-dev-gate')).toHaveCount(0);

  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]')?.href;
    const response = await fetch(href, {cache:'no-store'});
    return response.json();
  });

  expect(manifest.name).toBe('КД Замерщик DEV');
  expect(manifest.short_name).toBe('КД Замерщик');
  expect(manifest.id).toBe('/kuznechny-dvorik-gates/kd-zamer-dev-clean-v1');
  expect(manifest.start_url).toBe('/kuznechny-dvorik-gates/zamer-app-v2/');
  expect(manifest.scope).toBe('/kuznechny-dvorik-gates/');
  expect(manifest.prefer_related_applications).toBe(false);
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({src:'icon-192.png', sizes:'192x192', type:'image/png'}),
    expect.objectContaining({src:'icon-512.png', sizes:'512x512', type:'image/png'})
  ]));

  for (const icon of ['icon-192.png','icon-512.png']) {
    const status = await page.evaluate(async iconName => {
      const r = await fetch('./' + iconName, {cache:'no-store'});
      return {ok:r.ok, type:r.headers.get('content-type') || '', length:Number(r.headers.get('content-length') || 0)};
    }, icon);
    expect(status.ok).toBe(true);
    expect(status.type).toContain('image/png');
  }

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
