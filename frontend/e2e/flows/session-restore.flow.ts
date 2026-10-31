import { test, expect } from './fixtures'

test('a reload brings back the work but not the results', async ({ page }, testInfo) => {
  await page.goto('/')
  const palette = page.getByRole('region', { name: 'Add Step' })
  const status = page.getByRole('status').filter({ hasText: /Not run yet|Up to date|Changed/ })
  await page.getByRole('textbox', { name: 'Input text' }).fill('Hello World')
  await palette.getByRole('button', { name: 'Replace', exact: true }).click()
  await palette.getByRole('button', { name: 'Uppercase' }).click()
  const replace = page.getByRole('group', { name: 'Step 1: Replace' })
  await replace.getByRole('textbox').first().fill('World')
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(status).toHaveText('Up to date')
  await replace.focus()
  await replace.press('Enter')
  const before = (await replace.boundingBox())!
  await replace.press('ArrowDown')
  await expect.poll(async () => (await replace.boundingBox())!.y).toBeGreaterThan(before.y)
  const moved = (await replace.boundingBox())!
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('text-transformer.session') ?? '')).toContain('"World"')
  await page.screenshot({ path: testInfo.outputPath('01-before-reload.png') })

  await page.reload()

  await expect(page.getByRole('textbox', { name: 'Input text' })).toHaveValue('Hello World')
  await expect(page.getByRole('group', { name: 'Step 1: Replace' }).getByRole('textbox').first()).toHaveValue('World')
  await expect(page.getByRole('group', { name: 'Step 2: Uppercase' })).toBeVisible()
  await expect(status).toHaveText('Not run yet')
  await expect.poll(async () => Math.round((await page.getByRole('group', { name: 'Step 1: Replace' }).boundingBox())!.y)).toBe(Math.round(moved.y))
  await page.screenshot({ path: testInfo.outputPath('02-after-reload.png') })
})
