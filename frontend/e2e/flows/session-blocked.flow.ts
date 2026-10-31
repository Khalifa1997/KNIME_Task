import { test, expect } from './fixtures'

const stored = JSON.stringify({
  schemaVersion: 1,
  inputText: 'Hello World',
  steps: [{ id: 'step-a', transformationId: 'vanished', values: {} }],
  fieldTypes: { vanished: {} },
  layout: { mode: 'desktop', positions: {}, viewport: null },
})

test('a Saved session that cannot be restored is kept until the user confirms Discard', async ({ page }, testInfo) => {
  await page.addInitScript((value) => {
    if (sessionStorage.getItem('e2e-seeded') === null) {
      sessionStorage.setItem('e2e-seeded', 'yes')
      sessionStorage.setItem('text-transformer.session', value)
    }
  }, stored)
  await page.goto('/')
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('“vanished”')
  await expect(page.getByRole('textbox', { name: 'Input text' })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('01-blocked.png') })

  await alert.getByRole('button', { name: 'Discard saved session and start fresh' }).click()
  const dialog = page.getByRole('dialog', { name: 'Discard saved session?' })
  await expect(dialog).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('02-confirm.png') })
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(alert).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('text-transformer.session'))).toBe(stored)

  await alert.getByRole('button', { name: 'Discard saved session and start fresh' }).click()
  await dialog.getByRole('button', { name: 'Discard', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Input text' })).toHaveValue('')
  await expect(alert).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('03-fresh.png') })
})
