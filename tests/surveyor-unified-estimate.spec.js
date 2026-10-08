import {test,expect} from '@playwright/test';
test.use({viewport:{width:390,height:844}});

async function startEstimate(page) {
  await page.addInitScript(()=>localStorage.setItem('kuzdvor-dev-access-v1','1'));
  await page.goto('/kuznechny-dvorik-gates/dev-tools-v4/');
  await page.locator('#loginInput').fill('zamer');
  await page.locator('#passwordInput').fill('1234');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#mainView')).toBeVisible();
  await page.locator('#newSurveyBtn').click();
  await page.locator('#saveSurveyBtn').click();
  await expect(page.locator('#surveyDetailsDialog')).toBeVisible();
  await page.evaluate(async()=>{
    const db=await new Promise((ok,err)=>{
      const r=indexedDB.open('kd-surveyor-stage1');
      r.onsuccess=()=>ok(r.result);r.onerror=()=>err(r.error);
    });
    const row=await new Promise((ok,err)=>{
      const r=db.transaction('surveys').objectStore('surveys').getAll();
      r.onsuccess=()=>ok(r.result[0]);r.onerror=()=>err(r.error);
    });
    row.configuration={
      ...row.configuration,
      calculations:[
        {id:'calc_gate1',type:'gates',title:'Ворота с калиткой · Арт.6',
         total:73800,payload:{article:'Арт.6',width:3.4,height:1.8,wicketWidth:1,wicketHeight:1.8,posts:true,deliveryPending:false}},
        {id:'calc_gate2',type:'gates',title:'Ворота с калиткой · Арт.8',
         total:76000,payload:{article:'Арт.8',posts:true,deliveryPending:false}},
        {id:'calc_fence',type:'fence',title:'Забор из евроштакетника',
         total:30000,payload:{configuration:{fenceType:'vertical-double',
            fenceTypeLabel:'Вертикальный двусторонний',sections:[{length:10,height:1.8}],
            summary:{totalLength:10,totalSpans:4,deliveryCost:2000}},deliveryPending:false}},
        {id:'calc_canopy',type:'canopy',title:'Арочный навес',total:40000,
         payload:{configuration:{canopy:{input:{farmType:'Арочный',widthPostsM:3,lengthM:5,
           coverage:'Поликарбонат',postsNeeded:true,delivery:1000}}},deliveryPending:false}}
      ]
    };
    await new Promise((ok,err)=>{
      const t=db.transaction('surveys','readwrite'),r=t.objectStore('surveys').put(row);
      t.oncomplete=ok;t.onerror=()=>err(t.error);
    });db.close();
  });
  await page.locator('#closeDetailsBtn').click();
  await page.locator('.survey-card').first().click();
  await expect(page.locator('.calculation-card')).toHaveCount(4);
}

test('unified estimate: one variant per category, single known delivery and manual common posts',async({page})=>{
  await startEstimate(page);
  await expect(page.locator('[data-estimate-choice="calc_gate1"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('[data-estimate-choice="calc_gate2"]')).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('[data-estimate-choice="calc_fence"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('[data-estimate-choice="calc_canopy"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.estimate-summary')).toContainText('Повторная доставка');
  await expect(page.locator('.estimate-grand-total')).toContainText(/142\s*800/);
  await expect(page.locator('.estimate-warnings')).toContainText('столбы');
  await page.locator('#estimateAdjustment').fill('5000');
  await page.locator('#estimateAdjustment').dispatchEvent('change');
  await expect(page.locator('.estimate-grand-total')).toContainText(/137\s*800/);
  await page.locator('[data-v3-preview]').click();
  await expect(page.locator('#customerPreviewDialog')).toBeVisible();
  await expect(page.locator('#customerPreviewContent')).toContainText(/137\s*800/);
  await expect(page.locator('#customerPreviewContent')).toContainText('Другие рассмотренные варианты');
  await expect(page.locator('#customerPreviewContent')).not.toContainText('Себестоимость');
  await expect(page.locator('#customerPreviewContent')).not.toContainText('Прибыль');
  await page.locator('#closeCustomerPreviewBtn').click();
  await expect(page.locator('[data-estimate-choice="calc_gate1"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('[data-estimate-choice="calc_gate1"]').click();
  await expect(page.locator('.estimate-grand-total')).toContainText(/64\s*000/);
  await expect(page.locator('.estimate-warnings')).toHaveCount(0);
  await page.reload();
  await page.locator('.survey-card').first().click();
  await expect(page.locator('[data-estimate-choice="calc_gate1"]')).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('#estimateAdjustment')).toHaveValue('5000');
  await expect(page.locator('.estimate-grand-total')).toContainText(/64\s*000/);
});

test('unified estimate: no selected items cannot be passed as one order',async({page})=>{
  await startEstimate(page);
  for(const id of ['calc_gate1','calc_fence','calc_canopy']) {
    await page.locator('[data-estimate-choice="'+id+'"]').click();
  }
  await expect(page.locator('.estimate-summary')).toContainText('Отметьте хотя бы одно изделие');
  await expect(page.locator('[data-v3-preview]')).toHaveCount(0);
  await expect(page.locator('.calculation-card')).toHaveCount(4);
  await page.reload();
  await page.locator('.survey-card').first().click();
  await expect(page.locator('[data-v3-preview]')).toHaveCount(0);
});
