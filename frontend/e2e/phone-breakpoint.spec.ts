import { test, expect, devices, type Page } from '@playwright/test'

// Drives the window size itself, so both projects use the same plain desktop browser.
test.use({ ...devices['Desktop Chrome'] })

const boxOf = async (page: Page, name: string) =>
  (await page.getByRole('group', { name, exact: true }).boundingBox())!

test('icon buttons stay 28px with a mouse', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 })
  await page.goto('/')
  await page.getByRole('region', { name: 'Add Step' }).getByRole('button', { name: 'Uppercase', exact: true }).click()
  // Computed size, because the canvas zoom scales a bounding box.
  const size = await page.getByRole('button', { name: /^Delete Step 1/ }).evaluate((button) => {
    const { width, height } = getComputedStyle(button)
    return { width, height }
  })
  expect(size).toEqual({ width: '28px', height: '28px' })
})

test('crossing the 800px breakpoint re-lays out to the new mode and reframes', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 })
  await page.goto('/')
  await page.getByRole('region', { name: 'Add Step' }).getByRole('button', { name: 'Uppercase', exact: true }).click()
  const step = page.getByRole('group', { name: 'Step 1: Uppercase', exact: true })
  const input = page.getByRole('group', { name: 'Input text', exact: true })
  await expect(step.getByRole('button', { name: /earlier/ })).toHaveText('←')
  expect((await boxOf(page, 'Step 1: Uppercase')).x).toBeGreaterThan((await boxOf(page, 'Input text')).x)

  await page.setViewportSize({ width: 600, height: 800 })
  await expect(step.getByRole('button', { name: /earlier/ })).toHaveText('↑')
  await expect.poll(async () => {
    const inputBox = (await input.boundingBox())!
    const stepBox = (await step.boundingBox())!
    return Math.abs(stepBox.x - inputBox.x) < 2 && stepBox.y > inputBox.y + inputBox.height
  }).toBe(true)
  const centre = async () => {
    const box = (await input.boundingBox())!
    return Math.round(box.x + box.width / 2)
  }
  await expect.poll(centre).toBeGreaterThanOrEqual(299)
  await expect.poll(centre).toBeLessThanOrEqual(301)

  await page.setViewportSize({ width: 1200, height: 800 })
  await expect(step.getByRole('button', { name: /earlier/ })).toHaveText('←')
  await expect.poll(async () => {
    const inputBox = (await input.boundingBox())!
    const stepBox = (await step.boundingBox())!
    return stepBox.x > inputBox.x && Math.abs(stepBox.y - inputBox.y) < 2
  }).toBe(true)
})
