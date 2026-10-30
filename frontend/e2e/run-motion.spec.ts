// The red flash is the assertion-backed evidence flow.
import './flows/run-motion.flow'
import { test, expect } from '@playwright/test'

async function addSteps(page: import('@playwright/test').Page, ...labels: string[]) {
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Input text' }).fill('Hello World')
  for (const label of labels) {
    await page.getByRole('region', { name: 'Add Step' }).getByRole('button', { name: label }).click()
  }
}

test('flashes every edge yellow after a successful run', async ({ page }) => {
  await addSteps(page, 'Uppercase', 'Lowercase')
  await page.getByRole('button', { name: 'Run' }).click()

  await expect(page.getByRole('status')).toHaveText('Up to date')
  await expect(page.locator('.flow-edge__flash--success')).toHaveCount(3)
  await expect(page.locator('.flow-edge__flash--danger')).toHaveCount(0)
})

test('under reduced motion the edges stop flowing and the result does not flash', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await addSteps(page, 'Uppercase')

  await expect(page.locator('.flow-edge__base--still')).toHaveCount(2)
  await page.getByRole('button', { name: 'Run' }).click()

  await expect(page.getByRole('status')).toHaveText('Up to date')
  await expect(page.locator('.flow-edge__flash')).toHaveCount(0)
})
