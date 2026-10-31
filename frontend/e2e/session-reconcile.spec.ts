import { test, expect, devices, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const KEY = 'text-transformer.session'

// Drives the window size itself, so both projects use the same plain desktop browser.
test.use({ ...devices['Desktop Chrome'] })

const snapshot = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  inputText: 'Hello World',
  steps: [{ id: 'step-a', transformationId: 'replace', values: { search: 'World', replacement: '' } }],
  fieldTypes: { replace: { search: 'text', replacement: 'text' } },
  layout: { mode: 'desktop', positions: {}, viewport: null },
  ...overrides,
})

// Seeds the stored Saved session once, before the app's own scripts run (reloads keep what is stored).
async function seedSession(page: Page, stored: string) {
  await page.addInitScript(([key, value]) => {
    if (sessionStorage.getItem('e2e-seeded') === null) {
      sessionStorage.setItem('e2e-seeded', 'yes')
      sessionStorage.setItem(key!, value!)
    }
  }, [KEY, stored])
}

const storedSession = (page: Page) => page.evaluate((key) => sessionStorage.getItem(key), KEY)

test.describe('a blocked restore', () => {
  test('names the missing Transformation, keeps the snapshot, and discards only after confirmation', async ({ page }) => {
    const stored = JSON.stringify(snapshot({
      steps: [{ id: 'step-a', transformationId: 'vanished', values: {} }],
      fieldTypes: { vanished: {} },
    }))
    await seedSession(page, stored)
    let metadataRequests = 0
    page.on('request', (request) => { if (request.url().endsWith('/api/transformations')) metadataRequests++ })
    await page.goto('/')

    const alert = page.getByRole('alert')
    await expect(alert).toContainText('Couldn’t restore your saved session')
    await expect(alert).toContainText('“vanished”')
    await expect(page.getByRole('textbox', { name: 'Input text' })).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Add Step' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Run', exact: true })).toHaveCount(0)
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
    expect(await storedSession(page)).toBe(stored)

    await alert.getByRole('button', { name: 'Retry' }).click()
    await expect(alert).toContainText('“vanished”')
    expect(metadataRequests).toBe(2)
    expect(await storedSession(page)).toBe(stored)

    await alert.getByRole('button', { name: 'Discard saved session and start fresh' }).click()
    const dialog = page.getByRole('dialog', { name: 'Discard saved session?' })
    await expect(dialog).toBeVisible()
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([])
    expect(await storedSession(page)).toBe(stored)
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toBeHidden()
    await expect(alert).toBeVisible()
    expect(await storedSession(page)).toBe(stored)

    await alert.getByRole('button', { name: 'Discard saved session and start fresh' }).click()
    await dialog.getByRole('button', { name: 'Discard', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Input text' })).toHaveValue('')
    await expect(page.getByRole('group', { name: /^Step \d/ })).toHaveCount(0)
    await expect(alert).toHaveCount(0)
    await expect(page.getByRole('status').filter({ hasText: /Not run yet/ })).toBeVisible()
    await expect.poll(async () => JSON.parse((await storedSession(page)) ?? '{}')).toMatchObject({ schemaVersion: 1, inputText: '', steps: [] })
  })

  for (const [name, stored, reason] of [
    ['a changed Field type', JSON.stringify(snapshot({ fieldTypes: { replace: { search: 'integer', replacement: 'text' } } })), 'The Field “Search” of Replace changed from integer to text'],
    ['an unknown schema version', JSON.stringify(snapshot({ schemaVersion: 2 })), 'schema version 2'],
    ['a malformed snapshot', '{not json', 'damaged'],
  ] as const) {
    test(`is blocked by ${name} and leaves the snapshot untouched`, async ({ page }) => {
      await seedSession(page, stored)
      await page.goto('/')
      await expect(page.getByRole('alert')).toContainText(reason)
      await expect(page.getByRole('textbox', { name: 'Input text' })).toHaveCount(0)
      expect(await storedSession(page)).toBe(stored)
    })
  }
})

test('added and removed Fields are adjusted visibly, then the reconciled session is saved', async ({ page }) => {
  await seedSession(page, JSON.stringify(snapshot({
    steps: [{ id: 'step-a', transformationId: 'replace', values: { search: 'World', obsolete: 'x' } }],
    fieldTypes: { replace: { search: 'text', obsolete: 'text' } },
  })))
  await page.goto('/')

  const notice = page.locator('.banner[role="status"]')
  await expect(notice).toContainText('Replace: added Replacement; removed obsolete.')
  const replace = page.getByRole('group', { name: 'Step 1: Replace' })
  await expect(page.getByRole('textbox', { name: 'Input text' })).toHaveValue('Hello World')
  await expect(replace.getByRole('textbox', { name: 'Search' })).toHaveValue('World')
  await expect(replace.getByRole('textbox', { name: 'Replacement' })).toHaveValue('')
  await expect(page.getByRole('status').filter({ hasText: 'Not run yet' })).toBeVisible()
  await expect.poll(async () => JSON.parse((await storedSession(page)) ?? '{}').fieldTypes).toEqual({ replace: { search: 'text', replacement: 'text' } })
  expect(JSON.parse((await storedSession(page))!).steps[0].values).toEqual({ search: 'World', replacement: '' })
  expect(await storedSession(page)).not.toContain('Replace: added')
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).exclude('.vue-flow__edges').analyze()).violations).toEqual([])

  await page.reload()
  await expect(replace).toBeVisible()
  await expect(notice).toHaveCount(0)
})

test('a session over the limits and a removed Choice are restored as they are', async ({ page }) => {
  // The real backend has no select Field, so the metadata gains one and a lower limit.
  await page.route('**/api/transformations', async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    body.limits = { maxInputLength: 10, maxSteps: 2 }
    body.transformations.push({
      id: 'pick', label: 'Pick', description: 'Picks one.',
      fields: [{ name: 'mode', label: 'Mode', type: 'select', required: true, defaultValue: 'a', min: null, max: null, options: [{ value: 'a', label: 'A' }] }],
    })
    await route.fulfill({ response, json: body })
  })
  const inputText = 'x'.repeat(25)
  await seedSession(page, JSON.stringify(snapshot({
    inputText,
    steps: [
      { id: 'step-a', transformationId: 'uppercase', values: {} },
      { id: 'step-b', transformationId: 'pick', values: { mode: 'gone' } },
      { id: 'step-c', transformationId: 'lowercase', values: {} },
    ],
    fieldTypes: { uppercase: {}, pick: { mode: 'select' }, lowercase: {} },
  })))
  await page.goto('/')

  await expect(page.getByRole('textbox', { name: 'Input text' })).toHaveValue(inputText)
  await expect(page.getByText('25 / 10')).toBeVisible()
  await expect(page.getByRole('group', { name: /^Step \d/ })).toHaveCount(3)
  await expect(page.getByRole('combobox', { name: 'Mode' })).toHaveValue('gone')
  await expect(page.getByRole('option', { name: 'gone (no longer available)' })).toBeDisabled()
  await expect(page.getByRole('region', { name: 'Add Step' }).getByRole('button', { name: 'Uppercase' })).toBeDisabled()
  // No Step errors are made up, and nothing is run.
  await expect(page.locator('.node--invalid')).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'Not run yet' })).toBeVisible()

  await page.getByRole('button', { name: 'Move Step 3: Lowercase earlier' }).click()
  await expect(page.getByRole('group', { name: 'Step 2: Lowercase' })).toBeVisible()
  await page.getByRole('button', { name: /^Delete Step 1/ }).click()
  await expect(page.getByRole('group', { name: /^Step \d/ })).toHaveCount(2)
  // Add Step stays disabled at the limit, and comes back below it.
  await expect(page.getByRole('region', { name: 'Add Step' }).getByRole('button', { name: 'Uppercase' })).toBeDisabled()
  await page.getByRole('button', { name: /^Delete Step 1/ }).click()
  await expect(page.getByRole('region', { name: 'Add Step' }).getByRole('button', { name: 'Uppercase' })).toBeEnabled()
  await expect(page.getByRole('textbox', { name: 'Input text' })).toHaveValue(inputText)
})

test('the Input text and Chain come back across the 800px breakpoint, laid out for the current mode', async ({ page }) => {
  await seedSession(page, JSON.stringify(snapshot({
    steps: [
      { id: 'step-a', transformationId: 'replace', values: { search: 'World', replacement: 'There' } },
      { id: 'step-b', transformationId: 'uppercase', values: {} },
    ],
    fieldTypes: { replace: { search: 'text', replacement: 'text' }, uppercase: {} },
    layout: {
      mode: 'desktop',
      positions: { input: { x: 0, y: 0 }, 'step-a': { x: 900, y: 40 }, 'step-b': { x: 1300, y: 40 } },
      viewport: { x: 5, y: 5, zoom: 0.5 },
    },
  })))
  await page.setViewportSize({ width: 600, height: 800 })
  await page.goto('/')

  const input = page.getByRole('group', { name: 'Input text', exact: true })
  const first = page.getByRole('group', { name: 'Step 1: Replace', exact: true })
  const second = page.getByRole('group', { name: 'Step 2: Uppercase', exact: true })
  await expect(page.getByRole('textbox', { name: 'Input text' })).toHaveValue('Hello World')
  await expect(first.getByRole('textbox', { name: 'Replacement' })).toHaveValue('There')
  await expect(first.getByRole('button', { name: /earlier/ })).toHaveText('↑')
  await expect.poll(async () => {
    const inputBox = (await input.boundingBox())!
    const firstBox = (await first.boundingBox())!
    const secondBox = (await second.boundingBox())!
    return Math.abs(firstBox.x - inputBox.x) < 2 && firstBox.y > inputBox.y + inputBox.height && secondBox.y > firstBox.y + firstBox.height
  }).toBe(true)
  await expect.poll(async () => JSON.parse((await storedSession(page)) ?? '{}').layout).toMatchObject({ mode: 'phone', positions: {} })
})
