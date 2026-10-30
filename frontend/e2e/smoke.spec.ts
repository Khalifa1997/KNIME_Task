import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const WCAG_22_A_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa']

test('shows one Add Step button per Transformation, described by its description', async ({
  page,
}) => {
  await page.goto('/')

  const palette = page.getByRole('region', { name: 'Add Step' })
  await expect(palette.getByRole('button')).toHaveText(['Uppercase', 'Lowercase'])
  await expect(palette.getByRole('button', { name: 'Uppercase' })).toHaveAccessibleDescription(
    'Converts the text to upper case.',
  )
})

test('has no WCAG 2.2 A or AA violations', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Uppercase' })).toBeVisible()

  const results = await new AxeBuilder({ page }).withTags(WCAG_22_A_AA).analyze()

  expect(results.violations).toEqual([])
})
