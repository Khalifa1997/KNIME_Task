import { join } from 'node:path'
import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

// End-to-end tests run against the real jar: build it first with `./mvnw package`.
const port = Number(process.env.E2E_PORT ?? 8181)
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('E2E_PORT must be an integer between 1024 and 65535')
}
if (process.env.BASE_URL && process.env.BASE_URL !== `http://localhost:${port}`) {
  throw new Error('BASE_URL must match the local jar port; use E2E_PORT to change ports')
}
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
