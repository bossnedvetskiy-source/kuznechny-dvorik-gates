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
  // Regression: mobile A/B/V/G cards must never fall back to unstyled system buttons.
  await expect(page.locator('#kd3dRoot .kd3d-side-entry')).toHaveCount(4);
  await expect(page.locator('#kd3dRoot [data-active-side-count]')).toHaveText('1 из 4');
  await expect(page.locator('#kd3dRoot [data-current-side-label]')).toHaveText('Настройка стороны А');
  const sideUi=await page.locator('#kd3dRoot .kd3d-sides').evaluate(el=>{
    const grid=getComputedStyle(el);
    const entry=getComputedStyle(el.querySelector('.kd3d-side-entry'));
    const selected=getComputedStyle(el.querySelector('.selected'));
    return {grid:grid.display,columns:grid.gridTemplateColumns.split(' ').length,
      entry:entry.display,radius:parseFloat(entry.borderTopLeftRadius),
      selectedColor:selected.backgroundColor};
  });
  expect(sideUi.grid).toBe('grid');
  expect(sideUi.columns).toBe(2);
  expect(sideUi.entry).toBe('grid');
  expect(sideUi.radius).toBeGreaterThanOrEqual(12);
  expect(sideUi.selectedColor).toBe('rgb(36, 33, 30)');


  await page.locator('#kd3dRoot [data-field="length"]').fill('10');
  await page.locator('#kd3dRoot [data-field="length"]').press('Tab');
  await expect(page.locator('#kd3dRoot [data-parts]')).toContainText('10,0 м');
  const postSize=page.locator('#kd3dRoot [data-field="postSize"]');
  await expect(postSize).toHaveValue('80');
  await postSize.selectOption('100');
  await expect(page.locator('#kd3dRoot [data-parts]')).toContainText('100×100 мм');
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
  expect(draft.postSize).toBe(100);
  await page.locator('#kd3dRoot [data-mode="parts"]').click();
  await expect(page.locator('#kd3dRoot [data-parts]')).toBeVisible();
  await page.locator('#kd3dRoot [data-mode="scene"]').click();


  // Each side is editable independently; all four corners share a single physical post.
  await page.locator('#kd3dRoot [data-side-toggle="B"]').click();
  await page.locator('#kd3dRoot [data-side="B"]').click();
  await expect(page.locator('#kd3dRoot [data-active-side-count]')).toHaveText('2 из 4');
  await expect(page.locator('#kd3dRoot [data-current-side-label]')).toHaveText('Настройка стороны Б');
  await expect(page.locator('#kd3dRoot [data-length-label]')).toContainText('Длина стороны Б, м');

  await page.locator('#kd3dRoot [data-field="length"]').fill('9');
  await page.locator('#kd3dRoot [data-field="length"]').press('Tab');
  await page.locator('#kd3dRoot [data-field="height"]').fill('2.2');
  await page.locator('#kd3dRoot [data-field="height"]').press('Tab');
  await type.selectOption('sheet');
  await page.locator('#kd3dRoot [data-field="ral"]').selectOption('6005');
  await expect(page.locator('#kd3dRoot [data-parts]')).toContainText('Сторона Б: 9,0 м');
  await page.locator('#kd3dRoot [data-side-toggle="V"]').click();
  await page.locator('#kd3dRoot [data-side="V"]').click();
  await page.locator('#kd3dRoot [data-field="length"]').fill('10');
  await page.locator('#kd3dRoot [data-field="length"]').press('Tab');
  await page.locator('#kd3dRoot [data-side-toggle="G"]').click();
  await page.locator('#kd3dRoot [data-side="G"]').click();
  await page.locator('#kd3dRoot [data-field="length"]').fill('9');
  await page.locator('#kd3dRoot [data-field="length"]').press('Tab');
  await expect(page.locator('#kd3dRoot [data-site-warning]')).toBeHidden();
  await expect(page.locator('#kd3dRoot [data-stats]')).toContainText('16');
  const sides=await page.evaluate(()=>JSON.parse(localStorage.getItem('kd-surveyor-3d-draft-v1')).sides);
  expect(sides.A.length).toBe(10);
  expect(sides.A.fill).toBe('horizontal-double');
  expect(sides.B.length).toBe(9);
  expect(sides.B.fill).toBe('sheet');
  expect(sides.B.ral).toBe('6005');
  expect(sides.G.length).toBe(9);
  await page.locator('#kd3dRoot [data-field="length"]').fill('8');
  await page.locator('#kd3dRoot [data-field="length"]').press('Tab');
  await expect(page.locator('#kd3dRoot [data-site-warning]')).toBeVisible();
  await page.locator('#kd3dRoot [data-field="length"]').fill('9');
  await page.locator('#kd3dRoot [data-field="length"]').press('Tab');

  await page.locator('#close3DCalcBtn').click();
  await expect(page.locator('#surveysScreen')).toBeVisible();
  await expect(page.locator('#screenTitle')).toHaveText('Замеры');
});
