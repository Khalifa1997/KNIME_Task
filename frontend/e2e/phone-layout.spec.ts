import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const WCAG_22_A_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa']

const boxOf = async (page: Page, name: string) =>
  (await page.getByRole('group', { name, exact: true }).boundingBox())!

test.describe('on a phone', () => {
  test.beforeEach(({}, testInfo) => {
    // eslint-disable-next-line playwright/no-skipped-test -- these run only in the phone project
    test.skip(testInfo.project.name !== 'phone', 'phone project only')
  })

  test('adds, edits, reorders and runs a column of Steps, and passes an axe scan', async ({ page }) => {
    await page.goto('/')
    const palette = page.getByRole('region', { name: 'Add Step' })
    await page.getByRole('textbox', { name: 'Input text' }).fill('a')
    await palette.getByRole('button', { name: 'Append', exact: true }).tap()
    await page.getByRole('group', { name: 'Step 1: Append', exact: true }).getByRole('textbox').fill('b')
    await palette.getByRole('button', { name: 'Uppercase', exact: true }).tap()

    // A column: same x, Steps stacked downwards, all within the phone's width.
    const viewportWidth = page.viewportSize()!.width
    await expect.poll(async () => {
      const input = await boxOf(page, 'Input text')
      const append = await boxOf(page, 'Step 1: Append')
      const upper = await boxOf(page, 'Step 2: Uppercase')
      return (
        Math.abs(append.x - input.x) < 3 &&
        Math.abs(upper.x - input.x) < 3 &&
        append.y > input.y + input.height &&
        upper.y > append.y + append.height &&
        input.x >= 0 &&
        input.x + input.width <= viewportWidth
      )
    }).toBe(true)

    // Handles sit at the top and bottom of each node.
    const step = page.getByRole('group', { name: 'Step 1: Append', exact: true })
    await expect(step.locator('.vue-flow__handle.target')).toHaveClass(/top/)
    await expect(step.locator('.vue-flow__handle.source')).toHaveClass(/bottom/)

    // Reorder with the ↑ / ↓ buttons.
    const later = step.getByRole('button', { name: /later/ })
    await expect(later).toHaveText('↓')
    await expect(step.getByRole('button', { name: /earlier/ })).toHaveText('↑')
    await later.tap()
    await expect(page.locator('#chain-announcement')).toHaveText('Moved Append to position 2 of 2.')

    await page.getByRole('button', { name: 'Run', exact: true }).tap()
    await expect(page.getByRole('status')).toHaveText('Up to date')
    await expect(page.getByRole('group', { name: 'Output', exact: true })).toContainText('Ab')

    const results = await new AxeBuilder({ page }).withTags(WCAG_22_A_AA).analyze()
    expect(results.violations).toEqual([])
  })

  test('the Add Step chips sit in one row that scrolls sideways', async ({ page }) => {
    await page.goto('/')
    const chips = page.getByRole('region', { name: 'Add Step' }).getByRole('button')
    await expect(chips.first()).toBeVisible()
    const tops = await chips.evaluateAll((buttons) => buttons.map((button) => Math.round(button.getBoundingClientRect().top)))
    expect(new Set(tops).size).toBe(1)
    const list = page.locator('.palette__list')
    expect(await list.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)
    expect(await list.evaluate((element) => getComputedStyle(element).overflowX)).toBe('auto')
  })

  test('buttons are at least 44px square under a coarse pointer', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('region', { name: 'Add Step' }).getByRole('button', { name: 'Uppercase', exact: true }).tap()
    const targets = [
      page.locator('.chip').first(),
      page.getByRole('button', { name: 'Run', exact: true }),
      page.getByRole('button', { name: /^Delete Step 1/ }),
    ]
    for (const target of targets) {
      // Computed size, because the canvas zoom scales a bounding box.
      const size = await target.evaluate((element) => {
        const { minWidth, minHeight } = getComputedStyle(element)
        return { minWidth, minHeight }
      })
      expect(size).toEqual({ minWidth: '44px', minHeight: '44px' })
    }
  })
})
