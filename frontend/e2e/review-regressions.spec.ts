import { test, expect, currentId } from './fixtures'

test('memory-only saved lists survive country changes and remain separate', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('uniqlo-saved:')) throw new DOMException('Quota exhausted', 'QuotaExceededError')
      original.call(this, key, value)
    }
  })
  await page.goto(`/ca/products/${currentId}`)
  await page.getByRole('button', { name: 'Save Cotton crew neck shirt', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Remove Cotton crew neck shirt from Saved', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Change country: Canada, CAD' }).click()
  await page.getByRole('link', { name: 'United States USD · before tax' }).click()
  await expect(page.getByRole('button', { name: 'Save Cotton crew neck shirt', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Change country: United States, USD' }).click()
  await page.getByRole('link', { name: 'Canada CAD · before tax' }).click()
  await expect(page.getByRole('button', { name: 'Remove Cotton crew neck shirt from Saved', exact: true })).toBeVisible()
  await expect(page.getByText('Browser storage is unavailable.', { exact: false })).toBeVisible()
})

test('saved snapshot stays qualified until fresh product details load', async ({ page }) => {
  await page.goto('/ca/categories')
  await page.getByRole('button', { name: 'Save Cotton crew neck shirt', exact: true }).click()
  let unavailable = true
  await page.route('**/api/ca/products', route => route.fulfill({ status: 503, json: { error: 'Unavailable' } }))
  await page.route(`**/api/ca/product/${currentId}`, route => unavailable
    ? route.fulfill({ status: 503, json: { error: 'Unavailable' } }) : route.fallback())
  // A document load clears the query cache while preserving the saved snapshot.
  await page.goto('/ca/saved')
  await expect(page.getByText('Price when saved', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Cotton crew neck shirt', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Price history couldn’t load' })).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('Price when saved — latest price unavailable.', { exact: true })).toBeVisible()
  await expect(page.getByText('Lowest recorded', { exact: true })).not.toBeVisible()
  await expect(page.locator('.product-saved-comparison')).not.toBeVisible()
  unavailable = false
  await page.getByRole('button', { name: 'Retry price history', exact: true }).click()
  await expect(page.getByText('Lowest recorded', { exact: true })).toBeVisible()
  await expect(page.getByText('Price when saved — latest price unavailable.', { exact: true })).not.toBeVisible()
  await expect(page.locator('.product-saved-comparison')).toBeVisible()
})
