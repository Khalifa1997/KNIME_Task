import AxeBuilder from '@axe-core/playwright'
import { test, expect } from './fixtures'

// Rehearsed with playwright-cli -s=issue27 against this worktree's jar on 8027.
test('retains results and prior Step errors without active marks after a Run failure', async ({ page, expectHttpFailure, expectDomainRejection, consoleErrors }, testInfo) => {
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Input text', exact: true }).fill('a')
  await page.getByRole('region', { name: 'Add Step' }).getByRole('button', { name: 'Replace', exact: true }).click()
  const step = page.getByRole('group', { name: 'Step 1: Replace' })
  const search = step.getByRole('textbox', { name: 'Search', exact: true })
  const replacement = step.getByRole('textbox', { name: 'Replacement', exact: true })
  const status = page.getByRole('status')
  const output = page.getByRole('group', { name: 'Output' }).locator('.node__result')
  await search.fill('a')
  await replacement.fill('b')
  await search.press('Control+Enter')
  await expect(status).toHaveText('Up to date')
  await expect(output).toHaveText('b')
  await page.screenshot({ path: testInfo.outputPath('01-results.png') })

  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  let sends = 0
  const serverProblem = { title: 'Internal Server Error', status: 500, detail: 'Something went wrong.' }
  await page.route('**/api/chain/run', async route => {
    sends++
    await held
    await route.fulfill({ status: 500, contentType: 'application/problem+json', body: JSON.stringify(serverProblem) })
  })
  const failed = page.waitForResponse(response => response.url().endsWith('/api/chain/run') && response.status() === 500)
  await search.press('Control+Enter')
  await expect(status).toHaveText('Running…')
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeDisabled()
  await search.fill('edited while pending')
  await search.press('Control+Enter')
  await expect(status).toHaveText('Still running…', { timeout: 7_000 })
  expect(sends).toBe(1)
  release()
  await expectHttpFailure(await failed, 500, serverProblem)
  await expect(status).toHaveText('The server had a problem. Try again')
  await expect(status).toHaveAttribute('data-state', 'failed')
  await expect(search).toBeFocused()
  await expect(search).toHaveValue('edited while pending')
  await expect(output).toHaveText('b')
  await expect(output).toHaveClass(/is-dimmed/)
  await expect(step.locator('.node__result')).toHaveClass(/is-dimmed/)
  await expect(page.locator('.node--invalid')).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('02-run-failure.png') })

  await page.unroute('**/api/chain/run')
  await search.fill('a')
  await search.press('Control+Enter')
  await expect(status).toHaveText('Up to date')
  await expect(output).not.toHaveClass(/is-dimmed/)
  await page.screenshot({ path: testInfo.outputPath('03-recovered.png') })

  // Real 422, not an injected Field error.
  await search.fill('')
  const rejected = page.waitForResponse(response => response.url().endsWith('/api/chain/run') && response.status() === 422)
  await search.press('Control+Enter')
  const response = await rejected
  const id = response.request().postDataJSON().steps[0].id as string
  const detail = 'Search is required.'
  await expectDomainRejection(response, {
    type: 'about:blank', status: 422, title: 'Chain could not run', detail: '1 problem stops the Chain from running.',
    errors: [{ stepId: id, field: 'search', code: 'required', detail }],
  })
  await expect(page.locator('.node--invalid')).toHaveCount(1)
  await expect(search).toBeFocused()
  await expect(step.locator('.error-messages')).toHaveText(detail)

  const badRequest = { status: 400, detail: 'Invalid value at steps.' }
  await page.route('**/api/chain/run', route => route.fulfill({ status: 400, contentType: 'application/problem+json', body: JSON.stringify(badRequest) }))
  const bad = page.waitForResponse(response => response.url().endsWith('/api/chain/run') && response.status() === 400)
  await search.press('Control+Enter')
  await expectHttpFailure(await bad, 400, badRequest)
  await expect(status).toHaveText('Something went wrong. Try again')
  await expect(step.locator('.error-messages')).toHaveText(detail)
  await expect(step.locator('.error-messages')).toHaveCSS('opacity', '0.7')
  await expect(page.locator('.node--invalid')).toHaveCount(0)
  await expect(search).toBeFocused()
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa']).analyze()).violations).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('04-retained-step-errors.png') })

  await page.unroute('**/api/chain/run')
  await page.route('**/api/chain/run', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"output":false,"steps":[]}' }))
  await search.press('Control+Enter')
  await expect(status).toHaveText('Something went wrong. Try again')
  await expect(step.locator('.error-messages')).toHaveText(detail)
  await page.unroute('**/api/chain/run')
  await page.route('**/api/chain/run', route => route.abort('failed'))
  const unreachable = page.waitForEvent('requestfailed', request => request.url().endsWith('/api/chain/run'))
  await search.press('Control+Enter')
  const failedRequest = await unreachable
  expect(failedRequest.method()).toBe('POST')
  expect(failedRequest.failure()?.errorText).toBe('net::ERR_FAILED')
  await expect(status).toHaveText("Couldn't reach the server. Try again")
  // Consume exactly one Chromium resource error, backed by the asserted failed request above.
  const expectedConsoleError = JSON.stringify({ text: 'Failed to load resource: net::ERR_FAILED', url: failedRequest.url() })
  await expect.poll(() => consoleErrors.includes(expectedConsoleError)).toBe(true)
  consoleErrors.splice(consoleErrors.indexOf(expectedConsoleError), 1)
  await expect(step.locator('.error-messages')).toHaveText(detail)
  await expect(search).toBeFocused()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeInViewport()
  await expect(status).toBeInViewport()
  await page.screenshot({ path: testInfo.outputPath('05-phone.png') })
  await expect(page.locator('.node--invalid')).toHaveCount(0)
  await expect(search).toBeFocused()
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa']).analyze()).violations).toEqual([])
})
