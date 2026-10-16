import { test, expect } from '@playwright/test'

test('accepting after decline and reload clears the SDK opt-out', async ({ page }) => {
  // Use the real SDK with a fake project key; no analytics requests leave the test.
  await page.route('**/analytics/**', route => route.fulfill({ json: {} }))
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:5180\/)/, route => route.fulfill({ body: '' }))
  const consent = () => page.evaluate(() => ({
    app: localStorage.getItem('uniqlo-tracker-analytics-consent-v1'),
    sdk: localStorage.getItem('__ph_opt_in_out_phc_browser_test'),
  }))
  await page.goto('/ca/faq')
  await page.getByRole('button', { name: 'Allow analytics', exact: true }).click()
  await expect.poll(consent).toEqual({ app: 'accepted', sdk: '1' })
  await page.getByRole('button', { name: 'Privacy settings', exact: true }).click()
  await page.getByRole('button', { name: 'Decline analytics', exact: true }).click()
  await expect.poll(consent).toEqual({ app: 'declined', sdk: '0' })
  await page.reload()
  await page.getByRole('button', { name: 'Privacy settings', exact: true }).click()
  await page.getByRole('button', { name: 'Allow analytics', exact: true }).click()
  await expect.poll(consent).toEqual({ app: 'accepted', sdk: '1' })
})
