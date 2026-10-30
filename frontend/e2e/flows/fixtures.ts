import { test as base, expect, type Response } from '@playwright/test'

type DomainRejectionAssertion = (response: Response, expectedBody: unknown) => Promise<void>

// Strict by default. Flows may explicitly assert an expected domain response; only the matching
// browser-generated resource error is then allowed, once per asserted response.
export const test = base.extend<{
  consoleErrors: string[]
  expectDomainRejection: DomainRejectionAssertion
}>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on('console', (message) => {
        if (message.type() === 'error') {
          errors.push(JSON.stringify({ text: message.text(), url: message.location().url }))
        }
      })
      page.on('pageerror', (error) => errors.push(error.message))
      await use(errors)
      expect(errors, 'unexpected console errors during the flow').toEqual([])
    },
    { auto: true },
  ],
  expectDomainRejection: async ({ consoleErrors }, use) => {
    const expectedUrls: string[] = []
    await use(async (response, expectedBody) => {
      expect(response.request().method()).toBe('POST')
      expect(new URL(response.url()).pathname).toBe('/api/chain/run')
      expect(response.status()).toBe(422)
      expect(response.headers()['content-type']).toContain('application/problem+json')
      expect(await response.json()).toEqual(expectedBody)
      expectedUrls.push(response.url())
    })
    for (const url of expectedUrls) {
      const index = consoleErrors.findIndex((entry) => {
        try {
          const message = JSON.parse(entry) as { text: string; url: string }
          return message.url === url && /^Failed to load resource: the server responded with a status of 422 \([^)]*\)$/.test(message.text)
        } catch {
          return false
        }
      })
      if (index !== -1) consoleErrors.splice(index, 1)
    }
  },
})

export { expect }
