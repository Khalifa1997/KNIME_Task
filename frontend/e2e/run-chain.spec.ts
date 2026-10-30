import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const WCAG_22_A_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa']

test('adds Steps from the toolbar, runs them, and shows each result and the Output', async ({
  page,
}) => {
  await page.goto('/')
  const palette = page.getByRole('region', { name: 'Add Step' })
  const status = page.getByRole('status')
  await expect(status).toHaveText('Not run yet')

  await page.getByRole('textbox', { name: 'Input text' }).fill('Hello World')
  await palette.getByRole('button', { name: 'Uppercase' }).click()
  await palette.getByRole('button', { name: 'Lowercase' }).click()

  // The new Step is focused, and every Step says it has not run.
  await expect(page.getByRole('group', { name: 'Step 2: Lowercase' })).toBeFocused()
  await expect(page.getByText('Run to see it')).toHaveCount(2)
  // Edges are wired in Chain order, and named by position rather than by Step ids.
  for (const edge of ['Input text to Step 1', 'Step 1 to Step 2', 'Step 2 to Output']) {
    await expect(page.getByRole('img', { name: edge, exact: true })).toBeAttached()
  }

  await page.getByRole('button', { name: 'Run' }).click()

  await expect(status).toHaveText('Up to date')
  const uppercase = page.getByRole('group', { name: 'Step 1: Uppercase' })
  const lowercase = page.getByRole('group', { name: 'Step 2: Lowercase' })
  await expect(uppercase).toContainText('HELLO WORLD')
  await expect(lowercase).toContainText('hello world')
  await expect(page.getByRole('group', { name: 'Output' })).toContainText('hello world')

  // Editing marks the results out of date; undoing the edit brings "Up to date" back.
  const input = page.getByRole('textbox', { name: 'Input text' })
  await input.fill('Hello Worlds')
  await expect(status).toHaveText('Changed since the last run')
  await input.fill('Hello World')
  await expect(status).toHaveText('Up to date')
})

test('runs with Ctrl+Enter from inside the Input text, and an empty Chain outputs the Input text', async ({
  page,
}) => {
  await page.goto('/')
  const input = page.getByRole('textbox', { name: 'Input text' })
  await input.fill('Just this')

  await input.press('Control+Enter')

  await expect(page.getByRole('status')).toHaveText('Up to date')
  await expect(page.getByRole('group', { name: 'Output' })).toContainText('Just this')
  await expect(input).toHaveValue('Just this')
})

test('counts the Input text against the limit without cutting it off', async ({ page }) => {
  await page.goto('/')
  const input = page.getByRole('textbox', { name: 'Input text' })

  await input.fill('x'.repeat(3001))

  await expect(page.getByText('3,001 / 3,000')).toBeVisible()
  await expect(input).toHaveValue('x'.repeat(3001))
})

test('edits the Fields of a Replace Step and sees the changed Output', async ({ page }) => {
  await page.goto('/')

  const palette = page.getByRole('region', { name: 'Add Step' })
  await page.getByRole('textbox', { name: 'Input text' }).fill('a-b-a')
  await palette.getByRole('button', { name: 'Replace' }).click()

  const step = page.getByRole('group', { name: 'Step 1: Replace' })
  await expect(step.getByRole('textbox', { name: 'Search' })).toBeFocused()
  await step.getByRole('textbox', { name: 'Search' }).fill('a')
  const replacement = step.getByRole('textbox', { name: 'Replacement' })
  await replacement.fill('x')
  const position = await step.getAttribute('style')
  await replacement.press('ArrowLeft')
  await replacement.press('ArrowRight')
  await replacement.press('Space')
  await replacement.press('Backspace')
  await replacement.press('Delete')
  await expect(replacement).toHaveValue('x')
  await expect(step).toHaveAttribute('style', position ?? '')
  // The global shortcut still runs from inside a Field.
  await replacement.press('Control+Enter')

  await expect(page.getByRole('status')).toHaveText('Up to date')
  await expect(step).toContainText('x-b-x')
  await expect(page.getByRole('group', { name: 'Output' })).toContainText('x-b-x')
})

test('has no WCAG 2.2 A or AA violations on the canvas with results', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Input text' }).fill('Hello')
  await page.getByRole('region', { name: 'Add Step' }).getByRole('button', { name: 'Uppercase' }).click()
  await page.getByRole('button', { name: 'Run' }).click()
  await expect(page.getByRole('status')).toHaveText('Up to date')

  const results = await new AxeBuilder({ page }).withTags(WCAG_22_A_AA).analyze()

  expect(results.violations).toEqual([])
})
