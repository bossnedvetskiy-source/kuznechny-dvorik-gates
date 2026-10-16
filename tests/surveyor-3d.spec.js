import {test, expect} from '@playwright/test';

test.use({viewport:{width:390,height:844}});

test('3D расчёт opens independently in DEV and edits geometry without changing surveys', async ({page}) => {
  await page.goto('/kuznechny-dvorik-gates/zamer-app-v2/');
  await page.locator('#loginInput').fill('zamer');
  await page.locator('#passwordInput').fill('1234');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#mainView')).toBeVisible({timeout:10000});

  await expect(page.locator('#open3DCalcBtn')).toContainText('3D расчёт');
  await page.locator('#open3DCalcBtn').click();
  await expect(page.locator('#threeDScreen')).toBeVisible();
  await expect(page.locator('#kd3dRoot [data-stats]')).toContainText('Пролётов',{timeout:12000});
  await expect(page.locator('#screenTitle')).toHaveText('3D расчёт');

  await page.locator('#kd3dRoot [data-field="length"]').fill('10');
  await page.locator('#kd3dRoot [data-field="length"]').press('Tab');
  await expect(page.locator('#kd3dRoot [data-parts]')).toContainText('10,0 м');
  const type = page.locator('#kd3dRoot [data-field="fill"]');
  await type.selectOption('sheet');
  await expect(page.locator('#kd3dRoot [data-picket-settings]')).toBeHidden();
  await expect(page.locator('#kd3dRoot [data-parts]')).toContainText('Профнастил С10');
  await type.selectOption('picket-double');
  await expect(page.locator('#kd3dRoot [data-picket-settings]')).toBeVisible();
  await page.locator('#kd3dRoot [data-field="gap"]').fill('6');
  await page.locator('#kd3dRoot [data-field="gap"]').press('Tab');
  await expect(page.locator('#kd3dRoot [data-parts]')).toContainText('6,0 см');
  await type.selectOption('horizontal');
  await expect(page.locator('#kd3dRoot [data-parts]')).toContainText('горизонтальный');
  await type.selectOption('horizontal-double');
  await expect(page.locator('#kd3dRoot [data-parts]')).toContainText('горизонтальный, шахматка');
  await expect(page.locator('#kd3dRoot [data-picket-settings]')).toBeVisible();
  await page.locator('#kd3dRoot [data-ral-swatch="8017"]').click();
  await expect(page.locator('#kd3dRoot [data-ral-swatch="8017"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#kd3dRoot [data-field="ral"]')).toHaveValue('8017');
  await page.locator('#kd3dRoot [data-field="ral"]').selectOption('9003');
  await expect(page.locator('#kd3dRoot [data-ral-swatch="9003"]')).toHaveAttribute('aria-pressed','true');
  const draft=await page.evaluate(()=>JSON.parse(localStorage.getItem('kd-surveyor-3d-draft-v1')));
  expect(draft.fill).toBe('horizontal-double');
  expect(draft.ral).toBe('9003');
  await page.locator('#kd3dRoot [data-mode="parts"]').click();
  await expect(page.locator('#kd3dRoot [data-parts]')).toBeVisible();
  await page.locator('#kd3dRoot [data-mode="scene"]').click();

  await page.locator('#close3DCalcBtn').click();
  await expect(page.locator('#surveysScreen')).toBeVisible();
  await expect(page.locator('#screenTitle')).toHaveText('Замеры');
});
