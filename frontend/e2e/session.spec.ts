import { test, expect } from '@playwright/test'

test('a reload brings back the Input text, Steps, Field values and node position, but not the results', async ({ page }) => {
  await page.goto('/')
  const palette = page.getByRole('region', { name: 'Add Step' })
  const status = page.getByRole('status').filter({ hasText: /Not run yet|Up to date|Changed/ })
  await expect(status).toHaveText('Not run yet')

  await page.getByRole('textbox', { name: 'Input text' }).fill('Hello World')
  await palette.getByRole('button', { name: 'Replace', exact: true }).click()
  await palette.getByRole('button', { name: 'Uppercase' }).click()
  const replace = page.getByRole('group', { name: 'Step 1: Replace' })
  await replace.getByRole('textbox').first().fill('World')
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(status).toHaveText('Up to date')

  // Enter selects the Step, then an arrow key moves it; this works on touch devices too.
  await replace.focus()
  await replace.press('Enter')
  const before = (await replace.boundingBox())!
  await replace.press('ArrowDown')
  await expect.poll(async () => (await replace.boundingBox())!.y).toBeGreaterThan(before.y)
  const moved = (await replace.boundingBox())!
  // Input text saves after 300 ms; wait for the snapshot rather than for time.
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('text-transformer.session') ?? '')).toContain('Hello World')
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('text-transformer.session') ?? '')).toContain('"World"')
  const runRequests: string[] = []
  page.on('request', (request) => { if (request.method() === 'POST') runRequests.push(request.url()) })

  await page.reload()

  await expect(page.getByRole('textbox', { name: 'Input text' })).toHaveValue('Hello World')
  await expect(page.getByRole('group', { name: 'Step 1: Replace' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Step 2: Uppercase' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Step 1: Replace' }).getByRole('textbox').first()).toHaveValue('World')
  await expect(status).toHaveText('Not run yet')
  await expect(page.getByText('Run to see it')).toHaveCount(2)
  await expect.poll(async () => Math.round((await page.getByRole('group', { name: 'Step 1: Replace' }).boundingBox())!.y)).toBe(Math.round(moved.y))
  expect(runRequests).toEqual([])
})
