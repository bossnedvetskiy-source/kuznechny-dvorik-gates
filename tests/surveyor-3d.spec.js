import {test, expect} from '@playwright/test';

test.use({viewport:{width:390,height:844}});

test('3D расчёт opens independently in DEV and edits geometry without changing surveys', async ({page}) => {
  test.setTimeout(120000);
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
  // Optional dimensions must report clear widths between POST FACES.
  const showDimensions=page.locator('#kd3dRoot [data-show-dimensions]');
  await expect(showDimensions).not.toBeChecked();
  await showDimensions.check();
  if(hasReal3D)await expect(page.locator('#kd3dRoot')).toHaveAttribute('data-scene-dimension-count',/^[1-9]/);
  await expect(showDimensions).toBeChecked();
  await expect(page.locator('#kd3dRoot [data-parts]')).toContainText('Размеры в свету');
  await expect(page.locator('#kd3dRoot [data-parts]')).toContainText('Пролёт 1: 2320 мм');
  if(hasReal3D){
    await expect(page.locator('#kd3dRoot')).toHaveAttribute('data-scene-dimension-count','5');
    await expect(page.locator('#kd3dRoot')).toHaveAttribute('data-scene-dimension-values',/A:span:2320/);
  }
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('kd-surveyor-3d-draft-v1')).showDimensions)).toBe(true);
  await showDimensions.uncheck();
  if(hasReal3D)await expect(page.locator('#kd3dRoot')).toHaveAttribute('data-scene-dimension-count','0');
  // Advanced fence controls stay directly beneath the selected side and are
  // collapsed initially so each product card is reachable without scrolling.
  await page.locator('#kd3dRoot .kd3d-extra-toggle').click();
  // Standard 120 mm metal pickets are NEVER cut: warn first, then fit by reducing spacing.
  const gapAlert=page.locator('#kd3dRoot [data-gap-alert]');
  await expect(gapAlert).toBeVisible();
  await expect(gapAlert).toContainText('Штакетник 120 мм не подрезаем');
  await expect(gapAlert).toContainText('3D уже показывает целые планки вплотную к столбам');
  // Regression: BEFORE clicking auto-fit, the drawn 3D model already touches
  // both post faces. A UI notice alone must not leave the original visual gap.
  if(hasReal3D){
    await expect.poll(async()=>Number(await page.locator('#kd3dRoot')
      .getAttribute('data-scene-edge-clearance'))).toBeLessThan(0.000001);
    expect(await page.locator('#kd3dRoot').getAttribute('data-scene-actual-gaps')).toContain('A:');
  }
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
  await expect(page.locator('#kd3dRoot [data-parts]')).toContainText('фактический зазор 5,0 см');
  // Requested gap remains 6 cm, actual geometry is fitted to 5 cm.
  if(hasReal3D){
    expect(Number(await page.locator('#kd3dRoot').getAttribute('data-scene-requested-gap'))).toBeCloseTo(.06);
    await expect.poll(async()=>Number(await page.locator('#kd3dRoot')
      .getAttribute('data-scene-edge-clearance'))).toBeLessThan(0.000001);
  }
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

  // New compact pictograms work independently on A/B/V/G, like reference calculator.
  await expect(page.locator('#kd3dRoot [data-opening-kind="gate"]')).toHaveCount(4);
  await expect(page.locator('#kd3dRoot [data-opening-kind="wicket"]')).toHaveCount(4);
  await page.locator('#kd3dRoot [data-side="A"]').click();
  // A-side swing opening is a real hole in the fence with 2 separate gate leaves.
  await expect(page.locator('#kd3dRoot [data-side-products="A"] [data-gate-enabled]')).not.toBeChecked();
  await page.locator('#kd3dRoot [data-opening-side="A"][data-opening-kind="gate"]').click();
  await expect(page.locator('#kd3dRoot [data-side-products="A"] [data-gate-fields]')).toBeVisible();
  await page.locator('#kd3dRoot [data-side-products="A"] [data-gate-width]').fill('4');
  await page.locator('#kd3dRoot [data-side-products="A"] [data-gate-width]').press('Tab');
  await page.locator('#kd3dRoot [data-side-products="A"] [data-gate-offset]').fill('2');
  await page.locator('#kd3dRoot [data-side-products="A"] [data-gate-offset]').press('Tab');
  await expect(page.locator('#kd3dRoot [data-parts]')).toContainText('Распашные ворота на стороне А');
  await expect(page.locator('#kd3dRoot [data-parts]')).toContainText('отступ слева 2,0 м');
  const withGate=await page.evaluate(()=>JSON.parse(localStorage.getItem('kd-surveyor-3d-draft-v1')).gate);
  expect(withGate.enabled).toBe(true);
  expect(withGate.width).toBe(4);
  expect(withGate.offset).toBe(2);
  await expect(page.locator('#kd3dRoot [data-side-products="A"] [data-gate-open-direction]')).toHaveValue('inward');
  await page.locator('#kd3dRoot [data-side-products="A"] [data-gate-open-direction]').selectOption('outward');
  await expect(page.locator('#kd3dRoot [data-parts]')).toContainText('открывание наружу участка');
  const rotatedGate=await page.evaluate(()=>
    JSON.parse(localStorage.getItem('kd-surveyor-3d-draft-v1')).openings.A.gate);
  expect(rotatedGate.openDirection).toBe('outward');
  await expect(page.locator('#kd3dRoot [data-side-products="A"] [data-gate-swing-state="closed"]')).toHaveAttribute('aria-pressed','true');
  if(hasReal3D)await expect(page.locator('#kd3dRoot'))
    .toHaveAttribute('data-scene-swing-angles',/A:gate:left:0\.000;A:gate:right:0\.000/);
  await page.locator('#kd3dRoot [data-side-products="A"] [data-gate-swing-state="open"]').click();
  if(hasReal3D)await expect(page.locator('#kd3dRoot'))
    .toHaveAttribute('data-scene-swing-angles',/A:gate:left:1\.571;A:gate:right:-1\.571/);
  await showDimensions.check();
  await expect(page.locator('#kd3dRoot [data-parts]')).toContainText('Ворота: 3900 мм');
  if(hasReal3D){
    await expect(page.locator('#kd3dRoot')).toHaveAttribute('data-scene-dimension-values',/A:gate:3900/);
  }
  if(hasReal3D){
    await expect(page.locator('#kd3dRoot')).toHaveAttribute('data-scene-hinges','4');
    await expect(page.locator('#kd3dRoot')).toHaveAttribute('data-scene-braces','2');
    await expect(page.locator('#kd3dRoot')).toHaveAttribute('data-scene-leaf-widths','1925,1925');
    await expect(page.locator('#kd3dRoot')).toHaveAttribute('data-scene-gate-leaves','2');
    await expect(page.locator('#kd3dRoot')).toHaveAttribute('data-scene-gate-opening',/"start":2/);
  }
  await page.locator('#kd3dRoot [data-side-products="A"] [data-gate-enabled]').uncheck();
  if(hasReal3D)await expect(page.locator('#kd3dRoot')).toHaveAttribute('data-scene-gate-leaves','0');
  await expect(page.locator('#kd3dRoot [data-parts]')).not.toContainText('Распашные ворота на стороне А:');

  // Independent gate + wicket on side B without affecting side A.
  await page.locator('#kd3dRoot [data-opening-side="B"][data-opening-kind="gate"]').click();
  await expect(page.locator('#kd3dRoot [data-opening-side="B"][data-opening-kind="gate"]'))
    .toHaveAttribute('aria-pressed','true');
  await page.locator('#kd3dRoot [data-opening-side="B"][data-opening-kind="wicket"]').click();
  await expect(page.locator('#kd3dRoot [data-side-products="B"] [data-wicket-fields]')).toBeVisible();
  await page.locator('#kd3dRoot [data-side-products="B"] [data-wicket-offset]').fill('6');
  await page.locator('#kd3dRoot [data-side-products="B"] [data-wicket-offset]').press('Tab');
  await expect(page.locator('#kd3dRoot [data-parts]')).toContainText('Распашные ворота на стороне Б');
  await expect(page.locator('#kd3dRoot [data-parts]')).toContainText('Калитка на стороне Б');
  await expect(page.locator('#kd3dRoot [data-parts]')).toContainText('Калитка: 900 мм');
  const savedOpenings=await page.evaluate(()=>
    JSON.parse(localStorage.getItem('kd-surveyor-3d-draft-v1')).openings);
  expect(savedOpenings.B.gate.enabled).toBe(true);
  expect(savedOpenings.B.wicket.enabled).toBe(true);
  await page.locator('#kd3dRoot [data-side-products="B"] [data-wicket-open-direction]').selectOption('outward');
  await page.locator('#kd3dRoot [data-side-products="B"] [data-wicket-hinge-side]').selectOption('right');
  await expect(page.locator('#kd3dRoot [data-parts]'))
    .toContainText('открывание наружу участка · вправо, петли справа');
  const directedWicket=await page.evaluate(()=>
    JSON.parse(localStorage.getItem('kd-surveyor-3d-draft-v1')).openings.B.wicket);
  expect(directedWicket.openDirection).toBe('outward');
  expect(directedWicket.hingeSide).toBe('right');
  if(hasReal3D)await expect(page.locator('#kd3dRoot'))
    .toHaveAttribute('data-scene-swing-angles',/B:wicket:right:0\.000/);
  await page.locator('#kd3dRoot [data-side-products="B"] [data-wicket-swing-state="open"]').click();
  if(hasReal3D)await expect(page.locator('#kd3dRoot'))
    .toHaveAttribute('data-scene-swing-angles',/B:wicket:right:-1\.571/);
  expect(savedOpenings.A.gate.enabled).toBe(false);
  if(hasReal3D){
    await expect(page.locator('#kd3dRoot')).toHaveAttribute('data-scene-gate-leaves','2');
    await expect(page.locator('#kd3dRoot')).toHaveAttribute('data-scene-wicket-leaves','1');
    await expect(page.locator('#kd3dRoot')).toHaveAttribute('data-scene-hinges','6');
    await expect(page.locator('#kd3dRoot')).toHaveAttribute('data-scene-braces','3');
    await expect(page.locator('#kd3dRoot')).toHaveAttribute('data-scene-openings',/B:gate:/);
    await expect(page.locator('#kd3dRoot')).toHaveAttribute('data-scene-dimension-values',/B:wicket:900/);
  }
  // A wicket alone on another side, with no automatic second gate.
  await page.locator('#kd3dRoot [data-opening-side="G"][data-opening-kind="wicket"]').click();
  const finalOpenings=await page.evaluate(()=>
    JSON.parse(localStorage.getItem('kd-surveyor-3d-draft-v1')).openings);
  expect(finalOpenings.G.wicket.enabled).toBe(true);
  expect(finalOpenings.G.gate.enabled).toBe(false);
  expect(finalOpenings.B.wicket.enabled).toBe(true);
  if(hasReal3D) await expect(page.locator('#kd3dRoot'))
    .toHaveAttribute('data-scene-wicket-leaves','2');
  if(hasReal3D) await expect(page.locator('#kd3dRoot'))
    .toHaveAttribute('data-scene-hinges','8');

  await page.locator('#kd3dRoot [data-collapse-params]').click();
  await expect(page.locator('#kd3dRoot [data-editor-content]')).toBeHidden();
  await page.locator('#kd3dRoot [data-collapse-params]').click();
  await expect(page.locator('#kd3dRoot [data-editor-content]')).toBeVisible();

  await page.locator('#close3DCalcBtn').click();
  await expect(page.locator('#surveysScreen')).toBeVisible();
  await expect(page.locator('#screenTitle')).toHaveText('Замеры');
});

test('Встроенная калитка внутри распашных ворот — обе створки, порог и сохранение', async ({page})=>{
  test.setTimeout(65000);
  await page.goto('/kuznechny-dvorik-gates/zamer-app-v2/');
  await page.locator('#loginInput').fill('zamer');
  await page.locator('#passwordInput').fill('1234');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#mainView')).toBeVisible({timeout:10000});
  await page.locator('#open3DCalcBtn').click();
  const root=page.locator('#kd3dRoot');
  await expect(root.locator('[data-stats]')).toContainText('Столбов',{timeout:15000});
  const has3D=(await root.locator('.kd3d-scene canvas').count())>0;
  const beforePosts=await root.locator('[data-stats]').innerText();
  await root.locator('[data-opening-side="A"][data-opening-kind="gate"]').click();
  await expect(root.locator('[data-side-products="A"] [data-builtin-area]')).toBeVisible();
  const postsWithGate=await root.locator('[data-stats]').innerText();
  await root.locator('[data-side-products="A"] [data-builtin-enabled]').check();
  await expect(root.locator('[data-side-products="A"] [data-builtin-fields]')).toBeVisible();
  await expect(root.locator('[data-parts]')).toContainText('встроенная калитка 1,0 м');
  expect(await root.locator('[data-stats]').innerText()).toBe(postsWithGate);
  if(has3D){
    await expect(root).toHaveAttribute('data-scene-embedded-wickets','1');
    await expect(root).toHaveAttribute('data-scene-thresholds','1');
    await expect(root).toHaveAttribute('data-scene-hinges','6');
    await expect(root).toHaveAttribute('data-scene-gate-leaves','2');
    await expect(root).toHaveAttribute('data-scene-wicket-leaves','0');
  }
  await root.locator('[data-side-products="A"] [data-builtin-side]').selectOption('left');
  await expect(root.locator('[data-parts]')).toContainText('в левой створке');
  await root.locator('[data-side-products="A"] [data-builtin-width]').fill('0.9');
  await root.locator('[data-side-products="A"] [data-builtin-width]').press('Tab');
  const data=await page.evaluate(()=>JSON.parse(localStorage.getItem('kd-surveyor-3d-draft-v1')).openings.A.gate);
  expect(data.builtInSide).toBe('left');
  expect(data.builtInWidth).toBe(.9);
  expect(data.builtInWicket).toBe(true);
  await root.locator('[data-side-products="A"] [data-gate-width]').fill('2');
  await root.locator('[data-side-products="A"] [data-gate-width]').press('Tab');
  await expect(root.locator('[data-side-products="A"] [data-builtin-warning]')).toBeVisible();
  if(has3D)await expect(root).toHaveAttribute('data-scene-embedded-wickets','0');
  await root.locator('[data-side-products="A"] [data-gate-width]').fill('3.4');
  await root.locator('[data-side-products="A"] [data-gate-width]').press('Tab');
  await expect(root.locator('[data-side-products="A"] [data-builtin-warning]')).toBeHidden();
  if(has3D)await expect(root).toHaveAttribute('data-scene-embedded-wickets','1');
  await root.locator('[data-side-products="A"] [data-builtin-enabled]').uncheck();
  if(has3D)await expect(root).toHaveAttribute('data-scene-embedded-wickets','0');
  expect(await root.locator('[data-stats]').innerText()).toBe(postsWithGate);
});


test('Редактор и эскизы находятся ВНУТРИ каждой стороны, параметры изделий независимы',async ({page})=>{
  test.setTimeout(85000);
  await page.goto('/kuznechny-dvorik-gates/zamer-app-v2/');
  await page.locator('#loginInput').fill('zamer');
  await page.locator('#passwordInput').fill('1234');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#mainView')).toBeVisible({timeout:10000});
  await page.locator('#open3DCalcBtn').click();
  const root=page.locator('#kd3dRoot');
  await expect(root.locator('[data-stats]')).toContainText('Столбов',{timeout:12000});
  // Every side has permanent product cards. Only advanced fence controls follow selection.
  await expect(root.locator('[data-side-edit-slot="A"] .kd3d-side-inline-editor')).toHaveCount(1);
  await expect(root.locator('[data-side-edit-slot="B"] .kd3d-side-inline-editor')).toHaveCount(0);
  await expect(root.locator('[data-side-products]')).toHaveCount(4);
  for(const id of ['A','B','V','G']){
    await expect(root.locator('[data-side-products="'+id+'"] .kd3d-product-gate')).toHaveCount(1);
    await expect(root.locator('[data-side-products="'+id+'"] .kd3d-product-wicket')).toHaveCount(1);
    await expect(root.locator('[data-side-quick-fill="'+id+'"]')).toHaveCount(1);
  }
  await expect(root.locator('[data-side-entry="A"] [data-gate-editor]')).toHaveCount(1);
  await expect(root.locator('[data-side-entry="A"] [data-section="fill"]')).toHaveCount(1);
  await expect(root.locator('[data-side-entry="A"] [data-section="type"]')).toHaveCount(1);
  await root.locator('[data-opening-side="A"][data-opening-kind="gate"]').click();
  await expect(root.locator('[data-side-products="A"] [data-gate-fields]')).toBeVisible();
  await root.locator('[data-side-products="A"] [data-gate-frame-profile]').selectOption('60x40');
  await root.locator('[data-side-products="A"] [data-gate-fill]').selectOption('sheet');
  await root.locator('[data-side-products="A"] [data-gate-inner-frame]').uncheck();
  await expect(root.locator('[data-parts]')).toContainText('рама 60×40');
  await expect(root.locator('[data-parts]')).toContainText('обшивка Профнастил');
  const a=await page.evaluate(()=>JSON.parse(localStorage.getItem('kd-surveyor-3d-draft-v1')).openings.A.gate);
  expect(a.frameProfile).toBe('60x40');
  expect(a.fill).toBe('sheet');
  expect(a.innerFrame).toBe(false);
  await root.locator('[data-side-products="A"] [data-drawing-kind="gate"]').click();
  await expect(root.locator('[data-drawing-dialog]')).toBeVisible();
  await expect(root.locator('[data-drawing-preview] svg')).toHaveCount(1);
  await expect(root.locator('[data-drawing-preview]')).toContainText('РАСПАШНЫЕ ВОРОТА');
  const downloadPromise=page.waitForEvent('download');
  await root.locator('[data-drawing-download]').click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe('KD-vorota-A.svg');
  await root.locator('[data-drawing-close]').click();
  // Side B has its OWN data even when A remains enabled.
  await root.locator('[data-side-toggle="B"]').check();
  await root.locator('[data-side="B"]').click();
  await root.locator('[data-side-quick-fill="B"]').selectOption('sheet');
  await root.locator('[data-side-quick-height="B"]').fill('2.4');
  await root.locator('[data-side-quick-height="B"]').press('Tab');
  const sideBDraft=await page.evaluate(()=>
    JSON.parse(localStorage.getItem('kd-surveyor-3d-draft-v1')).sides.B);
  expect(sideBDraft.fill).toBe('sheet');
  expect(sideBDraft.height).toBe(2.4);
  await expect(root.locator('[data-side-edit-slot="B"] .kd3d-side-inline-editor')).toHaveCount(1);
  await expect(root.locator('[data-side-edit-slot="A"] .kd3d-side-inline-editor')).toHaveCount(0);
  await expect(root.locator('[data-side-products="B"] [data-gate-enabled]')).not.toBeChecked();
  await root.locator('[data-opening-side="B"][data-opening-kind="wicket"]').click();
  await root.locator('[data-side-products="B"] [data-wicket-frame-profile]').selectOption('40x40');
  await root.locator('[data-side-products="B"] [data-wicket-fill]').selectOption('picket-double');
  await root.locator('[data-side-products="B"] [data-wicket-hinge-side]').selectOption('right');
  await root.locator('[data-side-products="B"] [data-drawing-kind="wicket"]').click();
  await expect(root.locator('[data-drawing-preview]')).toContainText('КАЛИТКА');
  await expect(root.locator('[data-drawing-preview]')).toContainText('Петли: справа');
  await root.locator('[data-drawing-close]').click();
  await root.locator('[data-side="A"]').click();
  await expect(root.locator('[data-side-products="A"] [data-gate-enabled]')).toBeChecked();
  await expect(root.locator('[data-side-products="A"] [data-gate-frame-profile]')).toHaveValue('60x40');
  await expect(root.locator('[data-side-products="A"] [data-gate-fill]')).toHaveValue('sheet');
  await expect(root.locator('[data-side-quick-fill="B"]')).toHaveValue('sheet');
  await expect(root.locator('[data-side-products="B"] [data-wicket-hinge-side]')).toHaveValue('right');
  await expect(root.locator('[data-side-products="A"] [data-wicket-enabled]')).not.toBeChecked();
});


test('Откатные ворота в сторонах А/Б: хвостовик, 3D, чертёж, сохранение без цены',async ({page})=>{
  test.setTimeout(120000);
  await page.goto('/kuznechny-dvorik-gates/zamer-app-v2/');
  await page.locator('#loginInput').fill('zamer');
  await page.locator('#passwordInput').fill('1234');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#mainView')).toBeVisible({timeout:10000});
  await page.locator('#open3DCalcBtn').click();
  const root=page.locator('#kd3dRoot');
  await expect(root.locator('[data-stats]')).toContainText('Столбов',{timeout:15000});
  const has3D=(await root.locator('.kd3d-scene canvas').count())>0;
  const a=root.locator('[data-side-products="A"]');
  const b=root.locator('[data-side-products="B"]');
  await root.locator('[data-opening-side="A"][data-opening-kind="gate"]').click();
  await expect(a.locator('[data-gate-type]')).toBeVisible();
  await a.locator('[data-gate-mode="sliding"]').click();
  await expect(a.locator('[data-gate-mode="sliding"]')).toHaveAttribute('aria-pressed','true');
  await expect(a.locator('[data-gate-sliding-fields]')).toBeVisible();
  await expect(a.locator('[data-gate-swing-direction]')).toBeHidden();
  await expect(a.locator('[data-builtin-area]')).toBeHidden();
  await a.locator('[data-gate-width]').fill('4');
  await a.locator('[data-gate-width]').press('Tab');
  await a.locator('[data-gate-offset]').fill('2');
  await a.locator('[data-gate-offset]').press('Tab');
  await a.locator('[data-gate-slide-direction]').selectOption('right');
  await a.locator('[data-gate-tail-shape]').selectOption('triangle');
  await a.locator('[data-gate-center-post]').check();
  await a.locator('[data-gate-fill]').selectOption('sheet');
  await expect(a.locator('[data-gate-slide-geometry]')).toContainText('Хвостовик 2,00 м');
  await expect(root.locator('[data-parts]')).toContainText('Откатные ворота на стороне А');
  await expect(root.locator('[data-parts]')).toContainText('хвостовик треугольный');
  await expect(root.locator('[data-parts]')).toContainText('со средней стойкой');
  await expect(a.locator('[data-gate-zone-status]')).toContainText('нужно 6,00 м');
  await expect(a.locator('[data-gate-zone-status]')).toContainText('Доступно 6,00 м');
  await expect(root.locator('[data-site-warning]')).toBeHidden();
  await expect(root.locator('[data-slide-legend]')).toBeVisible();
  await expect(a.locator('[data-gate-slide-position="closed"]')).toHaveAttribute('aria-pressed','true');
  await a.locator('[data-gate-slide-position="open"]').click();
  await expect(a.locator('[data-gate-slide-position="open"]')).toHaveAttribute('aria-pressed','true');
  await expect(root.locator('[data-parts]')).toContainText('Положение: открыто');
  if(has3D){
    await expect(root).toHaveAttribute('data-scene-sliding-shifts','4.000');
    await expect(root).toHaveAttribute('data-scene-sliding-zones','A:available');
  }
  await a.locator('[data-gate-slide-position="closed"]').click();
  if(has3D)await expect(root).toHaveAttribute('data-scene-sliding-shifts','0.000');
  await expect(root.locator('[data-scene-slide-controls]')).toBeVisible();
  await expect(root.locator('[data-scene-slide-label]')).toHaveText('Ворота · сторона А');
  await root.locator('[data-scene-slide-position="open"]').click();
  await expect(a.locator('[data-gate-slide-position="open"]')).toHaveAttribute('aria-pressed','true');
  if(has3D)await expect(root).toHaveAttribute('data-scene-sliding-shifts','4.000');
  await root.locator('[data-scene-slide-position="closed"]').click();
  await expect(a.locator('[data-gate-slide-position="closed"]')).toHaveAttribute('aria-pressed','true');
  if(has3D)await expect(root).toHaveAttribute('data-scene-sliding-shifts','0.000');
  if(has3D){
    await expect(root).toHaveAttribute('data-scene-sliding-leaves','1');
    await expect(root).toHaveAttribute('data-scene-sliding-tails','1');
    await expect(root).toHaveAttribute('data-scene-sliding-centers','1');
    await expect(root).toHaveAttribute('data-scene-gate-leaves','0');
  }
  await a.locator('[data-drawing-kind="gate"]').click();
  await expect(root.locator('[data-drawing-dialog]')).toBeVisible();
  await expect(root.locator('[data-drawing-preview]')).toContainText('ОТКАТНЫЕ ВОРОТА');
  await expect(root.locator('[data-drawing-preview]')).toContainText('Хвост 2000 мм');
  const downloadPromise=page.waitForEvent('download');
  await root.locator('[data-drawing-download]').click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe('KD-otkatnye-A.svg');
  await root.locator('[data-drawing-close]').click();

  // B has an independent rectangular counterweight; A's model stays intact.
  await root.locator('[data-opening-side="B"][data-opening-kind="gate"]').click();
  await b.locator('[data-gate-mode="sliding"]').click();
  await expect(root.locator('[data-scene-slide-label]')).toHaveText('Ворота · сторона Б');
  await b.locator('[data-gate-width]').fill('3.4');
  await b.locator('[data-gate-width]').press('Tab');
  await b.locator('[data-gate-offset]').fill('6');
  await b.locator('[data-gate-offset]').press('Tab');
  await b.locator('[data-gate-tail-shape]').selectOption('square');
  await b.locator('[data-gate-slide-direction]').selectOption('left');
  await expect(a.locator('[data-gate-tail-shape]')).toHaveValue('triangle');
  await expect(a.locator('[data-gate-slide-direction]')).toHaveValue('right');
  await expect(b.locator('[data-gate-tail-shape]')).toHaveValue('square');
  await expect(root.locator('[data-parts]')).toContainText('Откатные ворота на стороне Б');
  if(has3D)await expect(root).toHaveAttribute('data-scene-sliding-leaves','2');
  await b.locator('[data-gate-slide-position="open"]').click();
  await expect(b.locator('[data-gate-slide-position="open"]')).toHaveAttribute('aria-pressed','true');
  if(has3D){
    await expect(root).toHaveAttribute('data-scene-sliding-shifts','0.000;-3.400');
    await expect(root).toHaveAttribute('data-scene-sliding-zones','A:available;B:available');
  }
  await expect(a.locator('[data-gate-slide-position="closed"]')).toHaveAttribute('aria-pressed','true');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('kd-surveyor-3d-draft-v1')).openings);
  expect(saved.A.gate).toMatchObject({enabled:true,type:'sliding',width:4,
    offset:2,slideDirection:'right',tailShape:'triangle',centerPost:true,fill:'sheet'});
  expect(saved.B.gate).toMatchObject({enabled:true,type:'sliding',width:3.4,
    offset:6,slideDirection:'left',tailShape:'square',centerPost:false,
    slideOpen:true,showSlideZone:true});
  await a.locator('[data-gate-mode="swing"]').click();
  await expect(a.locator('[data-gate-swing-direction]')).toBeVisible();
  await expect(a.locator('[data-gate-sliding-fields]')).toBeHidden();
  if(has3D)await expect(root).toHaveAttribute('data-scene-sliding-leaves','1');
  await a.locator('[data-gate-mode="sliding"]').click();
  await expect(a.locator('[data-gate-tail-shape]')).toHaveValue('triangle');
  await expect(root.locator('[data-site-warning]')).toBeHidden();

  // Reservation must cover the full opening-plus-tail, not just the tail.
  await a.locator('[data-gate-offset]').fill('3');
  await a.locator('[data-gate-offset]').press('Tab');
  await expect(a.locator('[data-gate-zone-status]')).toContainText('Не хватает 1,00 м');
  await expect(root.locator('[data-site-warning]')).toContainText('Недостаточно места');
  if(has3D)await expect(root).toHaveAttribute('data-scene-sliding-zones',
    /A:available;A:shortage;B:available/);
  await a.locator('[data-gate-offset]').fill('2');
  await a.locator('[data-gate-offset]').press('Tab');
  await expect(root.locator('[data-site-warning]')).toBeHidden();

  // The pocket behind a pedestrian wicket is not automatically considered clear.
  await root.locator('[data-opening-side="A"][data-opening-kind="wicket"]').click();
  await a.locator('[data-wicket-offset]').fill('9');
  await a.locator('[data-wicket-offset]').press('Tab');
  await expect(root.locator('[data-site-warning]')).toContainText('Зона отката пересекает');
  if(has3D)await expect(root).toHaveAttribute('data-scene-sliding-zones',
    /A:wicket/);
  await a.locator('[data-wicket-offset]').fill('0.2');
  await a.locator('[data-wicket-offset]').press('Tab');
  await expect(root.locator('[data-site-warning]')).toBeHidden();

  // Hiding A's zone does not hide B's, nor move A's steel leaf.
  await a.locator('[data-gate-show-slide-zone]').uncheck();
  if(has3D)await expect(root).toHaveAttribute('data-scene-sliding-zones','B:available');
  await expect(root.locator('[data-slide-legend]')).toBeVisible();
  await a.locator('[data-gate-show-slide-zone]').check();
  if(has3D)await expect(root).toHaveAttribute('data-scene-sliding-zones','A:available;B:available');
  await b.locator('[data-gate-slide-position="closed"]').click();
  if(has3D)await expect(root).toHaveAttribute('data-scene-sliding-shifts','0.000;0.000');
  const persisted=await page.evaluate(()=>
    JSON.parse(localStorage.getItem('kd-surveyor-3d-draft-v1')).openings);
  expect(persisted.A.gate.slideOpen).toBe(false);
  expect(persisted.A.gate.showSlideZone).toBe(true);
  expect(persisted.B.gate.slideOpen).toBe(false);
});


test('Откатные ворота: 3D ролики/фундамент/приёмник и проверка препятствий по сторонам',async ({page})=>{
  test.setTimeout(120000);
  await page.goto('/kuznechny-dvorik-gates/zamer-app-v2/');
  await page.locator('#loginInput').fill('zamer');
  await page.locator('#passwordInput').fill('1234');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#mainView')).toBeVisible({timeout:10000});
  await page.locator('#open3DCalcBtn').click();
  const root=page.locator('#kd3dRoot');
  await expect(root.locator('[data-stats]')).toContainText('Столбов',{timeout:15000});
  const has3D=await root.locator('.kd3d-scene canvas').count()>0;
  const a=root.locator('[data-side-products="A"]');
  await root.locator('[data-opening-side="A"][data-opening-kind="gate"]').click();
  await a.locator('[data-gate-mode="sliding"]').click();
  await a.locator('[data-gate-width]').fill('4');
  await a.locator('[data-gate-width]').press('Tab');
  await a.locator('[data-gate-offset]').fill('2');
  await a.locator('[data-gate-offset]').press('Tab');
  await a.locator('[data-gate-slide-direction]').selectOption('right');
  await expect(a.locator('[data-gate-track-offset]')).toHaveValue('22');
  await expect(root.locator('[data-site-warning]')).toBeHidden();
  if(has3D){
    await expect(root).toHaveAttribute('data-scene-sliding-carriages','2');
    await expect(root).toHaveAttribute('data-scene-sliding-rollers','8');
    await expect(root).toHaveAttribute('data-scene-sliding-foundations','1');
    await expect(root).toHaveAttribute('data-scene-sliding-receivers','1');
    await expect(root).toHaveAttribute('data-scene-sliding-upper-guides','1');
  }
  await a.locator('[data-gate-slide-position="open"]').click();
  if(has3D){
    await expect(root).toHaveAttribute('data-scene-sliding-shifts','4.000');
    await expect(root).toHaveAttribute('data-scene-sliding-carriages','2');
  }
  await a.locator('[data-gate-slide-position="closed"]').click();

  // Hardware clearance depends on distance from the fence axis; posts are
  // checked even without any manually entered obstruction.
  await a.locator('[data-gate-track-offset]').fill('10');
  await a.locator('[data-gate-track-offset]').press('Tab');
  await expect(root.locator('[data-site-warning]')).toContainText('столб');
  await expect(a.locator('[data-gate-zone-status]')).toContainText('Возможное столкновение');
  await a.locator('[data-gate-track-offset]').fill('22');
  await a.locator('[data-gate-track-offset]').press('Tab');
  await expect(root.locator('[data-site-warning]')).toBeHidden();

  await a.locator('[data-obstacle-add]').click();
  await expect(a.locator('[data-obstacle-row]')).toHaveCount(1);
  await expect(root.locator('[data-site-warning]')).toContainText('препятствие');
  if(has3D){
    await expect(root).toHaveAttribute('data-scene-sliding-obstacles','1');
    await expect(root).toHaveAttribute('data-scene-sliding-blocked-obstacles','1');
  }
  await a.locator('[data-obstacle-key="type"]').selectOption('tree');
  const distance=a.locator('[data-obstacle-key="distance"]');
  await distance.fill('120');
  await distance.press('Tab');
  await expect(root.locator('[data-site-warning]')).toBeHidden();
  if(has3D)await expect(root).toHaveAttribute('data-scene-sliding-blocked-obstacles','0');
  await distance.fill('22');
  await distance.press('Tab');
  await expect(root.locator('[data-site-warning]')).toContainText('препятствие');
  const saved=await page.evaluate(()=>
    JSON.parse(localStorage.getItem('kd-surveyor-3d-draft-v1')).openings.A.gate);
  expect(saved.trackOffset).toBe(.22);
  expect(saved.obstacles[0]).toMatchObject({
    type:'tree',distance:.22,width:.5,depth:.35,height:1.5
  });
  await a.locator('[data-obstacle-remove="0"]').click();
  await expect(a.locator('[data-obstacle-row]')).toHaveCount(0);
  await expect(root.locator('[data-site-warning]')).toBeHidden();
  if(has3D)await expect(root).toHaveAttribute('data-scene-sliding-obstacles','0');
  // Switching away and back does not lose settings for this side.
  await a.locator('[data-gate-mode="swing"]').click();
  await a.locator('[data-gate-mode="sliding"]').click();
  await expect(a.locator('[data-gate-track-offset]')).toHaveValue('22');
  await expect(root.locator('[data-parts]')).toContainText('проектное согласование');
});


test('DEV mobile product controls use final styled CSS, no native stacked buttons or overflow',async ({page})=>{
  test.setTimeout(120000);
  await page.goto('/kuznechny-dvorik-gates/zamer-app-v2/');
  await page.locator('#loginInput').fill('zamer');
  await page.locator('#passwordInput').fill('1234');
  await page.locator('#loginForm button[type="submit"]').click();
  await page.locator('#open3DCalcBtn').click();
  const root=page.locator('#kd3dRoot');
  await expect(root.locator('[data-stats]')).toContainText('Столбов',{timeout:15000});
  const a=root.locator('[data-side-products="A"]');
  await root.locator('[data-opening-side="A"][data-opening-kind="gate"]').click();
  await root.locator('[data-opening-side="A"][data-opening-kind="wicket"]').click();
  await expect(a.locator('[data-gate-swing-state="closed"]')).toHaveAttribute('aria-pressed','true');
  await expect(a.locator('[data-wicket-swing-state="closed"]')).toHaveAttribute('aria-pressed','true');
  const result=await page.evaluate(()=>{
    const root=document.querySelector('#threeDScreen');
    const card=root.querySelector('[data-side-products="A"] .kd3d-product-gate');
    const buttons=card.querySelector('[data-gate-swing-position]>div');
    const button=card.querySelector('[data-gate-swing-state="closed"]');
    const fields=card.querySelector('[data-gate-fields]');
    const selected=button.getBoundingClientRect();
    const other=card.querySelector('[data-gate-swing-state="open"]').getBoundingClientRect();
    const styles=getComputedStyle(card);
    const segmented=getComputedStyle(buttons);
    const loaded=[...document.styleSheets].some(sheet=>sheet.href?.includes('3d-mobile-ui.css'));
    const children=[...root.querySelectorAll('[data-side-products="A"] input,[data-side-products="A"] select')];
    const noOverflow=children.every(e=>e.getBoundingClientRect().right<=
      root.getBoundingClientRect().right+2);
    return {loaded,background:styles.backgroundColor,
      borderRadius:parseFloat(styles.borderTopLeftRadius),
      columns:segmented.gridTemplateColumns.split(' ').length,
      sameRow:Math.abs(selected.y-other.y)<3,
      buttonsWide:Math.abs(selected.width-other.width)<5,
      fontSize:parseFloat(getComputedStyle(button).fontSize),
      noOverflow,fieldsVisible:getComputedStyle(fields).display!=='none',
      checkboxAppearance:getComputedStyle(card.querySelector('[data-gate-enabled]')).appearance,
      checkboxWidth:card.querySelector('[data-gate-enabled]').getBoundingClientRect().width,
      fieldLabelDirection:getComputedStyle(card.querySelector('[data-gate-width]').closest('label')).flexDirection,
      widthField:card.querySelector('[data-gate-width]').getBoundingClientRect().width,
      offsetField:card.querySelector('[data-gate-offset]').getBoundingClientRect().width};
  });
  expect(result.loaded).toBe(true);
  expect(result.background).toBe('rgb(255, 255, 255)');
  expect(result.borderRadius).toBeGreaterThanOrEqual(14);
  expect(result.columns).toBe(2);
  expect(result.sameRow).toBe(true);
  expect(result.buttonsWide).toBe(true);
  expect(result.fontSize).toBeGreaterThanOrEqual(12);
  expect(result.noOverflow).toBe(true);
  expect(result.fieldsVisible).toBe(true);
  expect(result.checkboxAppearance).toBe('none');
  expect(result.checkboxWidth).toBeGreaterThanOrEqual(42);
  expect(result.fieldLabelDirection).toBe('column');
  expect(result.widthField).toBeGreaterThan(75);
  expect(result.offsetField).toBeGreaterThan(75);
  await a.locator('[data-gate-swing-state="open"]').click();
  await expect(a.locator('[data-gate-swing-state="open"]')).toHaveAttribute('aria-pressed','true');
  await expect(a.locator('[data-wicket-swing-state="closed"]')).toHaveAttribute('aria-pressed','true');
});

test('3D camera from facade: side Б stays on viewer right, not mirrored',async ({page})=>{
  test.setTimeout(120000);
  await page.goto('/kuznechny-dvorik-gates/zamer-app-v2/');
  await page.locator('#loginInput').fill('zamer');
  await page.locator('#passwordInput').fill('1234');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#mainView')).toBeVisible({timeout:10000});
  await page.locator('#open3DCalcBtn').click();
  const root=page.locator('#kd3dRoot');
  await expect(root.locator('[data-stats]')).toContainText('Столбов',{timeout:15000});
  const has3D=(await root.locator('.kd3d-scene canvas').count())>0;
  if(!has3D)return;
  // Face A is x=0..10 at z=0. B runs into the yard at x=10,z=0..10.
  // The natural street viewpoint must be at z BELOW the target.
  await root.locator('[data-side-length-input="A"]').fill('10');
  await root.locator('[data-side-length-input="A"]').press('Tab');
  await root.locator('[data-fit]').click();
  await expect(root).toHaveAttribute('data-scene-camera-mode','single');
  let z=Number(await root.getAttribute('data-scene-camera-z'));
  let targetZ=Number(await root.getAttribute('data-scene-camera-target-z'));
  expect(z).toBeLessThan(targetZ);
  await root.locator('[data-side-toggle="B"]').check();
  await root.locator('[data-fit]').click();
  await expect(root).toHaveAttribute('data-scene-camera-mode','multi');
  z=Number(await root.getAttribute('data-scene-camera-z'));
  targetZ=Number(await root.getAttribute('data-scene-camera-target-z'));
  expect(z).toBeLessThan(targetZ);
  expect(Number(await root.getAttribute('data-scene-camera-x'))).toBeGreaterThan(
    Number(await root.getAttribute('data-scene-camera-target-x')));
  // The previous incorrect camera was from +Z and swapped right-hand B.
  await root.locator('[data-side-length-input="A"]').fill('12');
  await root.locator('[data-side-length-input="A"]').press('Tab');
  await expect(root.locator('[data-parts]')).toContainText('Сторона А');
});

test('3D mobile tap: fence, gate, wicket open contextual editor; drag does not select',async ({page})=>{
  test.setTimeout(120000);
  await page.goto('/kuznechny-dvorik-gates/zamer-app-v2/');
  await page.locator('#loginInput').fill('zamer');
  await page.locator('#passwordInput').fill('1234');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#mainView')).toBeVisible({timeout:10000});
  await page.locator('#open3DCalcBtn').click();
  const root=page.locator('#kd3dRoot'),canvas=root.locator('.kd3d-scene canvas');
  await expect(root.locator('[data-stats]')).toContainText('Столбов',{timeout:15000});
  if(await canvas.count()===0)return; // WebGL unsupported device: existing form still usable.
  const panel=root.locator('[data-tap-editor]');
  await expect(panel).toBeHidden();
  const pointFor=async(kind)=>{
    const points=JSON.parse(await root.getAttribute('data-scene-tap-points')||'[]');
    const box=await canvas.boundingBox();
    const point=points.find(p=>p.sideId==='A'&&p.kind===kind&&p.x>15&&p.y>15&&
      p.x<box.width-15&&p.y<box.height-15);
    expect(point,'actual projected raycast region '+kind).toBeTruthy();
    return point;
  };
  await root.locator('[data-fit]').click();
  const fencePoint=await pointFor('fence');
  await canvas.click({position:{x:fencePoint.x,y:fencePoint.y}});
  await expect(panel).toBeVisible();
  await expect(root).toHaveAttribute('data-tap-selection','A:fence');
  await expect(panel.locator('[data-tap-title]')).toContainText('Забор');
  await panel.locator('[data-tap-field="sideHeight"]').fill('2.1');
  await panel.locator('[data-tap-field="sideHeight"]').press('Tab');
  await expect(root.locator('[data-side-quick-height="A"]')).toHaveValue('2.1');
  await panel.locator('[data-tap-close]').click();
  await expect(panel).toBeHidden();

  // Enable one gate and one wicket (including any existing draft defaults).
  const gate=root.locator('[data-side-products="A"] [data-gate-enabled]');
  const wicket=root.locator('[data-side-products="A"] [data-wicket-enabled]');
  if(!await gate.isChecked())await root.locator('[data-opening-side="A"][data-opening-kind="gate"]').click();
  if(!await wicket.isChecked())await root.locator('[data-opening-side="A"][data-opening-kind="wicket"]').click();
  await root.locator('[data-fit]').click();
  const gatePoint=await pointFor('gate');
  await canvas.click({position:{x:gatePoint.x,y:gatePoint.y}});
  await expect(root).toHaveAttribute('data-tap-selection','A:gate');
  await expect(panel.locator('[data-tap-title]')).toContainText('ворота');
  await panel.locator('[data-tap-position="open"]').click();
  await expect(root.locator('[data-side-products="A"] [data-gate-swing-state="open"]'))
    .toHaveAttribute('aria-pressed','true');
  await panel.locator('[data-tap-detail]').click();
  await expect(panel).toBeHidden();

  await root.locator('[data-fit]').click();
  const wicketPoint=await pointFor('wicket');
  await canvas.click({position:{x:wicketPoint.x,y:wicketPoint.y}});
  await expect(root).toHaveAttribute('data-tap-selection','A:wicket');
  await expect(panel.locator('[data-tap-title]')).toContainText('Калитка');
  await panel.locator('[data-tap-field="width"]').fill('1.1');
  await panel.locator('[data-tap-field="width"]').press('Tab');
  await expect(root.locator('[data-side-products="A"] [data-wicket-width]')).toHaveValue('1.1');
  await panel.locator('[data-tap-close]').click();

  // OrbitControls must keep a drag from opening the quick editor.
  await root.locator('[data-fit]').click();
  const p=await pointFor('gate');
  const rect=await canvas.boundingBox();
  await page.mouse.move(rect.x+p.x,rect.y+p.y);
  await page.mouse.down();
  await page.mouse.move(rect.x+p.x+45,rect.y+p.y+25,{steps:5});
  await page.mouse.up();
  await expect(panel).toBeHidden();
  expect(await root.getAttribute('data-tap-selection')).toBe('');
  const stored=await page.evaluate(()=>
    JSON.parse(localStorage.getItem('kd-surveyor-3d-draft-v1')));
  expect(stored.sides.A.height).toBe(2.1);
  expect(stored.openings.A.wicket.width).toBe(1.1);
});


test('3D: gate/wicket offsets are visible and editable under each side heading',async ({page})=>{
  test.setTimeout(120000);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/kuznechny-dvorik-gates/zamer-app-v2/');
  await page.locator('#loginInput').fill('zamer');
  await page.locator('#passwordInput').fill('1234');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#mainView')).toBeVisible({timeout:10000});
  await page.locator('#open3DCalcBtn').click();
  const root=page.locator('#kd3dRoot');
  await expect(root.locator('[data-stats]')).toContainText('Столбов',{timeout:15000});
  const a=root.locator('[data-side-entry="A"]');
  const quickA=a.locator('[data-position-panel="A"]');
  await expect(quickA).toBeHidden(); // no openings, no spurious offset
  await a.locator('[data-opening-side="A"][data-opening-kind="gate"]').click();
  await expect(quickA).toBeVisible();
  await expect(quickA).toContainText('Расположение проёмов');
  await expect(quickA).toContainText('Фасад: слева направо');
  const gateOffset=quickA.locator('[data-quick-offset="A"][data-quick-kind="gate"]');
  await expect(gateOffset).toBeVisible();
  await expect(quickA.locator('[data-quick-offset="A"][data-quick-kind="wicket"]')).toBeHidden();
  await expect(quickA.locator('[data-quick-add="A"][data-quick-kind="wicket"]')).toBeVisible();
  const positioning=await quickA.evaluate(panel=>{
    const rect=panel.getBoundingClientRect();
    const gate=panel.querySelector('[data-quick-offset][data-quick-kind="gate"]');
    const inputRect=gate.getBoundingClientRect();
    const detailed=document.querySelector('[data-side-products="A"]');
    return {
      panelWidth:rect.width,screenWidth:window.innerWidth,
      inputHeight:inputRect.height,
      aboveDetails:rect.top<detailed.getBoundingClientRect().top
    };
  });
  expect(positioning.panelWidth).toBeLessThanOrEqual(positioning.screenWidth);
  expect(positioning.inputHeight).toBeGreaterThanOrEqual(42);
  expect(positioning.aboveDetails).toBe(true);

  await gateOffset.fill('1.7');
  await gateOffset.press('Tab');
  await expect(a.locator('[data-side-products="A"] [data-gate-offset]')).toHaveValue('1.7');
  await quickA.locator('[data-quick-add="A"][data-quick-kind="wicket"]').click();
  const wicketOffset=quickA.locator('[data-quick-offset="A"][data-quick-kind="wicket"]');
  await expect(wicketOffset).toBeVisible();
  await expect(a.locator('[data-side-products="A"] [data-wicket-enabled]')).toBeChecked();
  await wicketOffset.fill('6.2');
  await wicketOffset.press('Tab');
  await expect(a.locator('[data-side-products="A"] [data-wicket-offset]')).toHaveValue('6.2');
  await a.locator('[data-side-products="A"] [data-gate-offset]').fill('2');
  await a.locator('[data-side-products="A"] [data-gate-offset]').press('Tab');
  await expect(gateOffset).toHaveValue('2'); // bidirectional synchronization

  await root.locator('[data-opening-side="B"][data-opening-kind="gate"]').click();
  const quickB=root.locator('[data-position-panel="B"]');
  await expect(quickB).toBeVisible();
  await expect(quickB).toContainText('от фасада вглубь участка');
  await quickB.locator('[data-quick-offset="B"][data-quick-kind="gate"]').fill('3');
  await quickB.locator('[data-quick-offset="B"][data-quick-kind="gate"]').press('Tab');
  await expect(gateOffset).toHaveValue('2');
  await expect(wicketOffset).toHaveValue('6.2');
  const saved=await page.evaluate(()=>JSON.parse(
    localStorage.getItem('kd-surveyor-3d-draft-v1')).openings);
  expect(saved.A.gate.offset).toBe(2);
  expect(saved.A.wicket.offset).toBe(6.2);
  expect(saved.B.gate.offset).toBe(3);
  expect(saved.B.wicket.enabled).toBe(false);
});
