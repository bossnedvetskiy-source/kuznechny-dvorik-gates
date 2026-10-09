import {test,expect} from '@playwright/test';
test.use({viewport:{width:390,height:844}});

async function startSurvey(page) {
  await page.addInitScript(()=>localStorage.setItem('kuzdvor-dev-access-v1','1'));
  await page.goto('/kuznechny-dvorik-gates/dev-tools-v4/');
  await page.locator('#loginInput').fill('zamer');
  await page.locator('#passwordInput').fill('1234');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#mainView')).toBeVisible({timeout:20000});
  await page.locator('#newSurveyBtn').click();
  await page.locator('#saveSurveyBtn').click();
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
}
async function changeSurvey(page, callbackArg) {
  await page.evaluate(async change => {
    const db=await new Promise((ok,err)=>{
      const r=indexedDB.open('kd-surveyor-stage1');
      r.onsuccess=()=>ok(r.result);r.onerror=()=>err(r.error);
    });
    const rows=await new Promise((ok,err)=>{
      const r=db.transaction('surveys').objectStore('surveys').getAll();
      r.onsuccess=()=>ok(r.result);r.onerror=()=>err(r.error);
    });
    const survey=rows[0];
    if(change==='seed'){
      survey.configuration={...survey.configuration,calculations:[
        {id:'g1',type:'gates',title:'Ворота · Арт.6',total:73800,estimateRole:'included',
          payload:{article:'Арт.6',width:3.4,height:1.8,wicketWidth:1,wicketHeight:1.8,posts:true,deliveryPending:false}},
        {id:'f1',type:'fence',title:'Забор',total:35000,estimateRole:'included',
          payload:{deliveryPending:false,configuration:{fenceType:'vertical-single',includeNewPosts:true,
            summary:{totalLength:12,deliveryCost:1000},sections:[
              {length:6,height:1.8,gateOpening:0,wicketOpening:0},
              {length:10,height:1.8,gateOpening:3.4,wicketOpening:1}
            ]}}}
      ]};
    } else if(change==='resize') {
      survey.configuration.calculations[0].payload.width=3.6;
      survey.configuration.calculations[1].payload.configuration.sections[0].length=7;
    } else if(change==='openings-only') {
      survey.configuration={...survey.configuration,calculations:[{
        id:'f2',type:'fence',title:'Забор',total:14000,estimateRole:'included',
        payload:{configuration:{fenceType:'vertical-single',includeNewPosts:true,sections:[
          {length:10,height:1.8,gateOpening:3.4,wicketOpening:1}]}}
      }]};
    }
    await new Promise((ok,err)=>{
      const t=db.transaction('surveys','readwrite');
      t.objectStore('surveys').put(survey);t.oncomplete=ok;t.onerror=()=>err(t.error);
    });
    db.close();
  },callbackArg);
}
async function rows(page){
  return page.evaluate(async()=>{
    const db=await new Promise((ok,err)=>{
      const r=indexedDB.open('kd-surveyor-stage1');
      r.onsuccess=()=>ok(r.result);r.onerror=()=>err(r.error);
    });
    const result=await new Promise((ok,err)=>{
      const r=db.transaction('surveys').objectStore('surveys').getAll();
      r.onsuccess=()=>ok(r.result);r.onerror=()=>err(r.error);
    });db.close();return result;
  });
}
async function reopen(page){
  await page.locator('#closeDetailsBtn').click();
  await page.locator('.survey-card').first().click();
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
}

test('scheme gets selected gate and wicket plus fence spans, without inventing opening positions or altering prices',async({page})=>{
  await startSurvey(page);
  await changeSurvey(page,'seed');
  await reopen(page);
  await expect(page.locator('.v3-plan-overview')).toBeVisible();
  await expect(page.locator('[data-build-plan-from-calcs]')).toBeVisible();
  await expect(page.locator('.plan-quote-warnings')).toContainText('есть проёмы');
  await page.locator('[data-build-plan-from-calcs]').click();
  await expect(page.locator('.v3-plan-overview .mini-line')).toHaveCount(2);
  await expect(page.locator('.plan-post-summary')).toContainText('7');
  await expect(page.locator('[data-build-plan-from-calcs]')).toHaveCount(0);
  const saved=await rows(page);
  const plan=saved[0].configuration.sitePlan;
  expect(plan.lines).toHaveLength(2);
  expect(plan.lines[0].items.map(x=>x.type)).toEqual(['post','gate','post','wicket','post']);
  expect(plan.lines[0].items.find(x=>x.type==='gate').width).toBe(3.4);
  expect(plan.lines[0].items.find(x=>x.type==='wicket').width).toBe(1);
  expect(plan.lines[1].items.filter(x=>x.type==='fence')).toHaveLength(3);
  expect(plan.lines[1].items.filter(x=>x.type==='fence').reduce((sum,x)=>sum+x.width,0)).toBeCloseTo(6);
  expect(saved[0].configuration.calculations.map(x=>x.total)).toEqual([73800,35000]);

  await page.locator('[data-edit-plan]').click();
  await expect(page.locator('#planDialog')).toBeVisible();
  await page.locator('#planItems .plan-item-row').first().click();
  await page.locator('#planEditorFields [data-plan-field="state"]').selectOption('existing');
  await page.locator('#savePlanBtn').click();
  await expect(page.locator('#planDialog')).not.toBeVisible();
  await page.locator('[data-v3-preview]').click();
  await expect(page.locator('#customerPreviewContent .v3-customer-plan')).toBeVisible();
  await expect(page.locator('#customerPreviewContent')).not.toContainText('Себестоимость');
  await page.locator('#closeCustomerPreviewBtn').click();
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();

  await changeSurvey(page,'resize');
  await reopen(page);
  await expect(page.locator('.plan-quote-warnings')).toContainText('отличается от сохранённого расчёта');
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('[data-refresh-plan-sizes]').click();
  await expect(page.locator('[data-refresh-plan-sizes]')).toHaveCount(0);
  const updated=(await rows(page))[0];
  expect(updated.configuration.sitePlan.lines[0].items[0].state).toBe('existing');
  expect(updated.configuration.sitePlan.lines[0].items.find(x=>x.type==='gate').width).toBe(3.6);
  expect(updated.configuration.sitePlan.lines[1].items.filter(x=>x.type==='fence').reduce((sum,x)=>sum+x.width,0)).toBeCloseTo(7);
  expect(updated.configuration.calculations.map(x=>x.total)).toEqual([73800,35000]);
});

test('a fence section with openings cannot silently create wrong or duplicated gates',async({page})=>{
  await startSurvey(page);
  await changeSurvey(page,'openings-only');
  await reopen(page);
  await expect(page.locator('.plan-quote-warnings')).toContainText('есть проёмы');
  await expect(page.locator('[data-build-plan-from-calcs]')).toHaveCount(0);
  await expect(page.locator('[data-edit-plan]')).toContainText('Нарисовать вручную');
  expect((await rows(page))[0].configuration.sitePlan).toBeUndefined();
});
