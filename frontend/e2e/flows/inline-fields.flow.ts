import { test, expect } from './fixtures'

test('edits Replace Fields, runs the Chain, and clears the optional Replacement to delete matches', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Input text' }).fill('a-b-a')
  await page.getByRole('region', { name: 'Add Step' }).getByRole('button', { name: 'Replace' }).click()

  const step = page.getByRole('group', { name: 'Step 1: Replace' })
  const replacement = step.getByRole('textbox', { name: 'Replacement' })
  const output = page.getByRole('group', { name: 'Output' })
  await step.getByRole('textbox', { name: 'Search' }).fill('a')
  await replacement.fill('x')
  await expect(page.getByRole('status')).toHaveText('Not run yet')
  await page.screenshot({ path: testInfo.outputPath('01-fields-ready.png') })

  await replacement.press('Control+Enter')
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await expect(output).toContainText('x-b-x')
  await page.screenshot({ path: testInfo.outputPath('02-replaced.png') })

  await replacement.fill('')
  await expect(page.getByRole('status')).toHaveText('Changed since the last run')
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await expect(step).toContainText('-b-')
  await expect(output).toContainText('-b-')
  await page.screenshot({ path: testInfo.outputPath('03-empty-replacement.png') })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Fit View' }).click()
  await expect(output).toContainText('-b-')
  await page.screenshot({ path: testInfo.outputPath('04-phone.png') })
})
