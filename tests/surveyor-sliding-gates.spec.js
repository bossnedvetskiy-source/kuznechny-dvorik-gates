import {test,expect} from '@playwright/test';

test.use({viewport:{width:390,height:844}});
async function newQuote(page) {
  await page.addInitScript(() => localStorage.setItem('kuzdvor-dev-access-v1','1'));
  await page.goto('/kuznechny-dvorik-gates/dev-tools/');
  await page.locator('#loginInput').fill('zamer');
  await page.locator('#passwordInput').fill('1234');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#mainView')).toBeVisible();
  await page.locator('#newSurveyBtn').click();
  await page.locator('#saveSurveyBtn').click();
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
  await page.locator('[data-v3-calc="sliding"]').click();
  await expect(page).toHaveURL(/\/dev-tools\/sliding-gates\/index\.html\?surveyor=1/);
}

test('sliding gates: mobile quote, customer view, survey transfer, edit without duplicate',async ({page})=>{
  test.setTimeout(90000);
  await newQuote(page);
  await expect(page.locator('#frames .card')).toHaveCount(4);
  await expect(page.locator('#price')).toHaveText('76 300 ₽');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
  await page.locator('[data-frame="horizontal"]').click();
  await expect(page.locator('[data-frame="horizontal"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#price')).not.toHaveText('76 300 ₽');
  await page.locator('[data-frame="prof"]').click();
  await page.locator('#auto').check();
  await expect(page.locator('#price')).toHaveText('106 300 ₽');
  await page.locator('#clientBtn').click();
  await expect(page.locator('#clientModal')).toHaveClass(/open/);
  await expect(page.locator('#clientTotal')).toHaveText('106 300 ₽');
  const customerText=await page.locator('#clientModal').innerText();
  expect(customerText).not.toMatch(/себестоимость|зарплата|прибыль|закупка/i);
  await page.locator('#closeClient').click();
  await page.locator('#saveBtn').click();
  await page.waitForURL(/\/dev-tools\/\?resumeSurvey=/,{timeout:30000});
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
  await expect(page.locator('.calculation-card')).toHaveCount(1);
  await expect(page.locator('.calculation-card')).toContainText('Откатные ворота');
  await expect(page.locator('.calculation-card-price')).toContainText('106 300 ₽');
  await page.locator('[data-edit-calculation-button]').click();
  await expect(page).toHaveURL(/\/sliding-gates\/index\.html\?.*edit=sliding_/);
  await expect(page.locator('#auto')).toBeChecked();
  await page.locator('#width').fill('5');
  await page.locator('#saveBtn').click();
  await page.waitForURL(/\/dev-tools\/\?resumeSurvey=/,{timeout:30000});
  await expect(page.locator('.calculation-card')).toHaveCount(1);
  await expect(page.locator('.calculation-card-lines')).toContainText('5 × 2 м');
  await page.reload();
  await expect(page.locator('.calculation-card')).toHaveCount(1);
});

test('sliding gates: limits, rail selection and unpriced jalousie do not create fake price',async ({page})=>{
  await newQuote(page);
  await page.locator('#width').fill('4.49');
  await expect(page.locator('#facts')).toContainText('Балка 6 м');
  await page.locator('#width').fill('4.5');
  await expect(page.locator('#facts')).toContainText('Балка 7 м');
  await page.locator('[data-frame="jalousie"]').click();
  await expect(page.locator('#saveBtn')).toBeDisabled();
  await expect(page.locator('#warning')).toContainText('пока не рассчитывается');
  await page.locator('#fill').uncheck();
  await expect(page.locator('#saveBtn')).toBeEnabled();
  await page.locator('#width').fill('5.5');
  await expect(page.locator('#saveBtn')).toBeDisabled();
  await expect(page.locator('#warning')).toContainText('от 0,5 до 5');
});


test('four compact technical frame drawings are distinct and selectable at phone width', async ({page})=>{
  await page.addInitScript(()=>localStorage.setItem('kuzdvor-dev-access-v1','1'));
  await page.goto('/kuznechny-dvorik-gates/dev-tools/sliding-gates/index.html');
  const drawings=page.locator('#frames .card');
  await expect(drawings).toHaveCount(4);
  await expect(drawings.nth(0)).toContainText('Сплошная зашивка');
  await expect(drawings.nth(1)).toContainText('Планки с зазорами');
  await expect(drawings.nth(2)).toContainText('Рамки слева и справа');
  await expect(drawings.nth(3)).toContainText('Наклонные ламели');
  const shapes=await page.evaluate(()=>{
    const cards=[...document.querySelectorAll('#frames .card')];
    return cards.map(b=>{
      const svg=b.querySelector('svg'),box=b.getBoundingClientRect();
      return {frame:b.dataset.frame,paths:svg?.querySelectorAll('path').length,rects:svg?.querySelectorAll('rect').length,
        viewBox:svg?.getAttribute('viewBox'),width:Math.round(box.width),height:Math.round(box.height),
        graphics:svg?.innerHTML};
    });
  });
  expect(new Set(shapes.map(x=>x.graphics)).size).toBe(4);
  expect(shapes.every(x=>x.viewBox==='0 0 240 90'&&x.width>135&&x.height<=145&&x.height>=95)).toBeTruthy();
  expect(shapes.every(x=>x.graphics.includes('M9 18L81 75 M9 75L81 18'))).toBeTruthy();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
  await page.locator('[data-frame="vertical"]').click();
  await expect(page.locator('[data-frame="vertical"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#frameNote')).toContainText('20×20');
  await page.locator('[data-frame="horizontal"]').click();
  await expect(page.locator('#frameNote')).toContainText('обеих сторон');
  await page.locator('[data-frame="jalousie"]').click();
  await expect(page.locator('#frameNote')).toContainText('60×40');
});
