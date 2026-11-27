import {test,expect} from '@playwright/test';
test.use({viewport:{width:390,height:844}});
test('published phone sandbox has separate database, cache and no API writes',async({page})=>{
  test.setTimeout(90000);
  const route='/kuznechny-dvorik-gates/kd-v2/';
  const requests=[];
  page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
  await page.addInitScript(()=>{
    localStorage.setItem('kd-v2-home-theme','legacy-sentinel');
    localStorage.setItem('kd-surveyor-transfer-v1','legacy-sentinel');
    sessionStorage.setItem('kdSurveyorSession','legacy-sentinel');
  });
  await page.goto(route);
  await expect(page.locator('#loginForm button[type=submit]')).toBeEnabled({timeout:20000});
  await page.locator('#loginInput').fill('zamer');
  await page.locator('#passwordInput').fill('1234');
  await page.locator('#loginForm button[type=submit]').click();
  const home=page.locator('#v2HomeScreen');
  await expect(home).toBeVisible({timeout:20000});
  await home.locator('[data-v2-action="quick"]').click();
  await home.locator('[data-v2-action="sliding"]').click();
  await home.locator('[data-product-field="widthMm"]').fill('4200');
  await expect(home.locator('[data-product-total]')).toContainText('₽');
  await home.locator('[data-product-add]').click();
  await expect(home.locator('[data-product-target] option')).toHaveCount(1);
  await home.locator('[data-product-confirm]').click();
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
  await expect(page.locator('.calculation-card')).toHaveCount(1);
  const state=await page.evaluate(async()=>({
    databases:(await indexedDB.databases()).map(x=>x.name),
    theme:localStorage.getItem('kd-v2-home-theme'),
    transfer:localStorage.getItem('kd-surveyor-transfer-v1'),
    legacy:sessionStorage.getItem('kdSurveyorSession')
  }));
  expect(state.databases).toContain('kd-v2-phone-demo-v1');
  expect(state.databases).not.toContain('kd-surveyor-stage1');
  expect(state.theme).toBe('legacy-sentinel');
  expect(state.transfer).toBe('legacy-sentinel');
  expect(state.legacy).toBe('legacy-sentinel');
  expect(requests.filter(r=>r.method!=='GET'||/\/api\/(?:surveyor|leads)(?:[/?]|$)/.test(r.url))).toEqual([]);
  await expect.poll(()=>page.evaluate(async()=>{
    const reg=await navigator.serviceWorker.getRegistration('./');
    return reg?.scope.endsWith('/kd-v2/')&&Boolean(reg.active);
  }),{timeout:20000}).toBe(true);
});
