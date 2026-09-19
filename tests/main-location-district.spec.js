import {test, expect} from '@playwright/test';

async function mockPlaceSearch(page, choices) {
  await page.route('**/api/delivery-search?place=*', async route => {
    await route.fulfill({
      status:200,
      contentType:'application/json',
      body:JSON.stringify({query:new URL(route.request().url()).searchParams.get('place') || '', choices})
    });
  });
}

test('main site requires district selection and OK before delivery is accepted', async ({page}) => {
  await mockPlaceSearch(page, [
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
  ]);

  let routedPlace = '';
  await page.route('**/api/delivery?place=*', async route => {
    routedPlace = new URL(route.request().url()).searchParams.get('place') || '';
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

  await page.setViewportSize({width:390,height:844});
  await page.goto('/', {waitUntil:'domcontentloaded'});
  await expect(page.locator('#catalogOrderConfigurator')).toBeVisible({timeout:8000});

  await page.locator('#deliveryChooser [data-delivery-choice="other"]').click();
  const input = page.locator('#cityInput');
  await input.fill('Ишеево');

  const choices = page.locator('.delivery-place-choices__button');
  await expect(choices).toHaveCount(2, {timeout:8000});
  await expect(page.locator('.delivery-place-choices')).toContainText('район');
  await expect(page.locator('#routeButton')).toBeHidden();

  await choices.nth(1).click();
  await expect(page.locator('#deliverySummary')).toBeHidden();
  await expect(page.locator('#routeButton')).toBeVisible();
  await expect(page.locator('#routeButton')).toHaveText('ОК');
  await expect(page.locator('#deliveryResult')).toContainText('Проверьте район');

  await page.locator('#routeButton').click();

  await expect.poll(() => routedPlace, {timeout:8000}).toContain('Ишимбайский район');
  await expect(page.locator('#deliverySummary')).toBeVisible({timeout:8000});
  await expect(page.locator('#routeButton')).toBeHidden();
  await expect(page.locator('#deliverySummaryValue')).toContainText('Ишеево, Ишимбайский район');
});

test('main site does not auto-confirm even a single search result', async ({page}) => {
  await mockPlaceSearch(page, [
    {
      name:'Покровка',
      label:'Покровка, Стерлитамакский район',
      secondary:'Стерлитамакский район, Республика Башкортостан',
      query:'Покровка, Стерлитамакский район, Республика Башкортостан, Россия'
    }
  ]);

  await page.route('**/api/delivery?place=*', async route => {
    await route.fulfill({
      status:200,
      contentType:'application/json',
      body:JSON.stringify({
        price:7200,
        distanceKm:80,
        shortName:'Покровка',
        serviceAreaKm:150,
        outOfArea:false,
        resolved:true,
        source:'route'
      })
    });
  });

  await page.setViewportSize({width:390,height:844});
  await page.goto('/', {waitUntil:'domcontentloaded'});
  await page.locator('#deliveryChooser [data-delivery-choice="other"]').click();
  await page.locator('#cityInput').fill('Покровка');

  await expect(page.locator('.delivery-place-choices__button')).toHaveCount(1, {timeout:8000});
  await expect(page.locator('#deliverySummary')).toBeHidden();
  await expect(page.locator('#routeButton')).toBeHidden();

  await page.locator('.delivery-place-choices__button').click();
  await expect(page.locator('#routeButton')).toHaveText('ОК');
  await expect(page.locator('#deliverySummary')).toBeHidden();

  await page.locator('#routeButton').click();
  await expect(page.locator('#deliverySummary')).toBeVisible({timeout:8000});
  await expect(page.locator('#routeButton')).toBeHidden();
});


test('typed fixed city also requires selection and keeps its published tariff', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/', {waitUntil:'domcontentloaded'});
  await expect(page.locator('#catalogOrderConfigurator')).toBeVisible({timeout:8000});

  await page.locator('#deliveryChooser [data-delivery-choice="other"]').click();
  await page.locator('#cityInput').fill('Салават');

  const choice = page.locator('.delivery-place-choices__button').first();
  await expect(choice).toBeVisible({timeout:8000});
  await expect(choice).toContainText('Салават');
  await expect(page.locator('#deliverySummary')).toBeHidden();
  await expect(page.locator('#routeButton')).toBeHidden();

  await choice.click();
  await expect(page.locator('#routeButton')).toHaveText('ОК');
  await page.locator('#routeButton').click();

  await expect(page.locator('#deliverySummaryValue')).toContainText('Салават');
  await expect(page.locator('#routeButton')).toBeHidden();
  const quote = page.locator('#catalogGrid .product-card').first().locator('.catalog-primary-quote');
  await expect(quote.locator('strong')).toHaveText('69 100 ₽');
  await expect(quote).toContainText(/доставкой в Салават/i);
});
