import { test, expect, currentId, archiveId } from './fixtures'

test('historical search is opt-in, survives reload, and opens an archived detail', async ({page}) => {
  await page.goto('/ca/categories?q=linen')
  await expect(page.getByRole('heading', {name:'No matching products'})).toBeVisible()
  // URL-driven checkbox updates can commit after the click; retry the state assertion.
  await page.getByLabel('Include archived products').click()
  await expect(page.getByLabel('Include archived products')).toBeChecked()
  await expect(page).toHaveURL(/history=1/)
  const result = page.getByRole('link', {name:/View price history for Archived linen shirt/})
  await expect(result).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Include archived products')).toBeChecked()
  await result.click()
  await expect(page.getByText('Archived', {exact:true})).toBeVisible()
  await expect(page.getByText('Last recorded price', {exact:true})).toBeVisible()
  await page.getByRole('link',{name:'All products',exact:true}).last().click()
  await expect(page.getByRole('searchbox')).toHaveValue('linen')
  await expect(page.getByLabel('Include archived products')).toBeChecked()
  await page.getByLabel('Include archived products').click()
  await expect(page.getByLabel('Include archived products')).not.toBeChecked()
  await expect(page).not.toHaveURL(/history=1/)
  await expect(page.getByRole('heading', {name:'No matching products'})).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Include archived products')).not.toBeChecked()
  await expect(result).not.toBeVisible()
  await page.goto('/ca?history=1&q=linen')
  await expect(page.getByRole('heading',{name:'No matching deals'})).toBeVisible()
})

test('product detail downloads no catalogue and ranges change the recorded observations', async ({page}) => {
  const catalogues: string[] = []
  page.on('request', request => { if (/\/api\/ca\/products(?:\?|$)/.test(request.url())) catalogues.push(request.url()) })
  await page.goto(`/ca/products/${currentId}`)
  await expect(page.getByRole('heading',{name:'Cotton crew neck shirt'})).toBeVisible()
  await page.getByRole('button',{name:'30 days',exact:true}).click()
  await expect(page.getByText('View 30 recorded prices in this range')).toBeVisible()
  await expect(page.locator('.history-summary dd').filter({hasText:'10 days'})).toBeVisible()
  await page.getByRole('button',{name:'All time',exact:true}).click()
  await expect(page.getByText('View 100 recorded prices in this range')).toBeVisible()
  expect(catalogues).toEqual([])
})

test('save persists, removal offers undo, and archived saved items retain their label', async ({page}) => {
  await page.goto(`/ca/products/${archiveId}`)
  await page.getByRole('button',{name:'Save Archived linen shirt',exact:true}).click()
  await page.goto('/ca/saved')
  await expect(page.getByText('Archived',{exact:true})).toBeVisible()
  await page.reload()
  await expect(page.getByRole('link',{name:'Archived linen shirt',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Remove Archived linen shirt from Saved',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Keep an eye on your favourites.'})).toBeVisible()
  await page.getByRole('button',{name:'Undo',exact:true}).click()
  await expect(page.getByRole('link',{name:'Archived linen shirt',exact:true})).toBeVisible()
})

test('mobile filters return to results, restore focus, and keep products near the top', async ({page,isMobile}) => {
  test.skip(!isMobile, 'Mobile-specific layout and dialog')
  await page.goto('/ca')
  const firstProduct = page.getByRole('link',{name:/View price history for Cotton/})
  await expect(firstProduct).toBeVisible()
  expect((await firstProduct.boundingBox())!.y).toBeLessThan(540)
  await page.getByRole('button',{name:'Filters',exact:true}).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('spinbutton',{name:'Maximum price (CAD)',exact:true}).fill('30')
  await dialog.getByRole('button',{name:'Show 1 deal',exact:true}).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('button',{name:/Filters/})).toBeFocused()
  await expect(firstProduct).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('stale catalogue prices show a warning when the browser date advances', async ({page}) => {
  await page.goto('/ca')
  const firstProduct = page.getByRole('link',{name:/View price history for Cotton/})
  const warning = page.getByRole('status').filter({hasText:'Prices were last checked'})
  await expect(firstProduct).toBeVisible()
  await expect(warning).not.toBeVisible()

  await page.clock.setFixedTime(new Date('2026-10-23T00:00:00Z'))
  await page.reload()
  await expect(warning).toHaveText('Prices were last checked October 15, 2026. Check Uniqlo for current prices.')
  await expect(firstProduct).toBeVisible()
})

test('Typical help opens from the price and closes with Escape', async ({page}) => {
  await page.goto(`/ca/products/${currentId}`)
  const help = page.getByRole('button',{name:'What does Typical mean?'}).first()
  await help.click()
  await expect(page.getByRole('note')).toContainText('Ties use the higher price')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('note')).not.toBeVisible()
  await expect(help).toBeFocused()
})

test('copy link uses the canonical country URL and offers manual copy on failure', async ({page}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable:true, value: { writeText: async (value:string) => { (window as any).__copied = value } } })
  })
  await page.goto(`/ca/products/${currentId}?unrelated=1`)
  await page.getByRole('button',{name:'Copy link',exact:true}).click()
  await expect(page.getByRole('button',{name:'Link copied',exact:true})).toBeVisible()
  expect(await page.evaluate(() => (window as any).__copied)).toBe(`https://www.uniqlotracker.com/ca/products/${currentId}`)
  await page.evaluate(() => Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw new Error('blocked')}}}))
  await page.getByRole('button',{name:'Link copied',exact:true}).click()
  await expect(page.getByRole('textbox',{name:'Product link'})).toHaveValue(`https://www.uniqlotracker.com/ca/products/${currentId}`)
})

test('pasted links select the matching country; unavailable products explain missing history', async ({page}) => {
  await page.goto('/ca')
  await page.getByRole('searchbox').fill(`https://www.uniqlo.com/us/en/products/${currentId}/00`)
  await page.getByRole('button',{name:'View price history',exact:true}).click()
  await expect(page).toHaveURL(`/us/products/${currentId}`)
  await expect(page.getByRole('button',{name:'Change country: United States, USD'})).toBeVisible()
  await page.goto('/us/products/E999999-000')
  await expect(page.getByRole('heading',{name:'No price history yet.'})).toBeVisible()
})

test('catalogue failure offers retry without claiming no matching products', async ({page}) => {
  let failing = true
  await page.route('**/api/ca/products', route => failing ? route.fulfill({status:503,json:{error:'Unavailable'}}) : route.fallback())
  await page.goto('/ca')
  await expect(page.getByRole('button',{name:/Try again|Retry/})).toBeVisible({timeout:15000})
  await expect(page.getByRole('heading',{name:'No matching deals'})).not.toBeVisible()
  failing = false
  await page.getByRole('button',{name:/Try again|Retry/}).click()
  await expect(page.getByRole('link',{name:/View price history for Cotton/})).toBeVisible()
})

test('grouped product types count each product once and preserve legacy category links', async ({page,isMobile}) => {
  const products = [
    {product_id:'E200001-000',name:'Cotton base layer',categories:['women/innerwear','women/innerwear-and-base-layers']},
    {product_id:'E200002-000',name:'Cotton undershirt',categories:['women/innerwear-and-base-layers']},
  ].map(product => ({...product,price:20,regular_price:40,lowest_price:20,is_all_time_low:true,
    datetime:'2026-10-15T00:00:00Z',attributes:{materials:['cotton'],features:['airism']},url:`https://www.uniqlo.com/ca/en/products/${product.product_id}/00`}))
  await page.route('**/api/ca/products',route=>route.fulfill({json:{products,count:2,datetime:'2026-10-15T00:00:00Z',market:'CA',currency:'CAD'}}))
  await page.goto('/ca/categories?category=innerwear')
  await expect(page.getByRole('link',{name:/View price history for Cotton base layer/})).toBeVisible()
  await expect(page.getByRole('link',{name:/View price history for Cotton undershirt/})).not.toBeVisible()
  await page.getByRole('button',{name:/^Filters/}).click()
  await expect(page.getByRole('spinbutton',{name:'Minimum discount (%)',exact:true})).toBeVisible()
  const group = page.getByRole('group',{name:'Product type',exact:true})
  const innerwear = group.getByRole('button',{name:'Innerwear and base layers 2',exact:true})
  await expect(innerwear).toHaveAttribute('aria-pressed','true')
  await innerwear.click()
  await innerwear.click()
  const params = new URL(page.url()).searchParams
  expect(params.getAll('category')).toEqual(['innerwear','innerwear-and-base-layers'])
  await expect(page.getByRole('group',{name:'Product type'}).getByRole('button')).toHaveCount(1)
  if (isMobile) {
    await expect(page.getByRole('button',{name:'Material',exact:true})).toHaveAttribute('aria-expanded','true')
    await expect(page.getByRole('button',{name:'Feature',exact:true})).toHaveAttribute('aria-expanded','true')
    await page.getByRole('group',{name:'Material',exact:true}).getByRole('button',{name:'Cotton 2',exact:true}).click()
    await page.getByRole('button',{name:'Material 1 selected',exact:true}).click()
    await expect(page.getByRole('group',{name:'Material',exact:true})).not.toBeVisible()
    await page.getByRole('dialog').getByLabel('Selected filters').getByRole('button',{name:'Cotton',exact:true}).click()
    await page.getByRole('button',{name:'Show 2 products',exact:true}).click()
  } else await page.getByRole('button',{name:/^Filters/}).click()
  await expect(page.getByRole('link',{name:/View price history for Cotton/})).toHaveCount(2)
  await page.reload()
  await expect(page.getByRole('link',{name:/View price history for Cotton/})).toHaveCount(2)
  await page.goto('/ca/categories?open=women/innerwear')
  await expect(page.getByRole('link',{name:/View price history for Cotton base layer/})).toBeVisible()
  await expect(page.getByRole('link',{name:/View price history for Cotton undershirt/})).not.toBeVisible()
})

test('advanced savings remain available and selected values survive reload',async ({page,isMobile}) => {
  await page.goto('/ca?minDiscount=25')
  await page.getByRole('button',{name:/^Filters/}).click()
  await expect(page.getByRole('spinbutton',{name:'Minimum discount (%)',exact:true})).toHaveValue('25')
  await page.getByRole('spinbutton',{name:'Minimum savings (CAD)',exact:true}).fill('10')
  await page.getByRole('button',{name:/^Discount & savings/}).click()
  await expect(page.getByRole('spinbutton',{name:'Minimum savings (CAD)',exact:true})).not.toBeVisible()
  if (isMobile) await page.getByRole('button',{name:'Show 1 deal',exact:true}).click()
  await page.reload()
  await page.getByRole('button',{name:/^Filters/}).click()
  await expect(page.getByRole('spinbutton',{name:'Minimum savings (CAD)',exact:true})).toHaveValue('10')
})

test('filter panel stays usable at narrow and tablet widths with keyboard dismissal', async ({page}) => {
  for (const width of [320,650,768]) {
    await page.setViewportSize({width,height:844})
    await page.goto('/ca/categories')
    const trigger = page.getByRole('button',{name:'Filters',exact:true})
    await trigger.focus()
    await page.keyboard.press('Enter')
    const panel = page.locator('#browse-filter-panel')
    await expect(panel).toBeVisible()
    await expect(panel.getByRole('button',{name:'Clear filters',exact:true})).not.toBeVisible()
    await expect(panel.getByRole('spinbutton',{name:'Minimum savings (CAD)',exact:true})).toBeVisible()
    const bounds = (await panel.boundingBox())!
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.keyboard.press('Escape')
    await expect(panel).not.toBeVisible()
    await expect(trigger).toBeFocused()
  }
})
