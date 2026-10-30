import { join } from 'node:path'
import process from 'node:process'
import { defineConfig } from '@playwright/test'

// Evidence recording only; kept apart from the repo's regular test config.
// Records against the real jar: build it first with `./mvnw package`.
const port = Number(process.env.E2E_PORT ?? 8182)
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('E2E_PORT must be an integer between 1024 and 65535')
}
const baseURL = process.env.BASE_URL ?? `http://localhost:${port}`
if (process.env.BASE_URL && process.env.BASE_URL !== `http://localhost:${port}`) {
  throw new Error('BASE_URL must match the local jar port; use E2E_PORT to change ports')
}
const java = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', 'java') : 'java'

export default defineConfig({
  testDir: 'e2e/flows',
  testMatch: '*.flow.ts',
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL,
    viewport: { width: 1280, height: 800 },
    video: { mode: 'on', size: { width: 1280, height: 800 } },
    // Flows take named screenshots at the states that matter.
    screenshot: 'off',
    // Paces every action so a reviewer can follow the video.
    launchOptions: { slowMo: 400 },
  },
  webServer: {
    command: `"${java}" -jar ../app/target/app.jar --server.port=${port}`,
    url: `${baseURL}/api/transformations`,
    reuseExistingServer: !process.env.E2E_PORT,
    timeout: 60 * 1000,
  },
})
