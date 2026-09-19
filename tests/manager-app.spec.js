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
  await expect(page.locator('[data-measurement]')).not.toHaveValue('');

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
