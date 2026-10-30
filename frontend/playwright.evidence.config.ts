import { playwrightServer } from './playwright-server'
import { defineConfig } from '@playwright/test'

// Evidence recording only; kept apart from the repo's regular test config.
// Records against the real jar: build it first with `./mvnw package`.
const server = playwrightServer(8182)

export default defineConfig({
  testDir: 'e2e/flows',
  testMatch: '*.flow.ts',
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: server.baseURL,
    viewport: { width: 1280, height: 800 },
    video: { mode: 'on', size: { width: 1280, height: 800 } },
    // Flows take named screenshots at the states that matter.
    screenshot: 'off',
    // Paces every action so a reviewer can follow the video.
    launchOptions: { slowMo: 400 },
  },
  webServer: server.webServer,
})
