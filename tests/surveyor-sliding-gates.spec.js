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
