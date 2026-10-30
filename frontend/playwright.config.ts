import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'
import { jarServer } from './e2e/server'

// End-to-end tests run against the real jar: build it first with `./mvnw package`.
const { baseURL, webServer } = jarServer(8181)

export default defineConfig({
  testDir: './e2e',
  timeout: 30 * 1000,
  expect: { timeout: 5000 },
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Chromium phone emulation: touch, 412px wide (below the spec's 800px phone breakpoint).
      name: 'phone',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer,
})
