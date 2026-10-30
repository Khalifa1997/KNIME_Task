import { test, expect } from './fixtures'

test('keeps the phone column centred as the window grows and shrinks', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 440, height: 800 })
  await page.goto('/')
  const input = page.getByRole('group', { name: 'Input text', exact: true })
  const centre = async () => {
    const box = (await input.boundingBox())!
    return Math.round(box.x + box.width / 2)
  }
  await expect.poll(centre).toBe(220)
  await page.screenshot({ path: testInfo.outputPath('01-440.png') })

  await page.setViewportSize({ width: 768, height: 800 })
  await expect.poll(centre).toBe(384)
  await page.screenshot({ path: testInfo.outputPath('02-768.png') })

  await page.setViewportSize({ width: 600, height: 800 })
  await expect.poll(centre).toBe(300)
  await page.screenshot({ path: testInfo.outputPath('03-600.png') })
})
