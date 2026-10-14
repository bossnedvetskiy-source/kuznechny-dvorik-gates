import {test, expect} from '@playwright/test';

test('manager app shows leads, calls, status and measurement scheduling', async ({page}) => {
  let workflowSaved = null;

  await page.route('**/api/admin/leads?*', async route => {
    await route.fulfill({
      status:200,
      contentType:'application/json',
      body:JSON.stringify({
        leads:[{
          id:501,
          created_at:'2026-09-20 10:00:00',
          updated_at:'2026-09-20 10:00:00',
          status:'new',
          name:'Иван',
          phone:'+7 937 111-22-33',
          city:'Макарово, Ишимбайский район',
          category:'gates',
          article:'Арт.6',
          width:4,
          height:1.8,
          wicket_width:1.02,
          posts:false,
          total:98000,
          client_total:98000
        }],
        counts:{new:1,contacted:0,done:0,archived:0}
      })
    });
  });

  await page.route('**/api/admin/lead-workflows?*', async route => {
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({workflows:{'501':{stage:'new',nextActionAt:''}}})});
  });

  await page.route('**/api/admin/lead-workflows/501', async route => {
    workflowSaved=route.request().postDataJSON();
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,id:501,stage:workflowSaved.stage})});
  });

  await page.goto('/manager.html', {waitUntil:'domcontentloaded'});
  await expect(page.locator('#appView')).toBeVisible({timeout:5000});
  await expect(page.locator('.lead-card')).toContainText('Макарово');
  await expect(page.locator('.lead-card')).toContainText('Арт.6');
  await expect(page.locator('.contact-row a').first()).toHaveAttribute('href',/tel:/);

  await page.locator('[data-schedule]').click();
  await expect(page.locator('[data-stage]')).toHaveValue('measurement_scheduled');
  await page.locator('[data-measurement]').fill('2030-01-01T10:00');
  await expect(page.locator('[data-measurement]')).toHaveValue('2030-01-01T10:00');

  await page.locator('[data-save]').click();
  await expect.poll(() => workflowSaved?.stage).toBe('measurement_scheduled');
  expect(workflowSaved.nextActionAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
});

test('manager login uses existing protected admin session', async ({page}) => {
  let loggedIn=false;
  await page.route('**/api/admin/leads?*', async route => {
    if(!loggedIn){
      await route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'Требуется вход'})});
      return;
    }
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({leads:[],counts:{new:0,contacted:0,done:0,archived:0}})});
  });
  await page.route('**/api/admin/login', async route => {
    loggedIn=true;
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true})});
  });

  await page.goto('/manager.html', {waitUntil:'domcontentloaded'});
  await expect(page.locator('#loginView')).toBeVisible();
  await page.locator('#username').fill('manager');
  await page.locator('#password').fill('secret');
  await page.locator('#loginButton').click();
  await expect(page.locator('#appView')).toBeVisible();
  await expect(page.locator('#emptyView')).toBeVisible();
});


async function managerFixture(page, {stage='new', hasMore=false}={}) {
  const state={stage,note:'Измерить уклон',lossReason:'Цена',nextActionAt:'',revision:2,posts:[],leadLoads:0};
  const lead={id:501,created_at:'2026-09-20 10:00:00',name:'Иван',phone:'8 937 111-22-33',city:'Макарово',category:'gates',article:'Арт.6',width:4,height:1.8,wicket_width:1.02,wicket_height:1.8,total:98000,quote_verified:false,comment:'Въезд со стороны школы',color:'Чёрный',install:true};
  await page.route('**/api/admin/**',async route=>{
    const url=new URL(route.request().url());
    let body={};
    if(url.pathname==='/api/admin/leads'){
      state.leadLoads++;
      const older=url.searchParams.has('before_id');
      body={user:{id:1,username:'admin',role:'admin'},leads:[older?{...lead,id:1,name:'Старый клиент'}:lead],page:{hasMore:hasMore&&!older,nextBeforeId:hasMore&&!older?501:null}};
    }else if(url.pathname==='/api/admin/lead-workflows'){
      body={workflows:{'501':{...state},'1':{stage:'measurement_scheduled',note:'',lossReason:'',nextActionAt:'2030-01-01T10:00',revision:0}}};
    }else if(url.pathname==='/api/admin/lead-workflows/501'){
      const sent=route.request().postDataJSON();state.posts.push(sent);Object.assign(state,sent,{revision:state.revision+1});body={ok:true,...sent,revision:state.revision};
    }else if(url.pathname==='/api/admin/manager-team'){
      body={users:[{id:1,username:'admin',role:'admin'},{id:2,username:'surveyor',role:'surveyor'}]};
    }else if(url.pathname==='/api/admin/logout'){body={ok:true}}
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('/manager.html');
  await expect(page.locator('#appView')).toBeVisible();
  return state;
}

test('manager preserves notes and loss reason while saving a date',async({page})=>{
  const state=await managerFixture(page);
  await page.locator('[data-measurement]').fill('2030-01-01T10:00');
  await page.locator('[data-save]').click();
  await expect.poll(()=>state.posts.length).toBe(1);
  expect(state.posts[0]).toMatchObject({note:'Измерить уклон',lossReason:'Цена',expectedRevision:2,nextActionAt:'2030-01-01T10:00'});
});

test('manager polling and tab changes preserve unsaved inputs',async({page})=>{
  await page.clock.install();
  const state=await managerFixture(page);
  await page.locator('[data-note]').fill('Мой черновик');
  await page.locator('[data-measurement]').fill('2030-01-01T11:00');
  const loads=state.leadLoads;
  await page.clock.fastForward(16000);
  await expect.poll(()=>state.leadLoads).toBeGreaterThan(loads);
  await expect(page.locator('[data-note]')).toHaveValue('Мой черновик');
  await page.locator('[data-filter="all"]').click();
  await expect(page.locator('[data-measurement]')).toHaveValue('2030-01-01T11:00');
});

test('manager loads old active measurements beyond the first page',async({page})=>{
  await managerFixture(page,{hasMore:true});
  await page.locator('[data-filter="measurement"]').click();
  await expect(page.locator('.lead-card')).toContainText('Старый клиент');
  await expect(page.locator('#countMeasurement')).toHaveText('1');
});

test('manager can preserve production and installation stages',async({page})=>{
  const state=await managerFixture(page,{stage:'production'});
  await page.locator('[data-filter="work"]').click();
  await expect(page.locator('[data-stage]')).toHaveValue('production');
  await page.locator('[data-save]').click();
  await expect.poll(()=>state.posts[0]?.stage).toBe('production');
  await page.locator('[data-stage]').selectOption('installation');
  await page.locator('[data-save]').click();
  await expect.poll(()=>state.posts[1]?.stage).toBe('installation');
});

test('manager explains a wrong password',async({page})=>{
  await page.route('**/api/admin/**',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:route.request().url().includes('/login')?'Неверный логин или пароль':'Требуется вход'})}));
  await page.goto('/manager.html');
  await page.locator('#username').fill('wrong');await page.locator('#password').fill('wrong');await page.locator('#loginButton').click();
  await expect(page.locator('#loginError')).toHaveText('Неверный логин или пароль');
  await expect(page.locator('#loginError')).toBeVisible();
});

test('manager distinguishes server failures and shows full client details',async({page})=>{
  await managerFixture(page);
  await expect(page.locator('.contact-row a').first()).toHaveAttribute('href','tel:+79371112233');
  await expect(page.locator('.lead-card')).toContainText('Въезд со стороны школы');
  await expect(page.locator('.lead-card')).toContainText('Чёрный');
  await expect(page.locator('.lead-card')).toContainText('Предварительная цена');
  await page.route('**/api/admin/leads?*',route=>route.fulfill({status:500,contentType:'application/json',body:'{"error":"Ошибка сервера"}'}));
  await page.locator('#refreshButton').click();
  await expect(page.locator('#offlineBadge')).toContainText('Сервер недоступен');
});

test('manager keeps a conflicting draft until an explicit decision',async({page})=>{
  await managerFixture(page);
  await page.route('**/api/admin/lead-workflows/501',route=>route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'Конфликт',workflow:{stage:'contacted',note:'Заметка другого сотрудника',revision:3,nextActionAt:''}})}));
  await page.locator('[data-note]').fill('Мой черновик');await page.locator('[data-save]').click();
  await expect(page.locator('[data-note]')).toHaveValue('Мой черновик');
  await expect(page.locator('.conflict')).toContainText('Заметка другого сотрудника');
  await page.locator('[data-discard]').click();
  await page.locator('[data-filter="work"]').click();
  await expect(page.locator('[data-note]')).toHaveValue('Заметка другого сотрудника');
});

test('manager can unlock encrypted cached leads on a cold offline launch',async({page,context})=>{
  await managerFixture(page);
  page.once('dialog',dialog=>dialog.accept('offline-password'));
  await page.locator('#offlineButton').click();
  await expect(page.locator('#toast')).toContainText('Офлайн-доступ включён');
  expect(await page.evaluate(()=>localStorage.getItem('kuzdvor-manager-leads-v2'))).not.toContain('Макарово');
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('#offlineForm')).toBeVisible();
  await page.locator('#offlinePin').fill('offline-password');
  await page.locator('#offlineForm button').click();
  await expect(page.locator('#appView')).toBeVisible();
  await expect(page.locator('.lead-card')).toContainText('Макарово');
  await page.locator('[data-note]').fill('Черновик без сети');
  await page.locator('[data-save]').click();
  await expect(page.locator('#toast')).toContainText('Черновик сохранён на устройстве');
});
