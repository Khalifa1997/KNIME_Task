import { test, expect } from './fixtures'

test('metadata loading, error and manual Retry to the real canvas', async ({ page }, testInfo) => {
  let release!: () => void
  const pending = new Promise<void>((resolve) => { release = resolve })
  let requests = 0
  await page.route('**/api/transformations', async (route) => {
    requests++
    if (requests === 1) {
      await pending
      // Malformed 200 exercises the failure card without an expected HTTP console error.
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    } else {
      await route.continue()
    }
  })
  await page.goto('/')
  const input = page.getByRole('textbox', { name: 'Input text' })
  const palette = page.getByRole('region', { name: 'Add Step' })
  await expect(page.getByRole('status')).toHaveText('Loading Transformations…')
  await expect(input).toHaveCount(0)
  await expect(palette).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('01-loading.png') })
  release()
  const alert = page.getByRole('alert')
  await expect(alert).toContainText("Couldn't load Transformations")
  await expect(alert).toContainText('Something went wrong.')
  await expect(input).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('02-error-card.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(alert.getByRole('button', { name: 'Retry' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('03-phone-error-card.png') })
  await page.setViewportSize({ width: 1280, height: 800 })
  await alert.getByRole('button', { name: 'Retry' }).click()
  await expect(input).toBeVisible()
  await expect(page.getByRole('group', { name: 'Output', exact: true })).toBeVisible()
  await expect(palette.getByRole('button', { name: 'Uppercase' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('04-ready.png') })
  expect(requests).toBe(2)
  await expect(alert).toHaveCount(0)
  await expect(palette).toBeVisible()
})
