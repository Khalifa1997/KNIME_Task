import { test, expect, devices } from '@playwright/test'

// Drives the window size itself, so both projects use the same plain desktop browser.
test.use({ ...devices['Desktop Chrome'] })

test('the phone column stays centred when the window is resized within phone widths', async ({ page }) => {
  await page.setViewportSize({ width: 440, height: 900 })
  await page.goto('/')
  const input = page.getByRole('group', { name: 'Input text', exact: true })
  const centre = async () => {
    const box = (await input.boundingBox())!
    return Math.round(box.x + box.width / 2)
  }
  await expect.poll(centre).toBe(220)

  for (const width of [768, 600, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await expect.poll(centre).toBeGreaterThanOrEqual(Math.floor(width / 2) - 1)
    await expect.poll(centre).toBeLessThanOrEqual(Math.ceil(width / 2) + 1)
  }
})
