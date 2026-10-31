import { test, expect } from './fixtures'

test('lays the Chain out as a column on a phone and back as a row on a desktop', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto('/')
  const palette = page.getByRole('region', { name: 'Add Step' })
  await page.getByRole('textbox', { name: 'Input text' }).fill('a')
  await palette.getByRole('button', { name: 'Append', exact: true }).click()
  await page.getByRole('group', { name: 'Step 1: Append', exact: true }).getByRole('textbox').fill('b')
  await palette.getByRole('button', { name: 'Uppercase', exact: true }).click()
  const append = page.getByRole('group', { name: 'Step 1: Append', exact: true })
  const upper = page.getByRole('group', { name: 'Step 2: Uppercase', exact: true })
  await expect(append.getByRole('button', { name: /later/ })).toHaveText('↓')
  await expect.poll(async () => (await upper.boundingBox())!.y).toBeGreaterThan((await append.boundingBox())!.y)
  await page.screenshot({ path: testInfo.outputPath('01-phone-column.png') })

  await page.setViewportSize({ width: 1200, height: 800 })
  await expect(append.getByRole('button', { name: /later/ })).toHaveText('→')
  await expect.poll(async () => (await upper.boundingBox())!.x).toBeGreaterThan((await append.boundingBox())!.x)
  await page.screenshot({ path: testInfo.outputPath('02-desktop-row.png') })
})
