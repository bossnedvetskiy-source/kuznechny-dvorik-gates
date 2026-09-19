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
  await expect(page.locator('.delivery-place-choices__action')).toHaveCount(2);
  await expect(page.locator('.delivery-place-choices__action').first()).toHaveText('Выбрать →');
  await expect(page.locator('.delivery-place-choices__change')).toHaveCount(0);
  await expect(page.locator('.city-label')).toHaveClass(/is-place-results/);
  await expect(page.locator('#cityInput')).toBeVisible();
  await expect(page.locator('.delivery-place-choices')).toHaveClass(/is-dropdown/);
  await expect.poll(async () => page.locator('.delivery-place-choices').evaluate(node => getComputedStyle(node).position)).toBe('static');
  await expect.poll(async () => page.evaluate(() => {
    const dropdown = document.querySelector('.delivery-place-choices');
    const config = document.getElementById('catalogOrderConfigurator');
    if (!dropdown || !config) return false;
    return dropdown.getBoundingClientRect().bottom <= config.getBoundingClientRect().bottom + 1;
  })).toBe(true);
  await expect(page.locator('#routeButton')).toBeHidden();

  await choices.nth(1).click();
  await expect(page.locator('#deliverySummary')).toBeHidden();
  await expect(page.locator('#routeButton')).toBeHidden();
  await expect(page.locator('.delivery-place-choices')).toHaveClass(/is-confirming/);
  await expect(page.locator('.delivery-place-choices__button:visible')).toHaveCount(1);
  await expect(page.locator('.city-label')).toHaveClass(/is-place-confirming/);
  await expect(page.locator('#cityInput')).toBeHidden();
  await expect(page.locator('.delivery-place-choices__button.is-selected')).toContainText('Ишеево');
  await expect(page.locator('.delivery-place-choices__button.is-selected')).toContainText('Ишимбайский район');
  const inlineOk = page.locator('.delivery-place-choices__confirm');
  await expect(inlineOk).toBeVisible();
  await expect(inlineOk).toHaveText('ОК');
  await expect(page.locator('.delivery-place-choices__edit')).toBeVisible();
  await expect(page.locator('.delivery-place-choices__edit')).toHaveText('Изменить');

  await inlineOk.click();

  await expect.poll(() => routedPlace, {timeout:8000}).toContain('Ишимбайский район');
  await expect(page.locator('#deliverySummary')).toBeVisible({timeout:8000});
  await expect(page.locator('#routeButton')).toBeHidden();
  await expect(page.locator('#catalogOrderConfigurator')).toBeHidden({timeout:5000});
  await expect(page.locator('#catalogOrderSummary')).toBeVisible();
  await expect(page.locator('#catalogOrderSummary')).toContainText('Цены рассчитаны по вашим параметрам');
  await expect(page.locator('#catalogOrderSummary')).toContainText('Ишеево, Ишимбайский район');

  await page.locator('#catalogOrderSummary button').click();
  await expect(page.locator('#catalogOrderConfigurator')).toBeVisible();
  await expect(page.locator('#catalogOrderSummary')).toBeHidden();
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
  await expect(page.locator('.delivery-place-choices')).toHaveClass(/is-single/);
  await expect(page.locator('.delivery-place-choices__action')).toHaveText('Выбрать →');
  await expect(page.locator('.delivery-place-choices__change')).toHaveCount(0);
  await expect(page.locator('#cityInput')).toBeVisible();
  await expect(page.locator('.delivery-place-choices')).toHaveClass(/is-dropdown/);
  await expect(page.locator('.delivery-place-choices__title')).toBeHidden();
  await expect(page.locator('.delivery-place-choices__hint')).toBeHidden();
  await expect(page.locator('#deliverySummary')).toBeHidden();
  await expect(page.locator('#routeButton')).toBeHidden();

  await page.locator('.delivery-place-choices__button').click();
  await expect(page.locator('#routeButton')).toBeHidden();
  await expect(page.locator('.delivery-place-choices__confirm')).toHaveText('ОК');
  await expect(page.locator('.delivery-place-choices__edit')).toHaveText('Изменить');
  await expect(page.locator('#deliverySummary')).toBeHidden();

  await page.locator('.delivery-place-choices__confirm').click();
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
  await expect(page.locator('#routeButton')).toBeHidden();
  await expect(page.locator('.delivery-place-choices__confirm')).toHaveText('ОК');
  await page.locator('.delivery-place-choices__confirm').click();

  await expect(page.locator('#deliverySummaryValue')).toContainText('Салават');
  await expect(page.locator('#routeButton')).toBeHidden();
  const quote = page.locator('#catalogGrid .product-card').first().locator('.catalog-primary-quote');
  await expect(quote.locator('strong')).toHaveText('69 100 ₽');
  await expect(quote).toContainText(/доставкой в Салават/i);
});


test('typing a Meleuz prefix keeps input visible and prioritizes Meleuz in dropdown', async ({page}) => {
  await page.route('**/api/delivery-search?place=*', async route => {
    await route.fulfill({
      status:200,
      contentType:'application/json',
      body:JSON.stringify({
        query:'меле',
        choices:[
          {
            name:'Мельниково',
            label:'Мельниково, Чебаркульский муниципальный округ',
            secondary:'Чебаркульский муниципальный округ, Челябинская область',
            query:'Мельниково, Челябинская область, Россия'
          },
          {
            name:'Мельничная',
            label:'Мельничная, Частинский муниципальный округ',
            secondary:'Частинский муниципальный округ, Пермский край',
            query:'Мельничная, Пермский край, Россия'
          }
        ]
      })
    });
  });

  await page.setViewportSize({width:390,height:844});
  await page.goto('/', {waitUntil:'domcontentloaded'});
  await page.locator('#deliveryChooser [data-delivery-choice="other"]').click();

  const input = page.locator('#cityInput');
  await input.fill('меле');

  const dropdown = page.locator('.delivery-place-choices');
  await expect(dropdown).toBeVisible({timeout:8000});
  await expect(dropdown).toHaveClass(/is-dropdown/);
  await expect(input).toBeVisible();
  await expect(input).toHaveValue('меле');

  const choices = dropdown.locator('.delivery-place-choices__button');
  await expect(choices.first()).toContainText('Мелеуз');
  await expect(choices.nth(1)).toContainText('Мельниково');
});
