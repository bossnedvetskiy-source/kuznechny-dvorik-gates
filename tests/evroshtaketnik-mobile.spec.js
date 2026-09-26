import {test, expect} from '@playwright/test';

const viewports = [
  {name:'360x800', width:360, height:800},
  {name:'412x915', width:412, height:915}
];

for (const viewport of viewports) {
  test(`euro picket mobile UX ${viewport.name}`, async ({page}) => {
    await page.setViewportSize({width:viewport.width,height:viewport.height});
    await page.goto('/evroshtaketnik/index.html', {waitUntil:'domcontentloaded'});

    const cards = page.locator('.type-card');
    await expect(cards).toHaveCount(3);
    for (let i=0;i<3;i+=1) {
      const img = cards.nth(i).locator('img');
      await expect(img).toBeVisible();
      await expect.poll(async () => img.evaluate(el => el.complete && el.naturalWidth > 0 && el.naturalHeight > 0)).toBeTruthy();
    }

    const firstCardBox = await cards.first().boundingBox();
    const firstImageBox = await cards.first().locator('.type-image').boundingBox();
    expect(firstCardBox).not.toBeNull();
    expect(firstImageBox).not.toBeNull();
    expect(firstImageBox.width / firstCardBox.width).toBeGreaterThan(0.42);
    expect(firstCardBox.height).toBeLessThan(190);

    await expect(page.locator('.post-options')).not.toHaveAttribute('open', '');
    await page.locator('[data-field="length"][data-index="0"]').fill('10');
    await expect(page.locator('#mobileQuoteBar')).toBeVisible();

    const noHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(noHorizontalOverflow).toBeTruthy();

    await page.locator('.section-openings').first().locator('summary').click();
    await page.locator('[data-field="gateOpening"][data-index="0"]').fill('3.4');
    await page.locator('[data-field="wicketOpening"][data-index="0"]').fill('1');
    await expect(page.locator('#priceExclusions')).toBeVisible();
    await expect(page.locator('#priceExclusions')).toContainText('не входят');
    await expect(page.locator('#mobileBarNote')).toContainText('не входят');

    const lengthInput = page.locator('[data-field="length"][data-index="0"]');
    await lengthInput.focus();
    await expect(page.locator('#mobileQuoteBar')).toHaveClass(/is-input-active/);

    await page.locator('body').click({position:{x:10,y:10}});
    await page.waitForTimeout(120);

    await page.locator('#settlement').scrollIntoViewIfNeeded();
    await page.waitForTimeout(120);
    await expect(page.locator('#mobileQuoteBar')).toHaveClass(/is-suppressed/);

    const zoom = page.locator('[data-scheme-zoom]').first();
    await zoom.scrollIntoViewIfNeeded();
    await zoom.click();
    await expect(page.locator('#schemeDialog')).toBeVisible();
    await expect(page.locator('#schemeDialogBody svg')).toBeVisible();
    await page.locator('#schemeDialogClose').click();
    await expect(page.locator('#schemeDialog')).not.toBeVisible();
  });
}
