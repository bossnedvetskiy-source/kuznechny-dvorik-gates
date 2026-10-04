import {test, expect} from '@playwright/test';

test.use({viewport:{width:390,height:844}});

test('single DEV work PWA starts in surveyor shell with card-based calculators', async ({page}) => {
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

  await expect(page.locator('[data-screen="calculators"]')).toHaveCount(0);

  await page.locator('#newSurveyBtn').click();
  await page.locator('#surveyClientPhone').fill('89370000000');
  await page.locator('#surveyAddress').fill('Мелеуз, PWA тест');
  await page.locator('#saveSurveyBtn').click();

  const card = page.locator('.survey-card').first();
  await expect(card.locator('[data-quick-calculation]')).toBeVisible();
  await card.locator('[data-quick-calculation]').click();
  await expect(page.locator('#calculationPickerDialog')).toBeVisible();
  await expect(page.locator('#calculationPickerDialog')).toContainText('Ворота');
  await expect(page.locator('#calculationPickerDialog')).toContainText('Евроштакетник');
  await expect(page.locator('#calculationPickerDialog')).toContainText('Навес');
  await page.locator('#closeCalculationPickerBtn').click();

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
