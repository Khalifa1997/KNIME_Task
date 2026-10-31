import { test, expect } from './fixtures'

const stored = JSON.stringify({
  schemaVersion: 1,
  inputText: 'Hello World',
  steps: [{ id: 'step-a', transformationId: 'replace', values: { search: 'World', obsolete: 'x' } }],
  fieldTypes: { replace: { search: 'text', obsolete: 'text' } },
  layout: { mode: 'desktop', positions: {}, viewport: null },
})

test('a restored Saved session lists the Field adjustments, and keeps what still fits', async ({ page }, testInfo) => {
  await page.addInitScript((value) => {
    if (sessionStorage.getItem('e2e-seeded') === null) {
      sessionStorage.setItem('e2e-seeded', 'yes')
      sessionStorage.setItem('text-transformer.session', value)
    }
  }, stored)
  await page.goto('/')
  const notice = page.locator('.banner[role="status"]')
  await expect(notice).toContainText('Replace: added Replacement; removed obsolete.')
  const replace = page.getByRole('group', { name: 'Step 1: Replace' })
  await expect(replace.getByRole('textbox', { name: 'Search' })).toHaveValue('World')
  await expect(page.getByRole('textbox', { name: 'Input text' })).toHaveValue('Hello World')
  await expect(page.getByRole('status').filter({ hasText: 'Not run yet' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('01-adjusted.png') })

  await page.reload()
  await expect(replace).toBeVisible()
  await expect(notice).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('02-after-reload.png') })
})
