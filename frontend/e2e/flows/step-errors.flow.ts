import { test, expect } from './fixtures'
import problem from '../../../contract/post-chain-run.two-broken-steps.422.json' with { type: 'json' }

// Rehearsed with the isolated issue-25 playwright-cli session against the lane's real jar.
test('shows both broken Steps while preserving focus and leaves a newly added Step clean', async ({ page, expectDomainRejection }, testInfo) => {
  await page.goto('/')
  const add = page.getByRole('region', { name: 'Add Step' }).getByRole('button', { name: 'Replace' })
  const first = page.getByRole('group', { name: 'Step 1: Replace' })
  const second = page.getByRole('group', { name: 'Step 2: Replace' })
  const status = page.getByRole('status')
  await page.getByRole('textbox', { name: 'Input text' }).fill('a')
  await add.click()
  await expect(first.getByRole('textbox', { name: 'Search' })).toBeFocused()
  await first.getByRole('textbox', { name: 'Search' }).fill('a')
  await first.getByRole('textbox', { name: 'Replacement' }).fill('b')
  await add.click()
  await expect(second.getByRole('textbox', { name: 'Search' })).toBeFocused()
  const focused = second.getByRole('textbox', { name: 'Search' })
  await focused.fill('b')
  await second.getByRole('textbox', { name: 'Replacement' }).fill('c')
  await focused.press('Control+Enter')
  await expect(status).toHaveText('Up to date')
  await expect(page.getByRole('group', { name: 'Output' }).locator('.node__result')).toHaveText('c')
  await page.getByRole('button', { name: 'Fit View', exact: true }).click()
  await page.screenshot({ path: testInfo.outputPath('01-successful-results.png') })

  await first.getByRole('textbox', { name: 'Search' }).fill('')
  await focused.fill('')
  // This assertion is false before the Run; old results must not mark edited Fields invalid.
  await expect(page.locator('.node--invalid')).toHaveCount(0)
  const rejected = page.waitForResponse((response) => response.url().endsWith('/api/chain/run') && response.status() === 422)
  await focused.press('Control+Enter')
  const response = await rejected
  const steps = response.request().postDataJSON().steps as { id: string }[]
  await expectDomainRejection(response, {
    ...problem,
    errors: problem.errors.map((error, index) => ({ ...error, stepId: steps[index]!.id })),
  })
  await expect(status).toHaveText(problem.detail)
  await expect(focused).toBeFocused()
  await expect(page.locator('.node--invalid')).toHaveCount(2)
  for (const step of [first, second]) {
    await expect(step.getByRole('textbox', { name: 'Search' })).toHaveAccessibleDescription(problem.errors[0]!.detail)
    await expect(step.locator('.node__result')).toHaveText('Run to see it')
  }
  await expect(page.getByRole('group', { name: 'Output' })).toContainText('Press Run to see the Output.')
  await page.screenshot({ path: testInfo.outputPath('02-two-rejected-steps.png') })

  await add.click()
  const third = page.getByRole('group', { name: 'Step 3: Replace' })
  await expect(third.getByRole('textbox', { name: 'Search' })).toBeFocused()
  await expect(third.getByRole('textbox', { name: 'Search' })).not.toHaveAttribute('aria-invalid')
  await expect(third.locator('.node')).not.toHaveClass(/node--invalid/)
  await page.getByRole('button', { name: 'Fit View', exact: true }).click()
  await page.screenshot({ path: testInfo.outputPath('03-clean-new-step.png') })
  await expect(page.locator('.node--invalid')).toHaveCount(2)
  await expect(status).toHaveText(problem.detail)
})
