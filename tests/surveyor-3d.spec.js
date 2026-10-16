import {test, expect} from '@playwright/test';

test.use({viewport:{width:390,height:844}});

test('3D расчёт opens independently in DEV and edits geometry without changing surveys', async ({page}) => {
  const diagnosticErrors=[];
  page.on('pageerror',error=>diagnosticErrors.push('page: '+error.message));
  page.on('console',message=>{if(message.type()==='error')diagnosticErrors.push('console: '+message.text());});
  await page.goto('/kuznechny-dvorik-gates/zamer-app-v2/');
  await page.locator('#loginInput').fill('zamer');
  await page.locator('#passwordInput').fill('1234');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#mainView')).toBeVisible({timeout:10000});

  await expect(page.locator('#open3DCalcBtn')).toContainText('3D расчёт');
  await page.locator('#open3DCalcBtn').click();
  await expect(page.locator('#threeDScreen')).toBeVisible();
  let hasReal3D=false;
  try {
  await expect(page.locator('#kd3dRoot [data-stats]')).toContainText('Пролётов',{timeout:12000});
  hasReal3D=(await page.locator('#kd3dRoot .kd3d-scene canvas').count())>0;
  if(hasReal3D){
    // The diagnostics are taken from rendered Three.js materials and instanced meshes,
    // not the form controls or localStorage model.
    await expect(page.locator('#kd3dRoot')).toHaveAttribute('data-scene-revision',/^\d+$/);
    await expect(page.locator('#kd3dRoot')).toHaveAttribute('data-scene-fill-colors',/#[0-9a-f]{6}/);
  }
  } catch(error) {
    const host=await page.locator('#kd3dRoot').innerText().catch(()=>'<missing>');
    const loaded=await page.evaluate(()=>performance.getEntriesByType('resource')
      .filter(r=>/3d-calculator|3d-layout|three\.module|OrbitControls/.test(r.name))
      .map(r=>({url:r.name,bytes:r.transferSize,duration:r.duration})));
    throw new Error('3D module did not mount. host='+JSON.stringify(host)+
      ' errors='+JSON.stringify(diagnosticErrors)+' resources='+JSON.stringify(loaded)+
      ' assertion='+String(error.message).slice(0,450));
  }
  await expect(page.locator('#screenTitle')).toHaveText('3D расчёт');
  // The mobile editor follows the clean reference: accordions and stacked sides.
  await expect(page.locator('#kd3dRoot [data-section="sizes"]')).toHaveAttribute('open','');
  await expect(page.locator('#kd3dRoot .kd3d-side-entry')).toHaveCount(4);
  await expect(page.locator('#kd3dRoot [data-preset]')).toHaveCount(4);
  await expect(page.locator('#kd3dRoot [data-active-side-count]')).toHaveText('1 из 4');
  await expect(page.locator('#kd3dRoot [data-current-side-label]')).toHaveText('Настройка стороны А');
  const sideUi=await page.locator('#kd3dRoot .kd3d-sides').evaluate(el=>{
    const grid=getComputedStyle(el),entry=getComputedStyle(el.querySelector('.kd3d-side-entry'));
    return {grid:grid.display,columns:grid.gridTemplateColumns.split(' ').length,
      entry:entry.display,padding:parseFloat(entry.paddingTop)};
  });
  expect(sideUi.grid).toBe('grid');
  expect(sideUi.columns).toBe(1);
  expect(sideUi.entry).toBe('grid');
  expect(sideUi.padding).toBeGreaterThanOrEqual(10);
  // Standard 120 mm metal pickets are NEVER cut: warn first, then fit by reducing spacing.
  const gapAlert=page.locator('#kd3dRoot [data-gap-alert]');
  await expect(gapAlert).toBeVisible();
  await expect(gapAlert).toContainText('Штакетник 120 мм не подрезаем');
  await page.locator('#kd3dRoot [data-auto-gap]').click();
  await expect(gapAlert).toContainText('Без подрезки');
  await expect(page.locator('#kd3dRoot [data-parts]')).toContainText('подогнан без подрезки');
  const afterGapFit=await page.evaluate(()=>JSON.parse(localStorage.getItem('kd-surveyor-3d-draft-v1')));
  expect(afterGapFit.gapFit).toBe(true);
  if(hasReal3D){
    const clearance=Number(await page.locator('#kd3dRoot').getAttribute('data-scene-edge-clearance'));
    expect(clearance).toBeLessThan(0.000001);
  }

  await page.locator('#kd3dRoot [data-side-length-input="A"]').fill('10');
  await page.locator('#kd3dRoot [data-side-length-input="A"]').press('Tab');
  await expect(page.locator('#kd3dRoot [data-parts]')).toContainText('10,0 м');
  await page.locator('#kd3dRoot [data-section="type"]>summary').click();
  const postSize=page.locator('#kd3dRoot [data-field="postSize"]');
  await expect(postSize).toHaveValue('80');
  await postSize.selectOption('100');
  await expect(page.locator('#kd3dRoot [data-parts]')).toContainText('100×100 мм');
  const postVisible=page.locator('#kd3dRoot [data-post-mode="visible"]');
  const postRear=page.locator('#kd3dRoot [data-post-mode="behind"]');
  await expect(postVisible).toHaveAttribute('aria-pressed','true');
  await postRear.click();
  await expect(postRear).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#kd3dRoot [data-parts]')).toContainText('столбы сзади');
  if(hasReal3D) {
    await expect(page.locator('#kd3dRoot')).toHaveAttribute('data-scene-post-modes',/behind/);
    const clearance=Number(await page.locator('#kd3dRoot').getAttribute('data-scene-edge-clearance'));
    expect(clearance).toBeLessThan(0.000001);
  }
  const type = page.locator('#kd3dRoot [data-field="fill"]');
  await type.selectOption('sheet');
  await expect(page.locator('#kd3dRoot [data-picket-settings]')).toBeHidden();
  await expect(page.locator('#kd3dRoot [data-parts]')).toContainText('Профнастил С10');
  await type.selectOption('picket-double');
  await expect(page.locator('#kd3dRoot [data-picket-settings]')).toBeVisible();
  await page.locator('#kd3dRoot [data-field="gap"]').fill('6');
  await page.locator('#kd3dRoot [data-field="gap"]').press('Tab');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('kd-surveyor-3d-draft-v1')).gapFit)).toBe(false);
  await expect(page.locator('#kd3dRoot [data-gap-alert]')).toContainText('не подрезаем');
  await expect(page.locator('#kd3dRoot [data-parts]')).toContainText('6,0 см');
  await postRear.click();
  await expect(postRear).toHaveAttribute('aria-pressed','true');
  await type.selectOption('horizontal');
  await expect(postVisible).toHaveAttribute('aria-pressed','true');
  await expect(postRear).toBeDisabled();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('kd-surveyor-3d-draft-v1')).sides.A.postMode)).toBe('visible');
  if(hasReal3D) await expect(page.locator('#kd3dRoot')).toHaveAttribute('data-scene-post-modes',/visible/);
  await expect(page.locator('#kd3dRoot [data-parts]')).toContainText('горизонтальный');
  await type.selectOption('horizontal-double');
  await expect(page.locator('#kd3dRoot [data-parts]')).toContainText('горизонтальный, шахматка');
  await expect(page.locator('#kd3dRoot [data-picket-settings]')).toBeVisible();
  // A click on the swatch must recolor every side by default, not only the editor row.
  await expect(page.locator('#kd3dRoot [data-color-scope="all"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('#kd3dRoot [data-ral-swatch="8017"]').click();
  const allPainted=await page.evaluate(()=>JSON.parse(localStorage.getItem('kd-surveyor-3d-draft-v1')).sides);
  expect(Object.values(allPainted).every(side=>side.ral==='8017')).toBe(true);
  if(hasReal3D)await expect(page.locator('#kd3dRoot')).toHaveAttribute('data-scene-fill-colors','#49312c');
  await expect(page.locator('#kd3dRoot [data-ral-swatch="8017"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#kd3dRoot [data-field="ral"]')).toHaveValue('8017');
  await page.locator('#kd3dRoot [data-field="ral"]').selectOption('9003');
  await expect(page.locator('#kd3dRoot [data-ral-swatch="9003"]')).toHaveAttribute('aria-pressed','true');
  const draft=await page.evaluate(()=>JSON.parse(localStorage.getItem('kd-surveyor-3d-draft-v1')));
  expect(draft.fill).toBe('horizontal-double');
  expect(draft.ral).toBe('9003');
  expect(draft.postSize).toBe(100);
  await page.locator('#kd3dRoot [data-mode="parts"]').click();
  await expect(page.locator('#kd3dRoot [data-parts]')).toBeVisible();
  await page.locator('#kd3dRoot [data-mode="scene"]').click();


  // Each side is editable independently; all four corners share a single physical post.
  await page.locator('#kd3dRoot [data-side-toggle="B"]').click();
  await page.locator('#kd3dRoot [data-side="B"]').click();
  await expect(page.locator('#kd3dRoot [data-active-side-count]')).toHaveText('2 из 4');
  await expect(page.locator('#kd3dRoot [data-current-side-label]')).toHaveText('Настройка стороны Б');
  await expect(page.locator('#kd3dRoot [data-height-label]')).toContainText('Высота стороны Б, м');
  await expect(page.locator('#kd3dRoot [data-side-length-input="B"]')).toHaveValue('10');

  await page.locator('#kd3dRoot [data-side-length-input="B"]').fill('9');
  await page.locator('#kd3dRoot [data-side-length-input="B"]').press('Tab');
  await page.locator('#kd3dRoot [data-field="height"]').fill('2.2');
  await page.locator('#kd3dRoot [data-field="height"]').press('Tab');
  await type.selectOption('sheet');
  await page.locator('#kd3dRoot [data-field="ral"]').selectOption('6005');
  await expect(page.locator('#kd3dRoot [data-parts]')).toContainText('Сторона Б: 9,0 м');
  await page.locator('#kd3dRoot [data-side-toggle="V"]').click();
  await page.locator('#kd3dRoot [data-side="V"]').click();
  await page.locator('#kd3dRoot [data-side-length-input="V"]').fill('10');
  await page.locator('#kd3dRoot [data-side-length-input="V"]').press('Tab');
  await page.locator('#kd3dRoot [data-side-toggle="G"]').click();
  await page.locator('#kd3dRoot [data-side="G"]').click();
  await page.locator('#kd3dRoot [data-side-length-input="G"]').fill('9');
  await page.locator('#kd3dRoot [data-side-length-input="G"]').press('Tab');
  await expect(page.locator('#kd3dRoot [data-site-warning]')).toBeHidden();
  await expect(page.locator('#kd3dRoot [data-stats]')).toContainText('16');
  const sides=await page.evaluate(()=>JSON.parse(localStorage.getItem('kd-surveyor-3d-draft-v1')).sides);
  expect(sides.A.length).toBe(10);
  expect(sides.A.fill).toBe('horizontal-double');
  expect(sides.B.length).toBe(9);
  expect(sides.B.fill).toBe('sheet');
  expect(sides.B.ral).toBe('6005');
  expect(sides.G.length).toBe(9);
  await page.locator('#kd3dRoot [data-side-length-input="G"]').fill('8');
  await page.locator('#kd3dRoot [data-side-length-input="G"]').press('Tab');
  await expect(page.locator('#kd3dRoot [data-site-warning]')).toBeVisible();
  await page.locator('#kd3dRoot [data-side-length-input="G"]').fill('9');
  await page.locator('#kd3dRoot [data-side-length-input="G"]').press('Tab');

  // Presets change real geometry and keep all four sides active.
  await page.locator('#kd3dRoot [data-preset="20x30"]').click();
  const site=await page.evaluate(()=>JSON.parse(localStorage.getItem('kd-surveyor-3d-draft-v1')).sides);
  expect(site.A.length).toBe(20);expect(site.V.length).toBe(20);
  expect(site.B.length).toBe(30);expect(site.G.length).toBe(30);
  expect(Object.values(site).every(side=>side.enabled)).toBe(true);
  await expect(page.locator('#kd3dRoot [data-preset="20x30"]')).toHaveAttribute('aria-pressed','true');
  // Orientation and checkerboard both update the actual 3D fill setting.
  await page.locator('#kd3dRoot [data-section="fill"]>summary').evaluate(el=>el.closest('details').open=true);
  await page.locator('#kd3dRoot [data-orientation="horizontal"]').click();
  await page.locator('#kd3dRoot [data-double-row]').check();
  await expect(page.locator('#kd3dRoot [data-parts]')).toContainText('горизонтальный, шахматка');
  await page.locator('#kd3dRoot [data-gap-slider]').evaluate(el=>{
    el.value='7';
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await expect(page.locator('#kd3dRoot [data-parts]')).toContainText('7,0 см');
  // Slider input alone, before release/change, changes the Three.js plank count.
  await page.locator('#kd3dRoot [data-orientation="vertical"]').click();
  if(hasReal3D){
    const before=Number(await page.locator('#kd3dRoot').getAttribute('data-scene-pickets'));
    const priorRev=Number(await page.locator('#kd3dRoot').getAttribute('data-scene-revision'));
    await page.locator('#kd3dRoot [data-gap-slider]').evaluate(el=>{
      el.value='12'; el.dispatchEvent(new Event('input',{bubbles:true}));
    });
    await expect.poll(async()=>Number(await page.locator('#kd3dRoot').getAttribute('data-scene-revision')))
      .toBeGreaterThan(priorRev);
    const after=Number(await page.locator('#kd3dRoot').getAttribute('data-scene-pickets'));
    expect(after).toBeLessThan(before);
    await page.locator('#kd3dRoot [data-gap-slider]').evaluate(el=>{
      el.value='2'; el.dispatchEvent(new Event('input',{bubbles:true}));
      el.dispatchEvent(new Event('change',{bubbles:true}));
    });
    await expect.poll(async()=>Number(await page.locator('#kd3dRoot').getAttribute('data-scene-pickets')))
      .toBeGreaterThan(after);
  }
  // The single-side color mode must preserve colors on other enabled sides.
  await page.locator('#kd3dRoot [data-color-scope="side"]').click();
  await page.locator('#kd3dRoot [data-ral-swatch="3005"]').click();
  const sideColors=await page.evaluate(()=>JSON.parse(localStorage.getItem('kd-surveyor-3d-draft-v1')).sides);
  expect(sideColors.A.ral).toBe('3005');
  expect(sideColors.B.ral).not.toBe('3005');
  if(hasReal3D){
    await expect(page.locator('#kd3dRoot')).toHaveAttribute('data-scene-fill-colors',/#[0-9a-f]{6},#[0-9a-f]{6}/);
  }

  await page.locator('#kd3dRoot [data-collapse-params]').click();
  await expect(page.locator('#kd3dRoot [data-editor-content]')).toBeHidden();
  await page.locator('#kd3dRoot [data-collapse-params]').click();
  await expect(page.locator('#kd3dRoot [data-editor-content]')).toBeVisible();

  await page.locator('#close3DCalcBtn').click();
  await expect(page.locator('#surveysScreen')).toBeVisible();
  await expect(page.locator('#screenTitle')).toHaveText('Замеры');
});
