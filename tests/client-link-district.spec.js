import {test, expect} from '@playwright/test';

test('admin client link requires district choice and OK confirmation', async ({page}) => {
  await page.route('**/api/delivery-search?place=*', async route => {
    const requestUrl = new URL(route.request().url());
    const place = requestUrl.searchParams.get('place') || '';
    if (!place.toLocaleLowerCase('ru-RU').includes('ишеево')) {
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({query:place,choices:[]})});
      return;
    }
    await route.fulfill({
      status:200,
      contentType:'application/json',
      body:JSON.stringify({
        query:place,
        choices:[
          {
            name:'Ишеево',
            label:'Ишеево, Аургазинский район',
            secondary:'Аургазинский район, Республика Башкортостан',
            query:'Ишеево, Аургазинский район, Республика Башкортостан, Россия'
          },
          {
            name:'Ишеево',
            label:'Ишеево, Ишимбайский район',
            secondary:'Ишимбайский район, Республика Башкортостан',
            query:'Ишеево, Ишимбайский район, Республика Башкортостан, Россия'
          }
        ]
      })
    });
  });

  await page.goto('/admin.html', {waitUntil:'domcontentloaded'});
  await page.evaluate(() => {
    const editor = document.getElementById('editorView');
    const panel = document.getElementById('catalogTab');
    if (editor) editor.hidden = false;
    if (panel) panel.hidden = false;
  });

  const input = page.locator('#clientLinkCity');
  await input.fill('Ишеево');

  const choices = page.locator('#clientLinkPlaceChoices .client-link-place-choice');
  await expect(choices).toHaveCount(2);
  await expect(page.locator('#clientLinkPlaceStatus')).toContainText('несколько вариантов');

  await choices.nth(1).click();
  await expect(page.locator('#clientLinkPlaceConfirm')).toBeVisible();
  await expect(page.locator('#clientLinkPendingPlace')).toHaveText('Ишеево, Ишимбайский район');
  await expect(page.locator('#clientLinkPendingArea')).toContainText('Ишимбайский район');
  await expect(page.locator('#copyClientLink')).toBeDisabled();

  await page.locator('#clientLinkPlaceOk').click();
  await expect(page.locator('#clientLinkPlaceConfirmed')).toBeVisible();
  await expect(page.locator('#copyClientLink')).toBeEnabled();

  const shared = new URL(await page.locator('#clientLinkOutput').inputValue());
  expect(shared.searchParams.get('city')).toBe('Ишеево, Ишимбайский район');
  expect(shared.searchParams.get('name')).toBe('Ишеево');
  expect(shared.searchParams.get('place')).toContain('Ишимбайский район');
  expect(shared.searchParams.get('posts')).toBe('own');

  await input.fill('Ишеево другое');
  await expect(page.locator('#copyClientLink')).toBeDisabled();
});

test('shared link uses confirmed district query for delivery', async ({page}) => {
  let requestedPlace = '';
  await page.route('**/api/delivery?place=*', async route => {
    const requestUrl = new URL(route.request().url());
    requestedPlace = requestUrl.searchParams.get('place') || '';
    await route.fulfill({
      status:200,
      contentType:'application/json',
      body:JSON.stringify({
        price:6300,
        distanceKm:70,
        shortName:'Ишеево',
        serviceAreaKm:150,
        outOfArea:false,
        resolved:true,
        source:'route'
      })
    });
  });

  const params = new URLSearchParams({
    share:'1',
    city:'Ишеево, Ишимбайский район',
    name:'Ишеево',
    place:'Ишеево, Ишимбайский район, Республика Башкортостан, Россия',
    posts:'own'
  });
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?' + params.toString(), {waitUntil:'domcontentloaded'});

  await expect(page.locator('#catalogOrderSummary')).toBeVisible({timeout:8000});
  await expect(page.locator('#catalogOrderSummary')).toContainText('Ишеево, Ишимбайский район');
  await expect.poll(() => requestedPlace, {timeout:8000}).toContain('Ишимбайский район');
  await expect(page.locator('#catalogGrid .product-card').first().locator('.catalog-primary-quote')).toContainText(/доставкой в Ишеево, Ишимбайский район/i);
});
