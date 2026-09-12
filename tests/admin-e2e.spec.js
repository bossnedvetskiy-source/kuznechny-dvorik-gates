import {test, expect} from '@playwright/test';

test('admin tabs never leave a blank screen and lead workflow is usable', async ({page}) => {
  await page.goto('/admin', {waitUntil:'domcontentloaded'});
  await expect(page.locator('#editorView')).toBeVisible();
  await expect(page.locator('[data-admin-tab="leads"]')).toBeVisible();
  await expect(page.locator('[data-admin-tab="settings"]')).toBeVisible();

  await page.locator('[data-admin-tab="leads"]').click();
  await expect(page.locator('#leadsTab')).toBeVisible();
  await expect(page.locator('.lead-card').first()).toBeVisible();
  await expect(page.locator('.lead-workflow-panel').first()).toBeVisible();
  await expect(page.locator('.lead-workflow-panel').first().locator('[data-workflow-field="stage"]')).toHaveValue('new');

  await page.locator('.lead-workflow-panel').first().locator('summary').click();
  await expect(page.locator('.lead-workflow-panel').first()).toContainText('gates');
  await expect(page.locator('.lead-workflow-panel').first()).toContainText('ворота с калиткой');

  await page.locator('[data-admin-tab="photos"]').click();
  await expect(page.locator('#photosTab')).toBeVisible();
  await expect(page.locator('#leadsTab')).toBeHidden();
  await expect(page.locator('#cardPreview')).toBeVisible();

  await page.locator('[data-admin-tab="leads"]').click();
  await page.locator('.lead-workflow-panel').first().locator('[data-workflow-field="stage"]').selectOption('measurement_scheduled');
  await page.locator('.lead-workflow-panel').first().locator('[data-workflow-field="note"]').fill('Замер назначен на завтра');
  await page.locator('.lead-workflow-panel').first().locator('.lead-workflow-save').click();
  await expect(page.locator('.toast')).toContainText('Этап и заметка сохранены');
  await expect(page.locator('.lead-workflow-panel').first().locator('.lead-stage-pill')).toContainText('Замер назначен');
});

test('admin can edit fixed delivery tariffs and sees rollback history', async ({page}) => {
  await page.goto('/admin', {waitUntil:'domcontentloaded'});
  await page.locator('[data-admin-tab="settings"]').click();
  await expect(page.locator('#settingsTab')).toBeVisible();
  await expect(page.locator('.delivery-admin-card')).toBeVisible();
  await expect(page.locator('.delivery-admin-row').first()).toContainText('');

  await page.locator('.delivery-add').click();
  const lastRow=page.locator('.delivery-admin-row').last();
  await lastRow.locator('input').nth(0).fill('Новый пункт');
  await lastRow.locator('input').nth(1).fill('4500');
  await page.locator('#saveDeliveryButton').click();
  await expect(page.locator('.toast')).toContainText('Тарифы доставки опубликованы');

  const historyButton=page.locator('.history-button').filter({hasText:'История доставки'});
  await expect(historyButton).toBeVisible();
  await historyButton.click();
  await expect(page.locator('.admin-history-modal')).toBeVisible();
  await expect(page.locator('.admin-history-item')).toBeVisible();
  await page.locator('.admin-history-close').click();
});

test('admin base price becomes the browser calculator anchor', async ({page}) => {
  const original = await import('node:fs/promises').then(fs => fs.readFile(new URL('../prices.js', import.meta.url), 'utf8'));
  const modified = original.replace("{ art: 'Арт.6', price: 56600", "{ art: 'Арт.6', price: 61600");
  await page.route('**/prices.js', route => route.fulfill({status:200,contentType:'text/javascript',body:modified}));
  await page.setViewportSize({width:390,height:844});
  await page.goto('/', {waitUntil:'domcontentloaded'});
  const card=page.locator('.product-card').filter({hasText:'Арт.6'}).first();
  await expect(card).toBeVisible();
  await expect(card).toContainText('69 600 ₽');
  await card.locator('.select-product').click();
  await page.locator('[data-delivery-choice="meleuz"]').click();
  await expect(page.locator('#estimateTotal')).toContainText('69 600 ₽');
});
