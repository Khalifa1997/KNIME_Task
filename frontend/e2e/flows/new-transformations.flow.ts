import { test, expect } from './fixtures'

// Rehearsed with the pr-evidence playwright-cli session against the real jar.
test('trims, masks and reverses a card number, round-trips it through Base64, and rejects text that is not Base64', async ({
  page,
  expectDomainRejection,
}, testInfo) => {
  await page.goto('/')
  const add = page.getByRole('region', { name: 'Add Step' })
  await page.getByRole('textbox', { name: 'Input text' }).fill('   4111111111111111   ')
  for (const label of ['Trim whitespace', 'Mask', 'Base64 encode', 'Base64 decode', 'Reverse']) {
    await add.getByRole('button', { name: label, exact: true }).click()
  }

  const trim = page.getByRole('group', { name: 'Step 1: Trim whitespace' })
  const mask = page.getByRole('group', { name: 'Step 2: Mask' })
  const encode = page.getByRole('group', { name: 'Step 3: Base64 encode' })
  const roundTrip = page.getByRole('group', { name: 'Step 4: Base64 decode' })
  const output = page.getByRole('group', { name: 'Output' })
  await expect(trim.getByRole('combobox', { name: 'Trim from' })).toHaveValue('both')
  await expect(mask.getByRole('textbox', { name: 'Mask character' })).toHaveValue('*')
  await expect(encode.getByRole('checkbox', { name: 'URL-safe alphabet' })).not.toBeChecked()
  await mask.getByRole('spinbutton', { name: 'Keep at end' }).fill('4')
  await page.getByRole('button', { name: 'Fit View', exact: true }).click()
  await page.screenshot({ path: testInfo.outputPath('01-chain-ready.png') })

  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Up to date')
  await expect(trim.locator('.node__result')).toHaveText('4111111111111111')
  await expect(mask.locator('.node__result')).toHaveText('************1111')
  await expect(encode.locator('.node__result')).toHaveText('KioqKioqKioqKioqMTExMQ==')
  await expect(roundTrip.locator('.node__result')).toHaveText('************1111')
  await expect(output.locator('.node__result')).toHaveText('1111************')
  await page.screenshot({ path: testInfo.outputPath('02-round-trip.png') })

  // Without the encode Step, the decode Step receives masked text, which isn't Base64.
  await page.getByRole('button', { name: 'Delete Step 3: Base64 encode' }).click()
  const decode = page.getByRole('group', { name: 'Step 3: Base64 decode' })
  await expect(decode).not.toContainText("Text isn't valid Base64.")
  const rejected = page.waitForResponse((response) => response.url().endsWith('/api/chain/run') && response.status() === 422)
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  const response = await rejected
  const steps = response.request().postDataJSON().steps as { id: string }[]
  await expectDomainRejection(response, {
    type: 'about:blank',
    status: 422,
    title: 'Chain could not run',
    detail: '1 problem stops the Chain from running.',
    errors: [{ stepId: steps[2]!.id, field: null, code: 'invalid-base64', detail: "Text isn't valid Base64." }],
  })
  await expect(page.getByRole('status')).toHaveText('1 problem stops the Chain from running.')
  await expect(decode).toContainText("Text isn't valid Base64.")
  await expect(output).toContainText('Press Run to see the Output.')
  await page.getByRole('button', { name: 'Fit View', exact: true }).click()
  await page.screenshot({ path: testInfo.outputPath('03-invalid-base64.png') })
})
