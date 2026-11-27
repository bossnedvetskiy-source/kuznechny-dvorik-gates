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

test('v2 test PWA reopens authenticated offline and retains a locally saved survey',async({page,context})=>{
  await page.goto('/kuznechny-dvorik-gates/surveyor-test/?ui=v2');
  await expect(page.locator('#loginForm button[type="submit"]')).toBeEnabled({timeout:20000});
  await page.locator('#loginInput').fill('zamer');
  await page.locator('#passwordInput').fill('1234');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#v2HomeScreen')).toBeVisible({timeout:20000});
  await expect.poll(()=>page.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration('./'))?.active)),{timeout:20000}).toBe(true);
  await page.reload();
  await expect(page.locator('#v2HomeScreen')).toBeVisible({timeout:20000});
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller)),{timeout:15000}).toBe(true);
  await expect.poll(()=>page.evaluate(async()=>Boolean(await caches.match(new URL('./v2-home.js',location.href).href))),{timeout:10000}).toBe(true);
  await context.setOffline(true);
  try {
    await page.reload({waitUntil:'domcontentloaded'});
    await expect(page.locator('#v2HomeScreen')).toBeVisible({timeout:20000});
    await expect(page.locator('#networkBadge')).toContainText('Офлайн');
    await page.locator('[data-v2-action="measure"]').click();
    await page.locator('#surveyAddress').fill('Тест офлайн v2');
    await page.locator('#saveSurveyBtn').click();
    await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
    await expect(page.locator('#surveyDetailsContent')).toContainText('Тест офлайн v2');
    await page.locator('#closeDetailsBtn').click();
    await page.reload({waitUntil:'domcontentloaded'});
    await expect(page.locator('#v2HomeScreen')).toBeVisible({timeout:20000});
    await page.locator('.kd-v2-nav[data-screen="surveys"]').click();
    await expect(page.locator('.survey-card')).toContainText('Тест офлайн v2');
  } finally {await context.setOffline(false)}
});

test('v2 theme can be changed on existing screens without returning home',async({page})=>{
  await login(page,'zamer');
  const home=page.locator('#v2HomeScreen');
  await expect(home).toBeVisible();
  await expect(page.locator('#kdV2GlobalTheme')).toBeHidden();
  await home.locator('[data-v2-action="clients"]').click();
  await expect(page.locator('#clientsScreen')).toBeVisible();
  await page.getByRole('button',{name:'Включить светлую тему'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-kd-theme','light');
  await expect(page.locator('#mainView')).toHaveCSS('background-color','rgb(241, 245, 249)');
  await expect(page.locator('#clientsScreen')).toBeVisible();
  await page.getByRole('button',{name:'Включить тёмную тему'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-kd-theme','dark');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.locator('.kd-v2-nav[data-screen="v2Home"]').click();
  await expect(page.locator('#kdV2GlobalTheme')).toBeHidden();
});
test('v2 3D controls follow palette without replacing the drawing canvas',async({page})=>{
  test.setTimeout(90000);
  await page.goto('/kuznechny-dvorik-gates/surveyor-test/?ui=v2');
  await expect(page.locator('#loginForm button[type="submit"]')).toBeEnabled({timeout:20000});
  await page.locator('#loginInput').fill('zamer');
  await page.locator('#passwordInput').fill('1234');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#v2HomeScreen')).toBeVisible({timeout:20000});
  await page.locator('[data-v2-action="threeD"]').click();
  await expect(page.locator('#threeDScreen')).toBeVisible();
  await expect(page.locator('#kd3dRoot [data-stats]')).toContainText('Пролётов',{timeout:20000});
  await expect(page.locator('#kd3dRoot .kd3d-top')).toHaveCSS('background-color','rgb(31, 41, 55)');
  await page.getByRole('button',{name:'Включить светлую тему'}).click();
  await expect(page.locator('#kd3dRoot .kd3d-top')).toHaveCSS('background-color','rgb(255, 255, 255)');
  await expect(page.locator('#threeDScreen')).toBeVisible();
  await expect(page.locator('#kd3dRoot [data-stats]')).toContainText('Пролётов');
});

test('v2 visual acceptance at 320, 390 and 1280 pixels with named controls',async({page},testInfo)=>{
  test.setTimeout(90000);
  await page.setViewportSize({width:320,height:740});
  await login(page,'admin');
  const home=page.locator('#v2HomeScreen');
  await expect(home).toBeVisible();
  for(const [width,height] of [[320,740],[390,844],[1280,900]]){
    await page.setViewportSize({width,height});
    for(const theme of ['dark','light']){
      if(await page.locator('html').getAttribute('data-kd-theme')!==theme)
        await home.getByRole('button',{name:'Переключить тему'}).click();
      await expect(page.locator('html')).toHaveAttribute('data-kd-theme',theme);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      const buttons=await home.locator('button:visible').evaluateAll(els=>els.map(e=>({name:(e.getAttribute('aria-label')||e.textContent||'').trim(),height:e.getBoundingClientRect().height})));
      expect(buttons.filter(b=>!b.name||b.height<44), 'Inadequate touch targets at '+width+'px / '+theme).toEqual([]);
      await page.screenshot({path:testInfo.outputPath('owner-'+width+'-'+theme+'.png'),fullPage:true,animations:'disabled'});
    }
  }
  await page.setViewportSize({width:320,height:740});
  await home.getByRole('button',{name:'Переключить рабочее пространство'}).click();
  await expect(home.locator('h2')).toHaveText('КД ЗАМЕРЩИК');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('surveyor-320.png'),fullPage:true,animations:'disabled'});
  await home.locator('[data-v2-action="catalog"]').click();
  for(const id of ['artGates','artFences','profileFence','frames','sliding','pickets','canopy'])
    await expect(home.locator('[data-v2-action="'+id+'"]')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('catalog-320.png'),fullPage:true,animations:'disabled'});
});

test('v2 customer quick calculation uses existing sliding engine without creating a survey',async({page})=>{
  await login(page,'zamer');
  const home=page.locator('#v2HomeScreen');
  await expect(home).toBeVisible();
  await home.locator('[data-v2-action="quick"]').click();
  await home.locator('[data-v2-action="sliding"]').click();
  const editor=home.locator('.kd-product-editor');
  await expect(editor).toBeVisible();
  await expect(editor.locator('[data-product-field="widthMm"]')).toHaveValue('4000');
  const original=await editor.locator('[data-product-total]').textContent();
  await expect(editor.locator('[data-product-total]')).toContainText('₽');
  await editor.locator('[data-product-field="widthMm"]').fill('4200');
  await expect(editor.locator('[data-product-total]')).not.toHaveText(original);
  await expect(editor.locator('[data-product-sketch]')).toContainText('4200 мм');
  await home.getByRole('button',{name:'Переключить тему'}).click();
  await expect(editor.locator('[data-product-field="widthMm"]')).toHaveValue('4200');
  await editor.locator('[data-product-field="widthMm"]').fill('499');
  await expect(editor.locator('[data-product-total]')).toHaveText('—');
  await expect(editor.locator('[data-product-errors]')).not.toHaveText('');
  await editor.locator('[data-product-field="widthMm"]').fill('4000');
  await expect(editor.locator('[data-product-total]')).toHaveText(original);
  await expect(home.locator('[data-product-rows]')).not.toContainText(/Себестоимость|Прибыль|Зарплата/);
  await page.locator('.kd-v2-nav[data-screen="surveys"]').click();
  await expect(page.locator('#surveyList .survey-card')).toHaveCount(0);
});
test('millimetre adapter agrees with existing sliding price engine and rejects invalid input',async({page})=>{
  await page.goto('/surveyor-app/index.html?ui=v2');
  const comparisons=await page.evaluate(async()=>{
    const {slidingQuoteMm,SLIDING_DEFAULTS}=await import('/surveyor-app/v2-product-editor.js');
    const {calculateSlidingQuote}=await import('/surveyor-app/sliding-gates/pricing.js');
    const states=[{}, {widthMm:4200,paint:false,fill:false}, {frame:'vertical',picket:'double',widthMm:3600}, {builtInWicket:true,heightMm:1800}, {frame:'jalousie'}, {tail:'triangle',distance:15,discount:500}];
    return {matches:states.map(s=>{const q=slidingQuoteMm(s);return q.total!==null&&q.total===calculateSlidingQuote(q.configuration).total}),
      invalid:[slidingQuoteMm({widthMm:'',heightMm:1800}).total,slidingQuoteMm({widthMm:499}).total,slidingQuoteMm({widthMm:4000.5}).total,slidingQuoteMm({frame:'unknown'}).total],
      defaults:SLIDING_DEFAULTS.widthMm};
  });
  expect(comparisons.matches).toEqual([true,true,true,true,true,true]);
  expect(comparisons.invalid).toEqual([null,null,null,null]);
  expect(comparisons.defaults).toBe(4000);
});

test('v2 local quick draft survives reload, reset and explicit logout without creating orders',async({page})=>{
  test.setTimeout(90000);
  await login(page,'zamer');
  const home=page.locator('#v2HomeScreen');
  const open=async()=>{
    await expect(home).toBeVisible({timeout:20000});
    await home.locator('[data-v2-action="quick"]').click();
    await home.locator('[data-v2-action="sliding"]').click();
    await expect(home.locator('.kd-product-editor')).toBeVisible();
  };
  await open();
  const width=home.locator('[data-product-field="widthMm"]');
  await width.fill('4100');
  await page.reload();
  await open();
  await expect(width).toHaveValue('4100');
  page.once('dialog',dialog=>dialog.accept());
  await home.locator('[data-product-reset]').click();
  await expect(width).toHaveValue('4000');
  await width.fill('4250');
  await page.locator('#profileBtn').click();
  await page.locator('#logoutBtn').click();
  await expect(page.locator('#loginView')).toBeVisible();
  expect(await page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('kd-v2-sliding-draft-v1:')))).toEqual([]);
  await login(page,'zamer');
  await open();
  await expect(width).toHaveValue('4000');
  await page.locator('.kd-v2-nav[data-screen="surveys"]').click();
  await expect(page.locator('#surveyList .survey-card')).toHaveCount(0);
});

test('quick quote explicitly creates one survey and saves a second variant into it',async({page})=>{
  test.setTimeout(90000);
  await login(page,'zamer');
  const home=page.locator('#v2HomeScreen');
  const open=async()=>{
    await expect(home).toBeVisible({timeout:20000});
    await home.locator('[data-v2-action="quick"]').click();
    await home.locator('[data-v2-action="sliding"]').click();
    await expect(home.locator('.kd-product-editor')).toBeVisible();
  };
  await open();
  await home.locator('[data-product-field="widthMm"]').fill('4200');
  await home.locator('[data-product-field="paint"]').uncheck();
  await home.locator('[data-product-add]').click();
  await expect(home.locator('[data-product-target] option')).toHaveCount(1);
  await home.locator('[data-product-confirm]').click();
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
  await expect(page.locator('.calculation-card')).toHaveCount(1);
  await page.locator('#closeDetailsBtn').click();
  await expect(page.locator('#surveyList .survey-card')).toHaveCount(1);
  await page.locator('.kd-v2-nav[data-screen="v2Home"]').click();
  await open();
  await home.locator('[data-product-field="widthMm"]').fill('4300');
  await home.locator('[data-product-add]').click();
  await expect(home.locator('[data-product-target] option')).toHaveCount(2);
  await home.locator('[data-product-target]').selectOption({index:1});
  await home.locator('[data-product-confirm]').click();
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
  await expect(page.locator('.calculation-card')).toHaveCount(2);
  const saved=await page.evaluate(async()=>{
    const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('kd-surveyor-stage1');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
    const rows=await new Promise((resolve,reject)=>{const req=db.transaction('surveys').objectStore('surveys').getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
    db.close();
    return rows.map(s=>({workTypes:s.workTypes,calculations:s.configuration.calculations}));
  });
  expect(saved).toHaveLength(1);
  expect(saved[0].workTypes).toEqual(['gates']);
  const [first,second]=saved[0].calculations;
  expect(first.payload.configuration.width).toBe(4.2);
  expect(first.payload.configuration.paint).toBe(false);
  expect(first.estimateRole).toBe('included');
  expect(second.payload.configuration.width).toBe(4.3);
  expect(second.estimateRole).toBe('alternative');
  expect(JSON.stringify(saved)).not.toMatch(/ownerCosts|wageRates|profit/);
});

test('v2 owner retains staff and estimate economy routes with correct labels',async({page})=>{
  await login(page,'admin');
  const home=page.locator('#v2HomeScreen');
  await expect(home).toBeVisible();
  await home.getByRole('button',{name:'Финансы',exact:true}).click();
  await expect(home.locator('.kd-v2-detail')).toContainText('Учёт фактических оплат и расходов появится на этапе 9');
  await home.locator('[data-v2-action="estimateEconomy"]').click();
  await expect(page.locator('#ownerScreen')).toBeVisible();
  await expect(page.locator('#screenTitle')).toHaveText('Расчётная экономика');
  await page.locator('.kd-v2-nav[data-screen="settings"]').click();
  await expect(page.locator('#settingsScreen')).toBeVisible();
  await expect(page.locator('#openTeamBtn')).toBeVisible();
  await page.locator('#openTeamBtn').click();
  await expect(page.locator('#teamScreen')).toBeVisible();
  await expect(page.locator('.kd-v2-nav[data-screen="settings"]')).toHaveAttribute('aria-current','page');
});
test('v2 navigation retains keyboard focus and surveyor has no staff controls',async({page})=>{
  await login(page,'zamer');
  await expect(page.locator('#v2HomeScreen')).toBeVisible();
  const clients=page.locator('.kd-v2-nav[data-screen="clients"]');
  await clients.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#clientsScreen')).toBeVisible();
  await expect(clients).toBeFocused();
  await page.locator('.kd-v2-nav[data-screen="settings"]').click();
  await expect(page.locator('#openTeamBtn')).toBeHidden();
});

test('v2 headings follow workspace and catalogue rather than duplicating the brand',async({page})=>{
  await login(page,'admin');
  const home=page.locator('#v2HomeScreen');
  await expect(home).toBeVisible();
  await expect(page.locator('#screenTitle')).toHaveText('Главная');
  await expect(page.locator('#mainView .topbar .eyebrow')).toHaveText('Тестовая версия · DEV');
  await home.locator('[data-v2-action="workspace"]').click();
  await expect(home.locator('h2')).toHaveText('КД ЗАМЕРЩИК');
  await home.locator('[data-v2-action="catalog"]').click();
  await expect(page.locator('#screenTitle')).toHaveText('Каталог изделий');
  const icons=await home.locator('.kd-v2-action svg path').evaluateAll(els=>els.map(el=>el.getAttribute('d')));
  expect(new Set(icons).size).toBe(7);
  await page.locator('.kd-v2-nav[data-screen="clients"]').click();
  await expect(page.locator('#mainView .topbar .eyebrow')).toHaveText('КД Замерщик · DEV');
  await expect(page.locator('#clientsScreen')).toBeVisible();
  await page.locator('.kd-v2-nav[data-screen="v2Home"]').click();
  await expect(page.locator('#screenTitle')).toHaveText('Главная');
});

test('phone home and catalogue avoid roadmap clutter and label unfinished modules',async({page})=>{
  await login(page,'zamer');
  const home=page.locator('#v2HomeScreen');
  await expect(home).toBeVisible();
  await expect(home.locator('[data-v2-action="calendar"]')).toContainText('Скоро');
  await expect(home.locator('[data-v2-action="check"]')).toContainText('Скоро');
  await expect(home).not.toContainText('Тестовая оболочка');
  await home.locator('[data-v2-action="catalog"]').click();
  await expect(page.locator('#screenTitle')).toHaveText('Каталог изделий');
  await expect(home.locator('h3')).toHaveCount(0);
  await expect(home.locator('[data-v2-action="frames"]')).toContainText('предварительные материалы');
  await expect(home.locator('[data-v2-action="catalogBack"]')).toHaveText('← Назад');
});

test('serial frame geometry uses clear openings, preserves sliding draft, never publishes unverified price',async({page})=>{
  await login(page,'zamer');
  const home=page.locator('#v2HomeScreen');
  await home.locator('[data-v2-action="catalog"]').click();
  await home.locator('[data-v2-action="frames"]').click();
  const plan=home.locator('[data-swing-plan]');
  await expect(plan).toContainText('1 670 × 1 800 мм');
  await expect(plan).toContainText('960 × 1 800 мм');
  await home.locator('[data-swing-field="hinges"]').check();
  await expect(plan).toContainText('Петли');
  await home.locator('[data-swing-field="product"]').selectOption('wicket');
  await expect(plan).not.toContainText('Створка ворот');
  await home.locator('[data-swing-field="wicketWidthMm"]').fill('20');
  await expect(home.locator('[data-swing-errors]')).not.toBeEmpty();
  await expect(plan).toBeEmpty();
  await home.locator('[data-swing-field="wicketWidthMm"]').fill('1100');
  await expect(plan).toContainText('1 060 × 1 800 мм');
  await expect(home).toContainText('Стоимость пока не рассчитана');
  await expect(home.locator('[data-product-confirm]')).toHaveCount(0);
  await home.locator('[data-swing-back]').click();
  await home.locator('[data-v2-action="sliding"]').click();
  await expect(home.locator('[data-product-field="widthMm"]')).toHaveValue('4000');
});

test('Excel geometry modes and three profiles preserve the source lengths and stock allocation',async({page})=>{
  await login(page,'zamer');
  const result=await page.evaluate(async()=>{
    const {simpleGateGeometry,simpleGateUnfilledQuote,packStock}=await import('./simple-gate-engine.js');
    const a=simpleGateGeometry(),b=simpleGateGeometry({profile:'40x40x2'}),c=simpleGateGeometry({profile:'40x25x2'}),d=simpleGateGeometry({gapMode:'sideClearance'});
    // Synthetic tariffs only: no business purchase prices or wages in the repository.
    const rates=Object.fromEntries(['mainPrice','innerPrice','stripPrice','hingePrice','lockPrice','paintPrice','cutDisc','grindDisc','wire','gas','rent','rearPrice','rearPaintArea','pins','mainPaintArea','innerPaintArea','hingePlate','wageGate','wageWicket','wageRound','frameMarkup'].map(k=>[k,1]));
    const quote=simpleGateUnfilledQuote({paint:false},rates);
    const painted=simpleGateUnfilledQuote({paint:true},rates);
    let invalid=false,missing=false,tooLong=false;
    try{simpleGateGeometry({wicketType:'builtIn',wicketWidthMm:2000})}catch{invalid=true}
    try{simpleGateUnfilledQuote({},null)}catch{missing=true}
    try{packStock([6001])}catch{tooLong=true}
    return {a,b,c,d,quote,painted,invalid,missing,tooLong};
  });
  const {a,b,c,d,quote,painted}=result;
  expect(a.leafWidthMm).toBe(1690);
  expect(a.wicketLeafWidthMm).toBe(990);
  expect(a.main.actualMm).toBeCloseTo(24940,6);
  expect(a.inner.actualMm).toBeCloseTo(27510,6);
  expect(a.main.count).toBe(5);
  expect(a.inner.count).toBe(6);
  expect(a.rearActualMm).toBe(4200);
  expect(a.rearPurchaseMm).toBe(6000);
  expect(b.main).toEqual(a.main);
  expect(b.inner).toEqual(a.inner);
  expect(c.inner.count).toBe(0);
  expect(c.main.actualMm).toBeCloseTo(30902.34449566787,6);
  expect(d.leafWidthMm).toBe(1670);
  expect(d.wicketLeafWidthMm).toBe(960);
  expect(quote.cost).toBeCloseTo(quote.bare,6);
  expect(painted.cost-quote.cost).toBeCloseTo(painted.paint,6);
  expect(painted.profit).toBeCloseTo(0,6);
  expect(result.invalid&&result.missing&&result.tooLong).toBe(true);
  const home=page.locator('#v2HomeScreen');
  await home.locator('[data-v2-action="catalog"]').click();
  await home.locator('[data-v2-action="frames"]').click();
  await home.locator('[data-swing-field="profile"]').selectOption('60x40x2');
  await home.locator('[data-swing-field="gapMode"]').selectOption('excel');
  await expect(home.locator('[data-swing-plan]')).toContainText('1 690 × 1 800 мм');
  await expect(home.locator('[data-swing-plan]')).toContainText('20×20×1.5');
  await expect(home.locator('[data-swing-plan]')).toContainText('6 хл.');
  await expect(home).toContainText('Стоимость пока не рассчитана');
});

test('workbook infill and extras preserve panel counts, shared reserves and rounding',async({page})=>{
  await login(page,'zamer');
  const result=await page.evaluate(async()=>{
    const {simpleGateFill,simpleGateExtras,simpleGateCompleteQuote}=await import('./simple-gate-engine.js');
    const fill=Object.fromEntries(['none','single','chess','horizontal','sheet'].map(t=>[t,simpleGateFill({fill:t})]));
    const built=simpleGateFill({fill:'sheet',wicketType:'builtIn'});
    const builtChess=simpleGateFill({fill:'chess',wicketType:'builtIn',wicketHeightMm:1600});
    const extras=[simpleGateExtras({postType:'80x80',link:true}),simpleGateExtras({postType:'80x80',wicketPosition:'separate'}),simpleGateExtras({postType:'80x80',wicketType:'builtIn',link:true}),simpleGateExtras({postType:'80x80',manualPosts:0})];
    const rates=Object.fromEntries(['mainPrice','innerPrice','stripPrice','hingePrice','lockPrice','paintPrice','cutDisc','grindDisc','wire','gas','rent','rearPrice','rearPaintArea','pins','mainPaintArea','innerPaintArea','hingePlate','wageGate','wageWicket','wageRound','frameMarkup'].map(k=>[k,1]));
    const q=simpleGateCompleteQuote({fill:'sheet',postType:'80x80',link:true,installation:'set'},rates,{sheetPrice:10,sheetScrewPrice:1,sheetGateLabor:2,sheetWicketLabor:3,fillMarkup:1.2},{post80x80:100,linkBase:500,installset:200});
    let rejected=0;for(const fn of [()=>simpleGateFill({profile:'40x40x2',fill:'chess'}),()=>simpleGateExtras({wicketType:'builtIn',installation:'set'}),()=>simpleGateExtras({manualPosts:2.5}),()=>simpleGateCompleteQuote({fill:'sheet'},rates,{}, {})])try{fn()}catch{rejected++}
    return {fill,built,builtChess,extras,q,rejected};
  });
  const {fill,built,builtChess,extras,q,rejected}=result;
  expect(fill.none.total.screws).toBe(0);
  expect(fill.single.total.front).toBe(29);
  expect(fill.single.total.back).toBe(0);
  expect(fill.single.total.picketMm).toBe(52200);
  expect(fill.single.total.screws).toBe(116);
  expect(fill.chess.total.front).toBe(26);
  expect(fill.chess.total.back).toBe(23);
  expect(fill.chess.total.spare).toBe(4);
  expect(fill.chess.total.picketMm).toBe(95400);
  expect(fill.chess.total.screws).toBe(196);
  expect(fill.horizontal.total.spare).toBe(8);
  expect(fill.horizontal.total.picketMm).toBe(102490);
  expect(fill.horizontal.total.screws).toBe(378);
  expect(fill.sheet.total.sheets).toBe(4);
  expect(fill.sheet.total.areaM2).toBeCloseTo(8.64,8);
  expect(fill.sheet.total.screws).toBe(72);
  expect(built.total.sheets).toBe(3);
  expect(built.total.areaM2).toBeCloseTo(6.48,8);
  expect(built.total.screws).toBe(54);
  expect(builtChess.panels).toHaveLength(5);
  expect(extras.map(x=>x.postCount)).toEqual([3,4,2,0]);
  expect(extras.map(x=>x.linkMm)).toEqual([4400,0,3400,0]);
  expect(q.fillEconomics.cost).toBeCloseTo(8.64*10+72+5,8);
  expect(q.total).toBe(q.productRetail+1000);
  expect(q.gateRetail+q.wicketRetail).toBe(q.productRetail);
  expect(q.extrasProfit).toBeNull();
  expect(q.netProfit).toBeNull();
  expect(rejected).toBe(4);
  const home=page.locator('#v2HomeScreen');
  await home.locator('[data-v2-action="catalog"]').click();
  await home.locator('[data-v2-action="frames"]').click();
  await home.locator('[data-swing-field="gapMode"]').selectOption('excel');
  await home.locator('[data-swing-field="fill"]').selectOption('sheet');
  await home.locator('[data-swing-field="postType"]').selectOption('80x80');
  await home.locator('[data-swing-field="link"]').check();
  const plan=home.locator('[data-swing-fill-plan]');
  await expect(plan).toContainText('8,64');
  await expect(plan).toContainText('72');
  await expect(plan).toContainText('4400');
  await home.locator('[data-swing-field="profile"]').selectOption('40x40x2');
  await home.locator('[data-swing-field="fill"]').selectOption('chess');
  await expect(home.locator('[data-swing-errors]')).toContainText('недопустимо');
  await expect(plan).toBeEmpty();
});

test('built-in swing wicket follows workbook dimensions and restores its own draft',async({page})=>{
  await login(page,'zamer');
  const home=page.locator('#v2HomeScreen');
  const open=async()=>{await home.locator('[data-v2-action="catalog"]').click();await home.locator('[data-v2-action="frames"]').click();};
  await open();
  await home.locator('[data-swing-field="profile"]').selectOption('60x40x2');
  await home.locator('[data-swing-field="gapMode"]').selectOption('excel');
  await home.locator('[data-swing-field="installation"]').selectOption('set');
  await home.locator('[data-swing-field="wicketType"]').selectOption('builtIn');
  await expect(home.locator('[data-swing-field="installation"]')).toHaveValue('none');
  await expect(home.locator('[data-swing-position]')).toBeHidden();
  expect(await home.locator('[data-swing-field="installation"] option[value="set"]').evaluate(option=>option.disabled&&option.hidden)).toBe(true);
  await home.locator('[data-swing-field="installation"]').selectOption('builtIn');
  await home.locator('[data-swing-field="postType"]').selectOption('80x80');
  await home.locator('[data-swing-field="link"]').check();
  await home.locator('[data-swing-field="fill"]').selectOption('sheet');
  const plan=home.locator('[data-swing-fill-plan]');
  await expect(plan).toContainText('6,48');
  await expect(plan).toContainText('54');
  await expect(plan).toContainText('3400');
  await expect(home.locator('[data-swing-plan]')).toContainText('Встроенная калитка');
  await expect(home.locator('[data-swing-sketch] svg')).toBeVisible();
  await home.locator('[data-swing-field="wicketWidthMm"]').fill('1690');
  await expect(home.locator('[data-swing-errors]')).not.toBeEmpty();
  await expect(plan).toBeEmpty();
  await home.locator('[data-swing-field="wicketWidthMm"]').fill('900');
  await home.locator('[data-swing-field="wicketHeightMm"]').fill('1900');
  await expect(home.locator('[data-swing-errors]')).not.toBeEmpty();
  await home.locator('[data-swing-field="wicketHeightMm"]').fill('1600');
  await expect(home.locator('[data-swing-errors]')).toBeEmpty();
  await page.reload();
  await expect(home).toBeVisible({timeout:20000});
  await open();
  await expect(home.locator('[data-swing-field="wicketType"]')).toHaveValue('builtIn');
  await expect(home.locator('[data-swing-field="wicketWidthMm"]')).toHaveValue('900');
  await expect(home.locator('[data-swing-field="wicketHeightMm"]')).toHaveValue('1600');
  await expect(home.locator('[data-swing-field="installation"]')).toHaveValue('builtIn');
  await expect(home.locator('[data-swing-field="fill"]')).toHaveValue('sheet');
  await home.locator('[data-swing-field="wicketType"]').selectOption('separate');
  await expect(home.locator('[data-swing-field="installation"]')).toHaveValue('none');
  await expect(home.locator('[data-swing-position]')).toBeVisible();
  await home.locator('[data-swing-back]').click();
  await home.locator('[data-v2-action="sliding"]').click();
  await expect(home.locator('[data-product-field="widthMm"]')).toHaveValue('4000');
  await page.locator('#profileBtn').click();
  await page.locator('#logoutBtn').click();
  await expect(page.locator('#loginView')).toBeVisible();
  expect(await page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('kd-v2-swing-draft-v1:')))).toEqual([]);
});

test('synthetic swing quotes separate owner economics and save only an allowlisted test snapshot',async({page})=>{
  await login(page,'zamer','v2&swingDemo=1');
  const home=page.locator('#v2HomeScreen');
  const result=await page.evaluate(async()=>{
    const {makeSwingDemoQuote,buildSwingCalculation}=await import('./simple-gate-quote.js');
    const input={widthMm:3400,heightMm:1800,wicketWidthMm:1000,wicketHeightMm:1800,profile:'60x40x2',wicketType:'separate',gapMode:'excel',fill:'sheet',postType:'none',wicketPosition:'adjacent',installation:'none',paint:true,link:false,manualPosts:null,privateRate:123456};
    const owner=makeSwingDemoQuote(input,'owner'),surveyor=makeSwingDemoQuote(input,'surveyor');
    const item=buildSwingCalculation({...owner,customer:{...owner.customer,configuration:{...owner.customer.configuration,secret:999},prices:{...owner.customer.prices,wage:999}}},'test');
    let rejected=false;try{buildSwingCalculation({...surveyor,customer:{...surveyor.customer,prices:{...surveyor.customer.prices,total:1}}},'bad')}catch{rejected=true}
    return {owner,surveyor,item,rejected};
  });
  expect(result.owner.owner.productCost).toBeGreaterThan(0);
  expect(result.surveyor.owner).toBeUndefined();
  expect(result.owner.customer).toEqual(result.surveyor.customer);
  expect(result.item.payload.test).toBe(true);
  expect(result.item.payload.configuration.secret).toBeUndefined();
  expect(result.item.payload.configuration.privateRate).toBeUndefined();
  expect(result.item.payload.prices.wage).toBeUndefined();
  expect(result.rejected).toBe(true);
  await home.locator('[data-v2-action="catalog"]').click();
  await home.locator('[data-v2-action="frames"]').click();
  await home.locator('[data-swing-demo-quote]').click();
  await expect(home.locator('[data-swing-demo-result]')).toContainText('Условная цена:');
  await expect(home.locator('[data-swing-demo-result]')).not.toContainText('Себестоимость');
  await home.locator('[data-swing-field="gateWidthMm"]').fill('3500');
  await expect(home.locator('[data-swing-demo-save]')).toBeHidden();
  await home.locator('[data-swing-demo-quote]').click();
  await home.locator('[data-swing-demo-save]').click();
  const dialog=page.locator('#surveyDetailsDialog');
  await expect(dialog).toBeVisible({timeout:20000});
  await expect(dialog.locator('.calculation-card')).toHaveCount(1);
  await expect(dialog.locator('.calculation-card')).toContainText('Тест ·');
  await expect(dialog.locator('.calculation-card')).toContainText('3500 × 1800 мм');
  await expect(dialog.locator('.calculation-card [data-show-calculation]')).toHaveCount(0);
  const snapshot=await page.evaluate(async()=>{
    const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('kd-surveyor-stage1');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
    const surveys=await new Promise((resolve,reject)=>{const req=db.transaction('surveys').objectStore('surveys').getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
    db.close();
    return surveys.flatMap(s=>s.configuration?.calculations||[]).find(c=>c.type==='simpleSwing');
  });
  expect(snapshot.payload.test).toBe(true);
  expect(snapshot.payload.tariffRevision).toBe('synthetic-preview-v1');
  expect(snapshot.payload.configuration.widthMm).toBe(3500);
  expect(snapshot.payload.prices.wage).toBeUndefined();
  expect(snapshot.owner).toBeUndefined();
});
