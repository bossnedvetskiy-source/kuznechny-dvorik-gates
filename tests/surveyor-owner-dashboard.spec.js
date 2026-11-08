import {test,expect} from '@playwright/test';

test.use({viewport:{width:390,height:844}});

async function signIn(page,user) {
  await page.addInitScript(()=>localStorage.setItem('kuzdvor-dev-access-v1','1'));
  await page.goto('/kuznechny-dvorik-gates/dev-tools/');
  await page.locator('#loginInput').fill(user);
  await page.locator('#passwordInput').fill('1234');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#mainView')).toBeVisible();
}

test('owner sees separate business home, material economics, editable private demo expenses',async ({page})=>{
  const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
  await signIn(page,'admin');
  await expect(page.locator('#ownerScreen')).toBeVisible();
  await expect(page.locator('#ownerNavBtn')).toBeVisible();
  await expect(page.locator('#ownerDashboardRoot')).toContainText('КД Управление');
  await page.locator('[data-screen="surveys"]').click();
  await page.locator('#newSurveyBtn').click();
  await page.locator('#surveyAddress').fill('Мелеуз, тест собственника');
  await page.locator('#saveSurveyBtn').click();
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
  await expect(page.locator('[data-owner-pane="finance"]')).toBeVisible();
  await expect(page.locator('[data-owner-pane="quote"]')).toBeHidden();
  await page.evaluate(async()=>{
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('kd-surveyor-stage1');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('surveys','readwrite');
      const store=tx.objectStore('surveys');
      const req=store.getAll();
      req.onsuccess=()=>{
        const survey=req.result.find(x=>String(x.address).includes('тест собственника'));
        if(!survey)throw Error('Missing survey');
        survey.configuration=survey.configuration||{};
        survey.configuration.calculations=[{id:'picket_test_1',type:'fence',title:'Забор из евроштакетника',estimateRole:'included',total:73834,payload:{configuration:{
          fenceType:'vertical-double',postType:'80x80x3',includeNewPosts:true,existingPostsCount:0,
          sections:[{length:10,height:1.8}],delivery:{known:true,price:0},summary:{totalLength:10,totalSpans:4,newPosts:5}
        }}}];
        store.put(survey);
      };
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
    });db.close();
  });
  await page.locator('#closeDetailsBtn').click();
  await page.locator('.survey-card').first().click();
  await expect(page.locator('[data-owner-pane="finance"]')).toContainText('Перед / купить');
  await expect(page.locator('[data-owner-pane="finance"]')).toContainText('Зад / купить');
  await expect(page.locator('[data-owner-pane="finance"]')).toContainText('40×20×2');
  await page.locator('[data-owner-cost="extra"]').fill('1000');
  await page.locator('[data-owner-save-expenses]').click();
  await expect(page.locator('[data-owner-pane="finance"]')).toBeVisible();
  await expect(page.locator('[data-owner-cost="extra"]')).toHaveValue('1000');
  await page.locator('[data-owner-detail-tab="quote"]').click();
  await expect(page.locator('[data-owner-pane="quote"]')).toBeVisible();
  await expect(page.locator('[data-owner-pane="finance"]')).toBeHidden();
  await page.locator('[data-v3-preview]').click();
  await expect(page.locator('#customerPreviewContent')).not.toContainText('себестоимость');
  await expect(page.locator('#customerPreviewContent')).not.toContainText('прибыль');
  expect(pageErrors).toEqual([]);
});

test('surveyor stays in measurement UI without owner dashboard, finance or private navigation',async ({page})=>{
  await signIn(page,'zamer');
  await expect(page.locator('#surveysScreen')).toBeVisible();
  await expect(page.locator('#ownerNavBtn')).toBeHidden();
  await page.locator('#newSurveyBtn').click();
  await page.locator('#saveSurveyBtn').click();
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
  await expect(page.locator('[data-owner-pane="finance"]')).toHaveCount(0);
  await expect(page.locator('[data-owner-detail-tab]')).toHaveCount(0);
  await expect(page.locator('[data-owner-cost]')).toHaveCount(0);
});

test('sliding gates: owner sees automatic BOM, can set wage rates, surveyor cannot see costs',async ({page})=>{
  test.setTimeout(90000);
  await signIn(page,'admin');
  await page.locator('[data-screen="surveys"]').click();
  await page.locator('#newSurveyBtn').click();
  await page.locator('#saveSurveyBtn').click();
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
  await page.locator('[data-owner-detail-tab="quote"]').click();
  await page.locator('[data-v3-calc="sliding"]').click();
  await expect(page).toHaveURL(/sliding-gates\/index\.html/);
  await page.locator('#width').fill('4');
  await page.locator('#height').fill('1.8');
  await page.locator('#builtInWicket').check();
  await expect(page.locator('#saveBtn')).toBeEnabled();
  await page.locator('#saveBtn').click();
  await page.waitForURL(/resumeSurvey=/,{timeout:30000});
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
  await page.locator('[data-owner-detail-tab="finance"]').click();
  const pane=page.locator('[data-owner-pane="finance"]');
  await expect(pane).toBeVisible();
  await expect(pane).toContainText('Труба 60×40×2');
  await expect(pane).toContainText('Зарплата сварщика');
  await expect(pane).toContainText('Зарплата маляра');
  await expect(pane).toContainText('Не заполнены тарифы');
  await expect(pane).toContainText('Прибыль по изделию');
  await pane.locator('summary').filter({hasText:'Закупочные тарифы и зарплаты'}).click();
  await pane.locator('[data-owner-cost$="_weldGate"]').fill('5000');
  await pane.locator('[data-owner-cost$="_painter"]').fill('200');
  await pane.locator('[data-owner-cost$="_paintMaterial"]').fill('100');
  await pane.locator('[data-owner-cost$="_cladding"]').fill('1500');
  await pane.locator('[data-owner-cost$="_sheet"]').fill('600');
  await pane.locator('[data-owner-cost$="_rollers"]').fill('12000');
  await pane.locator('[data-owner-cost$="_bolts"]').fill('400');
  await pane.locator('[data-owner-save-expenses]').click();
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
  const updated=page.locator('[data-owner-pane="finance"]');
  await expect(updated).toContainText('Зарплата сварщика');
  await expect(updated.locator('.owner-warning').filter({hasText:'Не заполнены тарифы'})).toHaveCount(0);
  await page.locator('[data-owner-detail-tab="quote"]').click();
  await expect(page.locator('[data-owner-pane="finance"]')).toBeHidden();
  await expect(page.locator('[data-owner-pane="quote"]')).not.toContainText('Зарплата маляра');
});

test('owner quick sliding estimate: customer/owner modes, live profit and zero saved orders',async ({page})=>{
  test.setTimeout(75000);
  await signIn(page,'admin');
  await expect(page.locator('#ownerScreen')).toBeVisible();
  await expect(page.locator('[data-owner-quick]')).toBeVisible();
  await page.locator('[data-owner-quick]').click();
  await expect(page.locator('#ownerQuickScreen')).toBeVisible();
  await expect(page.locator('.ownerq-price strong')).toContainText('₽');
  await expect(page.locator('[data-oq-owner]')).toBeVisible();
  await page.locator('.ownerq-rate-editor summary').click();
  await page.locator('[data-oq-demo]').click();
  const cost=page.locator('.ownerq-finance-grid strong').nth(1);
  const profit=page.locator('.ownerq-finance-grid strong').nth(2);
  await expect(cost).toContainText('₽');
  await expect(profit).toContainText('₽');
  const prior=await profit.innerText();
  await page.locator('[data-oq-field="width"]').fill('5');
  await expect(profit).not.toHaveText(prior);
  await page.locator('[data-oq-field="builtInWicket"]').check();
  await expect(page.locator('.ownerq-sketch svg .wicket')).toHaveCount(1);
  await page.locator('[data-oq-mode="client"]').click();
  await expect(page.locator('[data-oq-client]')).toBeVisible();
  await expect(page.locator('[data-oq-owner]')).toBeHidden();
  await expect(page.locator('[data-oq-client]')).not.toContainText(/себестоимость|зарплата|прибыль/i);
  await page.locator('[data-oq-mode="owner"]').click();
  await expect(page.locator('[data-oq-owner]')).toBeVisible();
  await page.locator('[data-oq-back]').click();
  await expect(page.locator('#ownerScreen')).toBeVisible();
  await expect(page.locator('[data-owner-open]')).toHaveCount(0);
});
