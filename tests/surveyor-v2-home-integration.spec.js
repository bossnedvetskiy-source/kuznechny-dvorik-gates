import {test,expect} from '@playwright/test';
test.use({viewport:{width:390,height:844}});

async function login(page,user,mode='v2'){
  await page.goto('/surveyor-app/index.html?ui='+mode);
  await expect(page.locator('#loginForm button[type="submit"]')).toBeEnabled({timeout:20000});
  await page.locator('#loginInput').fill(user);
  await page.locator('#passwordInput').fill('1234');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#mainView')).toBeVisible({timeout:20000});
}

test('owner local v2 home uses existing screens and no fabricated KPIs',async({page})=>{
  await login(page,'admin');
  const home=page.locator('#v2HomeScreen');
  await expect(home).toBeVisible();
  await expect(home.locator('.kd-v2-tile')).toHaveCount(12);
  await expect(home.locator('.kd-v2-grid.two strong')).toHaveText(['—','—','—','—']);
  await home.locator('[data-v2-action="clients"]').click();
  await expect(page.locator('#clientsScreen')).toBeVisible();
  await page.locator('.nav-btn[data-screen="v2Home"]').click();
  await home.locator('[data-v2-action="ruler"]').click();
  await expect(home.locator('h2')).toHaveText('КД ЗАМЕРЩИК');
  await home.locator('[data-v2-action="quick"]').click();
  await expect(page.locator('#ownerQuickScreen')).toBeVisible();
});

test('surveyor local v2 home opens actual new survey, owner controls absent',async({page})=>{
  await login(page,'zamer');
  const home=page.locator('#v2HomeScreen');
  await expect(home).toBeVisible();
  await expect(home.locator('h2')).toHaveText('КД ЗАМЕРЩИК');
  await expect(home.locator('[data-v2-action="workspace"]')).toHaveCount(0);
  await expect(home.locator('[data-v2-action="wallet"]')).toHaveCount(0);
  await home.locator('[data-v2-action="measure"]').click();
  await expect(page.locator('#surveyDialog')).toBeVisible();
  await page.locator('#saveSurveyBtn').click();
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
  await expect(page.locator('.v3-product-tile')).toHaveCount(4);
  await expect(page.locator('[data-owner-detail-tab="finance"]')).toHaveCount(0);
});

test('legacy remains default without preview opt-in',async({page})=>{
  await login(page,'zamer','legacy');
  await expect(page.locator('#surveysScreen')).toBeVisible();
  await expect(page.locator('#v2HomeScreen')).toHaveCount(0);
});

test('v2 unified navigation is role-aware and theme follows existing screens',async({page})=>{
  await login(page,'admin');
  const home=page.locator('#v2HomeScreen');
  await expect(home).toBeVisible();
  const nav=page.locator('#mainView .bottom-nav');
  await expect(nav.locator('button:visible')).toHaveCount(5);
  await expect(nav.locator('button:visible b')).toHaveText(['Главная','Заказы','Клиенты','Цех','Ещё']);
  await home.locator('[data-v2-action="theme"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-kd-theme','light');
  await nav.locator('[data-screen="clients"]:visible').click();
  await expect(page.locator('#clientsScreen')).toBeVisible();
  await expect(nav.locator('[aria-current="page"]')).toHaveText('Клиенты');
  await expect(page.locator('#mainView')).toHaveCSS('background-color','rgb(241, 245, 249)');
  await nav.locator('[data-screen="v2Home"]').click();
  await home.locator('[data-v2-action="ruler"]').click();
  await expect(nav.locator('button:visible b')).toHaveText(['Главная','Расчёты','Клиенты','Ещё']);
  await nav.locator('[data-screen="surveys"]:visible').click();
  await expect(page.locator('#surveysScreen')).toBeVisible();
  await expect(nav.locator('[aria-current="page"]')).toHaveText('Расчёты');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('v2 compact survey card and forms follow both themes without losing fields',async({page})=>{
  await login(page,'zamer');
  const home=page.locator('#v2HomeScreen');
  await expect(home).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-kd-theme','dark');
  await home.locator('[data-v2-action="measure"]').click();
  await expect(page.locator('#surveyDialog .sheet')).toHaveCSS('background-color','rgb(17, 24, 39)');
  await page.locator('#surveyAddress').fill('Тестовый объект');
  await page.locator('#saveSurveyBtn').click();
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
  await expect(page.locator('#surveyDetailsDialog .sheet')).toHaveCSS('background-color','rgb(17, 24, 39)');
  await expect(page.locator('.v3-product-tile')).toHaveCount(4);
  await expect(page.locator('.v3-product-tile').first()).toHaveCSS('min-height','86px');
  await page.locator('#closeDetailsBtn').click();
  await page.locator('.kd-v2-nav[data-screen="v2Home"]').click();
  await home.locator('[data-v2-action="theme"]').click();
  await page.locator('.kd-v2-nav[data-screen="surveys"]').click();
  await page.locator('.survey-card').first().click();
  await expect(page.locator('#surveyDetailsDialog .sheet')).toHaveCSS('background-color','rgb(241, 245, 249)');
  await expect(page.locator('#surveyDetailsContent')).toContainText('Тестовый объект');
  await expect(page.locator('.v3-product-tile')).toHaveCount(4);
  expect(await page.locator('#surveyDetailsDialog .sheet').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
});

test('v2 catalogue separates forged gate and fence articles and preserves existing gate entry',async({page})=>{
  await login(page,'zamer');
  const home=page.locator('#v2HomeScreen');
  await expect(home).toBeVisible();
  await home.locator('[data-v2-action="catalog"]').click();
  await expect(home.locator('[data-v2-action="artGates"]')).toContainText('Кованые ворота Арт.');
  await expect(home.locator('[data-v2-action="artFences"]')).toContainText('Кованые заборы Арт.');
  await expect(home.locator('[data-v2-action="pickets"]')).toContainText('Евроштакетник');
  await home.locator('[data-v2-action="artFences"]').click();
  await expect(home.locator('[role="status"]')).toContainText('стоимость не рассчитывается');
  await expect(page.locator('#surveyDialog')).not.toBeVisible();
  await home.locator('[data-v2-action="artGates"]').click();
  await home.locator('[role="status"] [data-v2-action="measure"]').click();
  await expect(page.locator('#surveyDialog')).toBeVisible();
  await page.locator('#saveSurveyBtn').click();
  await expect(page.locator('#surveyDetailsDialog [data-v3-calc="gates"]')).toBeVisible();
});

test('v2 catalogue keeps corrugated sheet fencing separate from pickets and forged sections',async({page})=>{
  await login(page,'zamer');
  const home=page.locator('#v2HomeScreen');
  await expect(home).toBeVisible();
  await home.locator('[data-v2-action="catalog"]').click();
  await expect(home.locator('[data-v2-action="profileFence"]')).toContainText('Забор из профнастила');
  await expect(home.locator('[data-v2-action="pickets"]')).toBeVisible();
  await expect(home.locator('[data-v2-action="artFences"]')).toBeVisible();
  await home.locator('[data-v2-action="profileFence"]').click();
  await expect(home.locator('[role="status"]')).toContainText('стоимость не рассчитывается');
  await expect(page.locator('#surveyDialog')).not.toBeVisible();
});

test('v2 owner quick calculator shares theme and retains editable dimensions',async({page})=>{
  await login(page,'admin');
  const home=page.locator('#v2HomeScreen');
  await expect(home).toBeVisible();
  await home.locator('[data-v2-action="theme"]').click();
  await home.locator('[data-v2-action="ruler"]').click();
  await home.locator('[data-v2-action="quick"]').click();
  const quick=page.locator('#ownerQuickScreen');
  await expect(quick).toBeVisible();
  await expect(quick.locator('.ownerq-heading')).toHaveCSS('background-color','rgb(255, 255, 255)');
  await expect(quick.locator('[data-oq-field="width"]')).toBeEditable();
  await quick.locator('[data-oq-field="width"]').fill('4.2');
  await quick.locator('[data-oq-field="width"]').dispatchEvent('change');
  await expect(quick.locator('[data-oq-field="width"]')).toHaveValue('4.2');
  await expect(quick.locator('.ownerq-price')).toBeVisible();
});

test('downloadable static preview opens the v2 home in a local browser',async({page})=>{
  await page.goto('/kuznechny-dvorik-gates/surveyor-test/?ui=v2');
  await expect(page.locator('#loginForm button[type="submit"]')).toBeEnabled({timeout:20000});
  await page.locator('#loginInput').fill('zamer');
  await page.locator('#passwordInput').fill('1234');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#v2HomeScreen')).toBeVisible({timeout:20000});
  await expect(page.locator('#v2HomeScreen h2')).toHaveText('КД ЗАМЕРЩИК');
  await page.locator('[data-v2-action="catalog"]').click();
  await expect(page.locator('[data-v2-action="profileFence"]')).toBeVisible();
});
