import { join } from 'node:path'
import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

// End-to-end tests run against the real jar: build it first with `./mvnw package`.
const port = 8181
const java = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', 'java') : 'java'

export default defineConfig({
  testDir: './e2e',
  timeout: 30 * 1000,
  expect: { timeout: 5000 },
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${port}`,
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
  webServer: {
    command: `"${java}" -jar ../app/target/app.jar --server.port=${port}`,
    url: `http://localhost:${port}/api/transformations`,
    reuseExistingServer: false,
    timeout: 60 * 1000,
  },
})
