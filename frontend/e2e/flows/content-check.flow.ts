import { createServer, type Server } from 'node:http'
import { test, expect } from './fixtures'
import flagged from '../../../contract/post-chain-run.input-flagged.422.json' with { type: 'json' }

// Needs a server that has an OpenAI API key, pointed at the stub below, never at the real service:
//   OPENAI_API_KEY=sk-evidence OPENAI_BASE_URL=http://127.0.0.1:9099 node scripts/pr-evidence.mjs content-check
// The stub flags any Input text that contains BADWORD.
let stub: Server

test.beforeAll(async () => {
  stub = createServer((request, response) => {
    let body = ''
    request.on('data', (chunk: Buffer) => (body += chunk.toString()))
    request.on('end', () => {
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify({ results: [{ flagged: body.includes('BADWORD') }] }))
    })
  })
  await new Promise<void>((resolve) => stub.listen(9099, '127.0.0.1', resolve))
})

test.afterAll(async () => {
  await new Promise((resolve) => stub.close(resolve))
})

test('the Content check stops flagged Input text, and lets the same text through once it is switched off', async ({
  page,
  expectDomainRejection,
}, testInfo) => {
  await page.goto('/')
  const input = page.getByRole('textbox', { name: 'Input text' })
  const contentCheck = page.getByRole('button', { name: 'Content check (sends text to OpenAI)' })
  const runButton = page.getByRole('button', { name: 'Run', exact: true })
  const status = page.getByRole('status')
  const output = page.getByRole('group', { name: 'Output' })

  await expect(contentCheck).toHaveAttribute('aria-pressed', 'false')
  await contentCheck.hover()
  await expect(page.getByText('Content check off. Select to send the Input text to OpenAI before each run.')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('00-tooltip.png') })
  await input.fill('hello BADWORD')
  await page.screenshot({ path: testInfo.outputPath('01-check-off.png') })

  await contentCheck.click()
  await expect(contentCheck).toHaveAttribute('aria-pressed', 'true')
  const [rejection] = await Promise.all([page.waitForResponse('**/api/chain/run'), runButton.click()])
  await expectDomainRejection(rejection, flagged)
  await expect(page.getByText("Input text was flagged as harmful and wasn't run.")).toBeVisible()
  await expect(status).toHaveText('1 problem stops the Chain from running.')
  await expect(output).not.toContainText('BADWORD')
  await page.screenshot({ path: testInfo.outputPath('02-flagged.png') })

  await contentCheck.click()
  await expect(contentCheck).toHaveAttribute('aria-pressed', 'false')
  await runButton.click()
  await expect(status).toHaveText('Up to date')
  await expect(output).toContainText('hello BADWORD')
  await expect(page.getByText("Input text was flagged as harmful and wasn't run.")).toBeHidden()
  await page.screenshot({ path: testInfo.outputPath('03-check-off-runs.png') })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Fit View' }).click()
  await expect(contentCheck).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('04-phone.png') })
})
