import { test, expect } from './fixtures'
import stepErrors from '../../../contract/post-chain-run.two-broken-steps.422.json' with { type: 'json' }

test('flashes red up to the edge entering the first failing Step', async ({ page, expectDomainRejection }, testInfo) => {
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Input text' }).fill('Hello World')
  const palette = page.getByRole('region', { name: 'Add Step' })
  for (const label of ['Uppercase', 'Replace', 'Lowercase']) {
    await palette.getByRole('button', { name: label, exact: true }).click()
  }
  await expect(page.locator('.flow-edge__flash')).toHaveCount(0)

  // Replace starts with an empty Search, which the backend rejects as a Step error.
  const rejected = page.waitForResponse((response) => response.url().endsWith('/api/chain/run') && response.status() === 422)
  await page.getByRole('button', { name: 'Run' }).click()
  const response = await rejected
  const id = response.request().postDataJSON().steps[1].id as string
  await expectDomainRejection(response, {
    ...stepErrors,
    detail: '1 problem stops the Chain from running.',
    errors: [{ ...stepErrors.errors[0], stepId: id }],
  })

  await expect(page.locator('.node--invalid')).toHaveCount(1)
  await expect(page.locator('.flow-edge__flash--danger')).toHaveCount(2)
  await expect(page.locator('.flow-edge__flash--success')).toHaveCount(0)
  // The red edges keep pulsing until the next run, so the animation never ends.
  for (const edge of await page.locator('.flow-edge__flash--danger').all()) {
    await expect(edge).toHaveCSS('animation-iteration-count', 'infinite')
  }
  await page.screenshot({ path: testInfo.outputPath('01-red-flash.png') })
})
