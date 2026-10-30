import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

function latch() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => { release = resolve })
  return { promise, release }
}

test('metadata gates the workspace, preserves focus and saved work, and retries only on demand', async ({ page }) => {
  const first = latch()
  const retry = latch()
  let gets = 0
  let posts = 0
  page.on('request', (request) => { if (request.method() === 'POST') posts++ })
  await page.addInitScript(() => sessionStorage.setItem('text-transformer.session', 'untouched saved work'))
  await page.route('**/api/transformations', async (route) => {
    gets++
    if (gets === 1) {
      await first.promise
      await route.abort()
    } else {
      await retry.promise
      await route.continue()
    }
  })
  await page.goto('/')
  const input = page.getByRole('textbox', { name: 'Input text' })
  const palette = page.getByRole('region', { name: 'Add Step' })
  await expect(page.getByRole('status')).toHaveText('Loading Transformations…')
  await expect(input).toHaveCount(0)
  await expect(palette).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toHaveCount(0)
  // A stable sentinel verifies the gate does not programmatically move focus.
  await page.getByRole('heading', { level: 1 }).evaluate((element) => {
    element.setAttribute('tabindex', '-1')
    element.focus()
  })
  await page.keyboard.press('Control+Enter')
  first.release()
  const alert = page.getByRole('alert')
  await expect(alert).toContainText("Couldn't load Transformations")
  await expect(alert).toContainText("Couldn't reach the server.")
  await expect(alert).toContainText('Your saved work is kept and will come back once this loads.')
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
  expect(gets).toBe(1)
  expect(posts).toBe(0)
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  expect(scan.violations).toEqual([])
  expect(await page.evaluate(() => sessionStorage.getItem('text-transformer.session'))).toBe('untouched saved work')
  await alert.getByRole('button', { name: 'Retry' }).click()
  await expect(page.getByRole('status')).toHaveText('Loading Transformations…')
  await expect(alert).toHaveCount(0)
  await expect(input).toHaveCount(0)
  await expect(palette).toHaveCount(0)
  await page.keyboard.press('Meta+Enter')
  expect(await page.evaluate(() => sessionStorage.getItem('text-transformer.session'))).toBe('untouched saved work')
  retry.release()
  await expect(input).toBeVisible()
  await expect(page.getByRole('group', { name: 'Output', exact: true })).toBeVisible()
  await expect(palette).toBeVisible()
  expect(gets).toBe(2)
  expect(posts).toBe(0)
  // Reaching ready replaces the unreadable snapshot with a valid one.
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('text-transformer.session') ?? '{}').schemaVersion)).toBe(1)
})

test('storage access failure does not prevent ready', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('unavailable') } }))
  await page.goto('/')
  await expect(page.getByRole('textbox', { name: 'Input text' })).toBeVisible()
})
