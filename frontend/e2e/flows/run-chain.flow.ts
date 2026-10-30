import { test, expect } from './fixtures'

test('adds Uppercase and Lowercase Steps, runs the Chain and sees each result and the Output', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  const status = page.getByRole('status')
  const input = page.getByRole('textbox', { name: 'Input text' })
  const palette = page.getByRole('region', { name: 'Add Step' })
  const uppercase = page.getByRole('group', { name: 'Step 1: Uppercase' })
  const lowercase = page.getByRole('group', { name: 'Step 2: Lowercase' })
  const output = page.getByRole('group', { name: 'Output' })

  await input.fill('Hello World')
  await palette.getByRole('button', { name: 'Uppercase' }).click()
  await palette.getByRole('button', { name: 'Lowercase' }).click()

  // Wired in Chain order, focused on the new Step, and nothing has run yet.
  await expect(lowercase).toBeFocused()
  await expect(status).toHaveText('Not run yet')
  await expect(uppercase).toContainText('Run to see it')
  await expect(lowercase).toContainText('Run to see it')
  await page.screenshot({ path: testInfo.outputPath('01-chain-not-run.png') })

  // Ctrl+Enter runs from inside the Input text.
  await input.press('Control+Enter')
  await expect(status).toHaveText('Up to date')
  await expect(uppercase).toContainText('HELLO WORLD')
  await expect(lowercase).toContainText('hello world')
  await expect(output).toContainText('hello world')
  await page.screenshot({ path: testInfo.outputPath('02-ran.png') })

  // An edit makes the results stale; undoing it brings "Up to date" back.
  await input.fill('Hello Worlds')
  await expect(status).toHaveText('Changed since the last run')
  await page.screenshot({ path: testInfo.outputPath('03-changed.png') })
  await input.fill('Hello World')
  await expect(status).toHaveText('Up to date')

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(output).toContainText('hello world')
  await page.screenshot({ path: testInfo.outputPath('04-phone.png') })
})
