import { join } from 'node:path'
import process from 'node:process'
import { defineConfig } from '@playwright/test'

// Evidence recording only; kept apart from the repo's regular test config.
// Records against the real jar: build it first with `./mvnw package`.
const port = 8182
const baseURL = process.env.BASE_URL ?? `http://localhost:${port}`
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
    reuseExistingServer: true,
    timeout: 60 * 1000,
  },
})
