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
  // Reproduce the old 80ms autofocus window: it must not steal password focus.
  await page.waitForTimeout(120);
  await expect(page.locator('#passwordInput')).toBeFocused();
  await expect(page.locator('#loginInput')).toHaveValue('zamer');
  await expect(page.locator('#passwordInput')).toHaveValue('1234');
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

test('phone swing preview supports real dimensions and isolates synthetic quote from customer actions',async({page})=>{
  test.setTimeout(90000);
  const route='/kuznechny-dvorik-gates/kd-v2/';
  const requests=[];
  page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
  await page.goto(route+'?swingDemo=1');
  await expect(page.locator('#loginForm button[type=submit]')).toBeEnabled({timeout:20000});
  await page.locator('#loginInput').fill('zamer');
  await page.locator('#passwordInput').fill('1234');
  // Reproduce the old 80ms autofocus window: it must not steal password focus.
  await page.waitForTimeout(120);
  await expect(page.locator('#passwordInput')).toBeFocused();
  await expect(page.locator('#loginInput')).toHaveValue('zamer');
  await expect(page.locator('#passwordInput')).toHaveValue('1234');
  await page.locator('#loginForm button[type=submit]').click();
  const home=page.locator('#v2HomeScreen');
  await expect(home).toBeVisible({timeout:20000});
  await home.locator('[data-v2-action="catalog"]').click();
  await home.locator('[data-v2-action="frames"]').click();
  await home.locator('[data-swing-field="profile"]').selectOption('60x40x2');
  await home.locator('[data-swing-field="gapMode"]').selectOption('excel');
  await home.locator('[data-swing-field="wicketType"]').selectOption('builtIn');
  await home.locator('[data-swing-field="fill"]').selectOption('sheet');
  await expect(home.locator('[data-swing-fill-plan]')).toContainText('6,48');
  await home.locator('[data-swing-demo-quote]').click();
  await expect(home.locator('[data-swing-demo-result]')).toContainText('Условная цена:');
  await home.locator('[data-swing-demo-save]').click();
  const dialog=page.locator('#surveyDetailsDialog');
  await expect(dialog).toBeVisible({timeout:20000});
  await expect(dialog).toContainText('Не заказ и не коммерческое предложение.');
  await expect(dialog.locator('[data-v3-preview],[data-complete-survey],[data-edit-survey-data],[data-v3-calc],[data-add-calculation]')).toHaveCount(0);
  const state=await page.evaluate(async()=>{
    const databases=(await indexedDB.databases()).map(x=>x.name);
    const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('kd-v2-phone-demo-v1');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});
    const surveys=await new Promise((resolve,reject)=>{const q=db.transaction('surveys').objectStore('surveys').getAll();q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});
    db.close();
    return {databases,survey:surveys.find(s=>s.configuration?.testOnly)};
  });
  expect(state.databases).not.toContain('kd-surveyor-stage1');
  expect(state.survey.configuration.testOnly).toBe(true);
  expect(state.survey.configuration.calculations[0].payload.test).toBe(true);
  expect(state.survey.clientPhone).toBe('');
  expect(requests.filter(r=>r.method!=='GET'||/\/api\/(?:surveyor|leads)(?:[/?]|$)/.test(r.url))).toEqual([]);
});
