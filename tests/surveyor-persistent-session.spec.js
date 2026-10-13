import {test, expect} from '@playwright/test';

test.use({viewport:{width:390,height:844}});

test('DEV PWA keeps a sign-in across tabs, restarts and offline; explicit logout clears it', async ({context}) => {
  // DEV password gate is separate from employee sign-in.
  await context.addInitScript(() => localStorage.setItem('kuzdvor-dev-access-v1', '1'));
  const first = await context.newPage();
  await first.goto('/kuznechny-dvorik-gates/dev-tools-v4/');
  await expect(first.locator('#loginView')).toBeVisible();
  await first.locator('#loginInput').fill('zamer');
  await first.locator('#passwordInput').fill('1234');
  await first.locator('#loginForm button[type="submit"]').click();
  await expect(first.locator('#mainView')).toBeVisible();

  const saved = await first.evaluate(async () => {
    const db = await new Promise((resolve,reject)=>{
      const request = indexedDB.open('kd-surveyor-stage1');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const session = await new Promise((resolve,reject)=>{
      const request = db.transaction('meta').objectStore('meta').get('persistentSession');
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
    return {
      session,
      legacy:sessionStorage.getItem('kdSurveyorSession'),
      passwordInSession:JSON.stringify(session || {}).includes('1234')
    };
  });
  expect(saved.session?.id).toBe('emp_surveyor');
  expect(saved.legacy).toBeNull();
  expect(saved.passwordInSession).toBe(false);

  // A new tab has completely fresh sessionStorage but shares persistent IndexedDB.
  await first.close();
  const reopened = await context.newPage();
  await reopened.goto('/kuznechny-dvorik-gates/dev-tools/');
  await expect(reopened.locator('#mainView')).toBeVisible();
  await expect(reopened.locator('#loginView')).toBeHidden();

  // The installed app's shared worker must also retain that identity offline.
  await expect.poll(() => reopened.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration('../');
    return !!reg?.active;
  }), {timeout:15000}).toBe(true);
  await reopened.reload();
  await expect.poll(() => reopened.evaluate(() => !!navigator.serviceWorker.controller), {timeout:10000}).toBe(true);
  await context.setOffline(true);
  await reopened.reload({waitUntil:'domcontentloaded'});
  await expect(reopened.locator('#mainView')).toBeVisible();
  await expect(reopened.locator('#networkBadge')).toContainText('Офлайн');

  await reopened.locator('#profileBtn').click();
  await reopened.locator('#logoutBtn').click();
  await expect(reopened.locator('#loginView')).toBeVisible();
  await reopened.reload({waitUntil:'domcontentloaded'});
  await expect(reopened.locator('#loginView')).toBeVisible();

  const persisted = await reopened.evaluate(async () => {
    const db=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('kd-surveyor-stage1');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    return new Promise((resolve,reject)=>{
      const request=db.transaction('meta').objectStore('meta').get('persistentSession');
      request.onsuccess=()=>resolve(request.result?.value || null);
      request.onerror=()=>reject(request.error);
    });
  });
  expect(persisted).toBeNull();

  // Login remains possible with the previously cached local employee password.
  await reopened.locator('#loginInput').fill('zamer');
  await reopened.locator('#passwordInput').fill('1234');
  await reopened.locator('#loginForm button[type="submit"]').click();
  await expect(reopened.locator('#mainView')).toBeVisible();
});
